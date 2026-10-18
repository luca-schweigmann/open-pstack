import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

test("gate receipt CLI validates evidence at the verified head", () => {
  const directory = mkdtempSync(join(tmpdir(), "pstack-gate-"));
  const file = join(directory, "receipt.json");
  const script = fileURLToPath(new URL("../scripts/check-gate-receipt.mjs", import.meta.url));
  const headSha = "a".repeat(40);
  const gate = { command: "run-e2e --flow smoke", exitCode: 0, duration: 5, logTail: "passed" };
  const run = (receipt, expected, message, sha = headSha) => {
    writeFileSync(file, JSON.stringify(receipt));
    const result = spawnSync(process.execPath, [script, file, sha], { encoding: "utf8" });
    assert.equal(result.status, expected, result.stderr);
    assert.match(result.stdout + result.stderr, message);
  };
  try {
    run({ headSha, gates: [gate] }, 0, /ok: 1 gate receipts/);
    for (const field of ["command", "exitCode", "duration", "logTail"]) {
      const incomplete = { ...gate };
      delete incomplete[field];
      run({ headSha, gates: [incomplete] }, 1, new RegExp(field));
    }
    run({ headSha, gates: [gate] }, 1, /differs from verified SHA/, "b".repeat(40));
    run({ headSha: "short", gates: [gate] }, 1, /full commit SHA/);
    run({ headSha, gates: [] }, 1, /nonempty array/);
    run({ headSha, gates: [{ ...gate, duration: -1 }] }, 1, /duration/);
    run({ headSha, gates: [{ ...gate, exitCode: 1 }] }, 0, /ok:/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
