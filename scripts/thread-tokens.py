#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
import re
import sqlite3

parser = argparse.ArgumentParser(description="Read token usage grouped by explicit PR/slice and role names.")
parser.add_argument("database", type=Path)
args = parser.parse_args()
name_pattern = re.compile(r"^(?:PR #(?P<pr>[1-9][0-9]*)|slice:(?P<slice>[^\s]+)) (?P<role>owner|verifier|fix)(?:\s|$)")
groups = {}
unassigned = {"threads": 0, "tokens": 0}
try:
    with sqlite3.connect(args.database.resolve().as_uri() + "?mode=ro", uri=True) as database:
        for name, tokens, created in database.execute("SELECT name, tokens_used, created_at_ms FROM threads"):
            tokens = tokens or 0
            match = name_pattern.match(name or "")
            if not match:
                unassigned["threads"] += 1
                unassigned["tokens"] += tokens
                continue
            key = "PR #" + match["pr"] if match["pr"] else "slice:" + match["slice"]
            group = groups.setdefault(key, {"owner": 0, "verifier": 0, "fix": 0, "threads": 0, "created_at_ms": created})
            group[match["role"]] += tokens
            group["threads"] += 1
            if created is not None:
                group["created_at_ms"] = min(group["created_at_ms"], created) if group["created_at_ms"] is not None else created
    for group in groups.values():
        overhead = group["verifier"] + group["fix"]
        total = group["owner"] + overhead
        group["overhead_share"] = overhead / total if total else None
        group["overhead_to_owner"] = overhead / group["owner"] if group["owner"] else None
    print(json.dumps({"overhead": "verifier + fix; orchestration not represented by these roles", "groups": dict(sorted(groups.items())), "unassigned": unassigned}, indent=2))
except (sqlite3.Error, OSError) as error:
    parser.exit(1, f"Cannot read thread usage: {error}\n")
