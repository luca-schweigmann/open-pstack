import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

test("token CLI checks run-window phases, repository isolation and unassigned overhead read-only", () => {
  const directory = mkdtempSync(join(tmpdir(), "pstack-usage-"));
  const database = join(directory, "state.sqlite");
  try {
    const setup = spawnSync("python3", ["-c", "import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.executescript(open(sys.argv[2]).read()); c.close()", database, resolve("tests/fixtures/thread-tokens.sql")], { encoding: "utf8" });
    assert.equal(setup.status, 0, setup.stderr);
    const token = (ms, input, cached, output) => ({ timestamp: new Date(ms).toISOString(), type: "event_msg", payload: { type: "token_count", info: { total_token_usage: { input_tokens: input, cached_input_tokens: cached, output_tokens: output } } } });
    const events = [token(900, 100, 80, 10), token(1000, 1000, 800, 110), token(1001, 1000, 800, 110),
      { timestamp: new Date(1050).toISOString(), type: "event_msg", payload: { type: "user_message", message: '{"state":"code-ready"}' } },
      { timestamp: new Date(1100).toISOString(), type: "event_msg", payload: { type: "agent_message", message: '{"state": "code-ready"}' } },
      token(1200, 1400, 1100, 160), token(2000, 9999, 5000, 999)];
    writeFileSync(join(directory, "owner.jsonl"), events.map(e => JSON.stringify(e)).join("\n"));
    const before = readFileSync(database);
    const run = (...options) => spawnSync("python3", [resolve("scripts/thread-tokens.py"), database, "--since", "1000", "--until", "2000", ...options], { encoding: "utf8" });
    const result = run("--check");
    assert.equal(result.status, 1, result.stderr);
    const report = JSON.parse(result.stdout);
    const group = report.groups[JSON.stringify(["repo-a", "PR #12"])];
    assert.deepEqual(group.O, { uncached_input: 180, cached_input: 720, output: 100, model_turns: 1, unknown_tokens: 0 });
    assert.deepEqual(group.H, { uncached_input: 100, cached_input: 300, output: 50, model_turns: 1, unknown_tokens: 35 });
    assert.equal(group.overhead_to_owner, 0.485);
    assert.equal(group.verifier_threads, 3);
    assert.equal(report.violations.length, 4);
    assert.equal(report.violations.filter(v => v.startsWith("unnamed child:")).length, 1);
    assert.equal(report.excluded_foreign_threads, 2);
    assert.deepEqual(report.unassigned, { threads: 2, uncached_input: 0, cached_input: 0, output: 0, model_turns: 0, unknown_tokens: 50 });
    assert.equal(Object.keys(report.groups).length, 4);
    const isolated = run("--repo", "repo-b", "--check");
    assert.equal(isolated.status, 0, isolated.stderr);
    assert.equal(Object.keys(JSON.parse(isolated.stdout).groups).length, 1);
    const cwd = run("--repo", "/sample/a");
    assert.equal(cwd.status, 0, cwd.stderr);
    assert.equal(Object.keys(JSON.parse(cwd.stdout).groups).length, 3);
    const explicit = run("--root-thread", "9", "--check");
    assert.equal(JSON.parse(explicit.stdout).unassigned.threads, 3);
    assert.deepEqual(readFileSync(database), before);
    assert.equal(spawnSync("python3", [resolve("scripts/thread-tokens.py"), join(directory, "missing.sqlite")]).status, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
