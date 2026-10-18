#!/usr/bin/env node
import { readFileSync } from "node:fs";

const nonempty = (value) => typeof value === "string" && value.trim().length > 0;

try {
  if (process.argv.length !== 4) throw new Error("usage: node scripts/check-gate-receipt.mjs <receipt.json> <verified-sha>");
  const receipt = JSON.parse(readFileSync(process.argv[2], "utf8"));
  if (!/^[a-f0-9]{40}$/.test(receipt.headSha)) throw new Error("headSha must be a full commit SHA");
  if (receipt.headSha !== process.argv[3]) throw new Error("headSha differs from verified SHA");
  if (!Array.isArray(receipt.gates) || !receipt.gates.length) throw new Error("gates must be a nonempty array");

  for (const [index, gate] of receipt.gates.entries()) {
    const requireField = (condition, message) => {
      if (!condition) throw new Error(`gate ${index + 1}: ${message}`);
    };
    requireField(nonempty(gate.command), "command is required");
    requireField(Number.isInteger(gate.exitCode), "exitCode must be an integer");
    requireField(Number.isFinite(gate.duration) && gate.duration >= 0, "duration must be seconds");
    requireField(nonempty(gate.logTail), "logTail is required");
  }
  console.log(`ok: ${receipt.gates.length} gate receipts at ${receipt.headSha}`);
} catch (error) {
  console.error(`invalid gate receipt: ${error.message}`);
  process.exitCode = 1;
}
