#!/usr/bin/env python3
"""List queue items that can start now; with --check, a free item without an owner is drift.

queue.tsv columns (tab-separated, header row required):
  id     item ID
  after  comma-separated predecessor IDs, or -
  paths  comma-separated path prefixes or globs the item writes
  gate   none, or the name of an open operator go-gate
  state  todo | owned | merged | held
  owner  retained handle of the running owner, or -
"""
import argparse
import csv
from fnmatch import fnmatch
from pathlib import Path
import sys


def split(value):
    value = (value or "").strip()
    return [] if value in ("", "-") else [part.strip() for part in value.split(",") if part.strip()]


def overlaps(a, b):
    def one(x, y):
        x, y = x.rstrip("/"), y.rstrip("/")
        return x == y or x.startswith(y + "/") or y.startswith(x + "/") or fnmatch(x, y) or fnmatch(y, x)
    return any(one(x, y) for x in a for y in b)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("queue", type=Path)
    parser.add_argument("--max-active", type=int, default=10, help="Cloud owner limit for this project")
    parser.add_argument("--check", action="store_true", help="Exit 1 when a free item has no owner and a slot is open")
    args = parser.parse_args()

    with args.queue.open(newline="") as handle:
        rows = list(csv.DictReader(handle, delimiter="\t"))
    by_id = {row["id"]: row for row in rows}
    owned = [row for row in rows if row["state"] == "owned"]
    problems = []
    for row in rows:
        if row["state"] == "owned" and not split(row.get("owner")):
            problems.append(f"{row['id']}: owned without owner handle")
        for dep in split(row.get("after")):
            if dep not in by_id:
                problems.append(f"{row['id']}: unknown predecessor {dep}")

    free, claimed = [], [split(row.get("paths")) for row in owned]
    for row in rows:
        if row["state"] != "todo" or (row.get("gate") or "none").strip() not in ("", "none", "-"):
            continue
        if any(by_id.get(dep, {}).get("state") != "merged" for dep in split(row.get("after"))):
            continue
        paths = split(row.get("paths"))
        if any(overlaps(paths, other) for other in claimed):
            continue
        free.append(row["id"])
        claimed.append(paths)

    slots = max(args.max_active - len(owned), 0)
    start = free[:slots]
    print(f"active {len(owned)}/{args.max_active}; free {len(free)}; start now: {', '.join(start) or '-'}")
    for problem in problems:
        print(f"problem: {problem}")
    if args.check and (start or problems):
        print("drift: start an owner for each item above in this tick" if start else "drift: fix queue.tsv")
        sys.exit(1)


if __name__ == "__main__":
    main()
