#!/usr/bin/env node
import { readFileSync } from "node:fs";

const nonempty = (value) => typeof value === "string" && value.trim().length > 0;
const positive = (value) => Number.isFinite(value) && value > 0;

try {
  if (process.argv.length !== 3) throw new Error("usage: node scripts/check-gate-receipt.mjs <receipt.json>");
  const receipt = JSON.parse(readFileSync(process.argv[2], "utf8"));
  if (!/^[a-f0-9]{40}$/.test(receipt.headSha)) throw new Error("headSha must be a full commit SHA");
  if (!Array.isArray(receipt.gates) || !receipt.gates.length) throw new Error("gates must be a nonempty array");

  for (const [index, gate] of receipt.gates.entries()) {
    const requireField = (condition, message) => {
      if (!condition) throw new Error(`gate ${index + 1}: ${message}`);
    };
    requireField(nonempty(gate.command), "command is required");
    requireField(Number.isInteger(gate.exitCode), "exitCode must be an integer");
    requireField(Number.isFinite(gate.duration) && gate.duration >= 0, "duration must be seconds");
    requireField(nonempty(gate.logTail), "logTail is required");
    requireField(["cloud", "shared-remote-test-runner", "local"].includes(gate.route), "route is required");
    if (gate.route !== "shared-remote-test-runner") continue;

    requireField(nonempty(gate["route-reason"]), "route-reason must explain what Cloud cannot run");
    requireField(positive(gate.timeout), "timeout must be positive seconds");
    const budget = gate.budget;
    requireField(budget && typeof budget === "object", "budget is required");
    if (budget.kind === "measured") {
      requireField(positive(budget.seconds) && nonempty(budget.evidence), "measured budget needs seconds and evidence");
      requireField(gate.timeout === Math.max(60, Math.ceil(budget.seconds * 2)), "timeout must equal max(60, ceil(measured seconds * 2))");
    } else if (budget.kind === "repo") {
      requireField(positive(budget.seconds) && nonempty(budget.evidence), "repo budget needs seconds and an AGENTS.md evidence reference");
      requireField(gate.timeout === budget.seconds, "timeout must equal the repository budget");
    } else {
      requireField(budget.kind === "first-run", "budget kind must be measured, repo, or first-run");
      requireField(gate.timeout <= 900, "first-run timeout must not exceed 900 seconds");
    }
    if (gate.retry !== undefined) {
      requireField(nonempty(gate.retry?.diagnosis) && nonempty(gate.retry?.change), "retry needs diagnosis and change before resubmission");
    }
  }
  console.log(`ok: ${receipt.gates.length} gate receipts at ${receipt.headSha}`);
} catch (error) {
  console.error(`invalid gate receipt: ${error.message}`);
  process.exitCode = 1;
}
