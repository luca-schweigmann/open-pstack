import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

test("gate receipt CLI accepts evidence and rejects incomplete runner receipts", () => {
  const directory = mkdtempSync(join(tmpdir(), "pstack-gate-"));
  const file = join(directory, "receipt.json");
  const script = fileURLToPath(new URL("../scripts/check-gate-receipt.mjs", import.meta.url));
  const receipt = {
    headSha: "a".repeat(40),
    gates: [{
      command: "run-e2e --flow smoke", exitCode: 0, duration: 5, logTail: "passed",
      route: "shared-remote-test-runner", timeout: 60,
      "route-reason": "Cloud lacks the required device",
      budget: { kind: "measured", seconds: 5, evidence: "previous gate receipt" },
    }],
  };
  const run = (gate, expected, message) => {
    writeFileSync(file, JSON.stringify({ ...receipt, gates: [gate] }));
    const result = spawnSync(process.execPath, [script, file], { encoding: "utf8" });
    assert.equal(result.status, expected, result.stderr);
    assert.match(result.stdout + result.stderr, message);
  };
  const gate = receipt.gates[0];
  try {
    run(gate, 0, /ok: 1 gate receipts/);
    for (const field of ["timeout", "route-reason", "budget"]) {
      const incomplete = { ...gate };
      delete incomplete[field];
      run(incomplete, 1, new RegExp(field));
    }
    run({ ...gate, timeout: 7200 }, 1, /timeout must equal/);
    run({ ...gate, timeout: 91, budget: { kind: "measured", seconds: 45.1, evidence: "previous receipt" } }, 0, /ok:/);
    run({ ...gate, timeout: 120, budget: { kind: "repo", seconds: 120, evidence: "AGENTS.md gate budget" } }, 0, /ok:/);
    run({ ...gate, timeout: 900, budget: { kind: "first-run" } }, 0, /ok:/);
    run({ ...gate, timeout: 901, budget: { kind: "first-run" } }, 1, /900 seconds/);
    run({ ...gate, retry: {} }, 1, /diagnosis and change/);
    run({ ...gate, retry: { diagnosis: "memory limit", change: "split the fixture batch" } }, 0, /ok:/);
    run({ ...gate, route: "cloud", timeout: undefined, budget: undefined }, 0, /ok:/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
