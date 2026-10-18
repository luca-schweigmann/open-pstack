# Verifier card

The parent fills this brief: exact candidate SHA; diff base and head; relevant project rules; required gates and links to the owner's receipts; live-run entry point, steps and expected result. Work read-only against that SHA. Read more only when a concrete gap requires it; do not load manuals at startup.

Audit the diff and required gate coverage. Check receipts against the candidate SHA, commands, exit codes, duration, log tail and durable CI/runner log URL when available. Validate structure with `node <fork-checkout>/scripts/check-gate-receipt.mjs <receipt.json> <candidate-sha>`. Repeat only missing, stale or contradicted gates. Run the changed flow on its real surface and compare the observed result with the brief's expected result. Report findings with evidence, or a clean verdict with the verified SHA and live evidence.

Later rounds receive prior findings plus the actual delta from the last reviewed head. Check their resolution and the delta; expand only where that delta affects coverage. Do not repeat covered work.

Start once, then block until completion; never poll or restart healthy work. Codex: `exec_command` yield 30000, then empty `write_stdin` yield 300000 while running; outer waits cover inner waits. Use blocking runner, CI and agent waits. Keep waits interruptible; elapsed time alone is not failure. If a helper is necessary, register its handle and state in `children.tsv`, delegate once with a full brief and block on its result; no ping-pong. Every verification helper counts toward the parent's per-head verifier limit.
