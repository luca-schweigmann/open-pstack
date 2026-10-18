#!/usr/bin/env python3
import argparse
from datetime import datetime
import json
import os
from pathlib import Path
import re
import sqlite3


FIELDS = ("uncached_input", "cached_input", "output", "model_turns", "unknown_tokens")
NAME = re.compile(r"^(?:PR #(?P<pr>[1-9][0-9]*)|slice:(?P<slice>[^\s]+)) (?P<role>owner|verifier|fix)(?:\s|$)")
HANDLE = re.compile(r"^pr(?P<pr>[1-9][0-9]*)_(?:[a-z0-9]+_)*(?P<role>owner|verifier|fix)$")
READY = re.compile(r'"state"\s*:\s*"code-ready"')


def thread_name(thread):
    title = (thread.get("title") or "").strip()
    if title:
        return title
    source = thread.get("source")
    try:
        source = json.loads(source) if isinstance(source, str) else source
        path = source["subagent"]["thread_spawn"]["agent_path"]
    except (ValueError, KeyError, TypeError):
        path = None
    if isinstance(path, str) and path.strip().rstrip("/"):
        return path.strip().rstrip("/").rsplit("/", 1)[-1]
    return (thread.get("first_user_message") or (thread.get("name") if "title" not in thread else "") or "").strip()


def named_role(name):
    match = NAME.match(name)
    if match:
        return ("PR #" + match["pr"] if match["pr"] else "slice:" + match["slice"], match["role"])
    match = HANDLE.fullmatch(name)
    return ("PR #" + match["pr"], match["role"]) if match else None


def default_database():
    directory = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex"))
    candidates = [path for path in directory.glob("state_*.sqlite")
                  if path.stem.removeprefix("state_").isdigit()]
    return max(candidates, key=lambda path: int(path.stem.removeprefix("state_"))) if candidates else directory / "state_5.sqlite"


def empty():
    return dict.fromkeys(FIELDS, 0)


def add(target, usage):
    for field in FIELDS:
        target[field] += usage[field]


def total(usage):
    return sum(usage[field] for field in FIELDS if field != "model_turns")


def milliseconds(value):
    return int(datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp() * 1000)


def usage_events(thread, directory):
    path = Path(thread["rollout_path"]) if thread["rollout_path"] else None
    if path and not path.is_absolute():
        path = directory / path
    ready = None
    events = []
    previous = dict(input_tokens=0, cached_input_tokens=0, output_tokens=0)
    try:
        stream = path.open() if path else None
    except FileNotFoundError:
        stream = None
    if stream is None:
        usage = empty()
        usage["unknown_tokens"] = thread["tokens_used"] or 0
        return [(thread["created_at_ms"], usage)], ready, True
    with stream:
        for line in stream:
            event = json.loads(line)
            payload = event.get("payload", {})
            stamp = milliseconds(event["timestamp"])
            if ready is None:
                message = None
                if event.get("type") == "event_msg" and payload.get("type") == "agent_message":
                    message = payload.get("message", "")
                elif payload.get("type") == "message" and payload.get("role") == "assistant":
                    message = " ".join(part.get("text", "") for part in payload.get("content", []))
                if message and READY.search(message):
                    ready = stamp
            if event.get("type") != "event_msg" or payload.get("type") != "token_count":
                continue
            info = payload.get("info") or {}
            cumulative = info.get("total_token_usage")
            if not cumulative:
                continue
            current = {key: cumulative.get(key, 0) for key in previous}
            if current == previous:
                continue
            delta = {key: max(0, current[key] - previous[key]) for key in previous}
            previous = current
            usage = empty()
            usage.update(uncached_input=max(0, delta["input_tokens"] - delta["cached_input_tokens"]),
                         cached_input=delta["cached_input_tokens"], output=delta["output_tokens"], model_turns=1)
            events.append((stamp, usage))
    return events, ready, False


