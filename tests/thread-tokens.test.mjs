import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

test("token usage CLI groups synthetic threads without modifying its database", () => {
  const directory = mkdtempSync(join(tmpdir(), "pstack-usage-"));
  const database = join(directory, "state.sqlite");
  try {
    const setup = spawnSync("python3", ["-c", "import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.executescript(open(sys.argv[2]).read()); c.close()", database, resolve("tests/fixtures/thread-tokens.sql")], { encoding: "utf8" });
    assert.equal(setup.status, 0, setup.stderr);
    const before = readFileSync(database);
    const run = (file) => spawnSync("python3", [resolve("scripts/thread-tokens.py"), file], { encoding: "utf8" });
    const result = run(database);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.deepEqual(report.groups["PR #12"], { owner: 1000, verifier: 100, fix: 50, threads: 4, created_at_ms: 1000, overhead_share: 150 / 1150, overhead_to_owner: 0.15 });
    assert.equal(report.groups["PR #13"].overhead_to_owner, null);
    assert.equal(report.groups["slice:sample"].overhead_share, null);
    assert.deepEqual(report.unassigned, { threads: 3, tokens: 90 });
    assert.deepEqual(readFileSync(database), before);
    assert.equal(run(join(directory, "missing.sqlite")).status, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