def main():
    parser = argparse.ArgumentParser(description="Read run-window token usage by repository, PR/slice and phase.")
    parser.add_argument("database", type=Path, nargs="?", default=default_database())
    parser.add_argument("--since", type=int, default=0, help="Inclusive epoch milliseconds")
    parser.add_argument("--until", type=int, default=2**63 - 1, help="Exclusive epoch milliseconds")
    parser.add_argument("--repo", help="Exact git_origin_url or cwd")
    parser.add_argument("--root-thread", action="append", default=[], help="Build-chat ID; repeat for independent spawn trees (inferred from named roles only when omitted)")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--cloud-owner", action="append", default=[], type=json.loads,
                        help='Cloud start receipt as JSON [repository, "PR #N" or "slice:id", task ID]; repeat per owner')
    args = parser.parse_args()
    cloud_owners = {}
    for receipt in args.cloud_owner:
        if (not isinstance(receipt, list) or len(receipt) != 3
                or not all(isinstance(value, str) and value.strip() for value in receipt)
                or not re.fullmatch(r"(?:PR #[1-9][0-9]*|slice:[^\s]+)", receipt[1])):
            parser.error("--cloud-owner requires [repository, PR #N or slice:id, task ID]")
        cloud_owners.setdefault(json.dumps(receipt[:2], separators=(",", ":")), []).append(receipt[2])
    if args.since >= args.until:
        parser.error("--since must precede --until")
    groups = {}
    unassigned = {"threads": 0, **empty()}
    fallback_threads = 0
    excluded_foreign_threads = 0
    violations = []
    hints = []
    try:
        with sqlite3.connect(args.database.resolve().as_uri() + "?mode=ro", uri=True) as database:
            database.row_factory = sqlite3.Row
            columns = {row[1] for row in database.execute("PRAGMA table_info(threads)")}
            fields = ["id", "tokens_used", "created_at_ms", "rollout_path", "git_origin_url", "cwd"]
            fields += [field for field in ("title", "source", "first_user_message", "name") if field in columns]
            threads = [dict(row) for row in database.execute("SELECT " + ", ".join(fields) + " FROM threads")]
            for thread in threads:
                thread["resolved_name"] = thread_name(thread)
            parents = dict(database.execute("SELECT child_thread_id, parent_thread_id FROM thread_spawn_edges"))

            def root(thread_id):
                seen = set()
                while thread_id in parents and thread_id not in seen:
                    seen.add(thread_id)
                    thread_id = parents[thread_id]
                return thread_id

            known_ids = {thread["id"] for thread in threads}
            if not set(args.root_thread) <= known_ids:
                parser.error("Unknown --root-thread ID")
            roots = set(args.root_thread) if args.root_thread else {
                root(thread["id"]) for thread in threads if named_role(thread["resolved_name"])}

            def in_tree(thread_id):
                seen = set()
                while thread_id not in seen:
                    if thread_id in roots:
                        return True
                    seen.add(thread_id)
                    if thread_id not in parents:
                        return False
                    thread_id = parents[thread_id]
                return False

            for thread in threads:
                if args.repo and args.repo not in (thread["git_origin_url"], thread["cwd"]):
                    continue
                if thread["created_at_ms"] is not None and thread["created_at_ms"] >= args.until:
                    continue
                if not in_tree(thread["id"]):
                    excluded_foreign_threads += 1
                    continue
                events, ready, fallback = usage_events(thread, args.database.resolve().parent)
                selected = [(stamp, usage) for stamp, usage in events if stamp is not None and args.since <= stamp < args.until]
                created_in_window = thread["created_at_ms"] is not None and args.since <= thread["created_at_ms"] < args.until
                if not selected and not created_in_window:
                    continue
                fallback_threads += int(fallback)
                role = named_role(thread["resolved_name"])
                if not role:
                    if thread["id"] in parents and not thread["resolved_name"]:
                        violations.append(f"unnamed child: {thread['id']} (parent {parents[thread['id']]})")
                    unassigned["threads"] += 1
                    for _, usage in selected:
                        add(unassigned, usage)
                    continue
                repo = thread["git_origin_url"] or thread["cwd"] or "unknown"
                label, phase_role = role
                key = json.dumps([repo, label], separators=(",", ":"))
                group = groups.setdefault(key, {"repo": repo, "item": label, "threads": 0,
                                               "verifier_threads": 0, "usage": empty(), "O": empty(), "H": empty()})
                group["threads"] += 1
                group["verifier_threads"] += int(phase_role == "verifier")
                for stamp, usage in selected:
                    add(group["usage"], usage)
                    phase = "O" if phase_role == "owner" and (ready is None or stamp <= ready) else "H"
                    add(group[phase], usage)
        for key, group in sorted(groups.items()):
            owner, overhead = total(group["O"]), total(group["H"])
            group["overhead_to_owner"] = overhead / owner if owner else None
            if key in cloud_owners:
                group["cloud_owner_tasks"] = cloud_owners[key]
                group["owner_status"] = "unbekannt (Cloud)"
                group["O_local"] = group["O"]
                group["O"] = None
                group["overhead_to_owner"] = None
                hints.append(f"{key}: H/O unknown (Cloud); H={overhead}, O=unbekannt (Cloud)")
            if group["item"].startswith("PR #"):
                if group["verifier_threads"] > 2:
                    violations.append(f"{key}: {group['verifier_threads']} verifier threads > 2")
                if key not in cloud_owners and overhead * 3 > owner:
                    violations.append(f"{key}: H/O > 1/3 (H={overhead}, O={owner})")
        print(json.dumps({"window": {"since": args.since, "until": args.until},
                          "overhead": "H = owner after first code-ready + verifier + fix; unassigned = run-level overhead",
                          "fallback": "Missing rollouts: lifetime tokens_used as unknown_tokens at thread creation; phase and turn count unavailable",
                          "fallback_threads": fallback_threads, "excluded_foreign_threads": excluded_foreign_threads,
                          "root_threads": sorted(roots), "groups": dict(sorted(groups.items())),
                          "unassigned": unassigned, "hints": hints, "violations": violations}, indent=2))
        return int(args.check and bool(violations))
    except (sqlite3.Error, OSError, ValueError, KeyError, TypeError) as error:
        parser.exit(1, f"Cannot read thread usage: {error}\n")


if __name__ == "__main__":
    raise SystemExit(main())
