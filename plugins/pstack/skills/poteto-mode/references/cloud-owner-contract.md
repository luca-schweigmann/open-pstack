# Cloud owner card

Read this card and project AGENTS.md. The parent supplies slice, checkout, starting SHA, branch and forge identities. Work there. Run `node <fork-checkout>/scripts/cloud-owner-preflight.mjs <fork-checkout> <project-checkout>` first; failure means blocked. Helpers confirm the checkout root. Register their handles and states in `children.tsv`; delegate once with a full brief, then block, without ping-pong. Before rebase/rewrite apply Shipping step 4: disarm merge requests and confirm them off.

Build, open the PR early through the GitHub connector, and keep repairs there. Fix rounds use a fresh owner with merged scope; resume only indispensable agent-local state. Start only after the prior writer returns or holds. Push completed units; preserve an uncommitted decisions trail with a durable link. Report new heads. Run project gates on committed code; finish deslop and no-comments before code-ready, then prove the change on the real artifact per the prove-it-works principle. Read more only when needed. Hold means zero writes; unexpected branch writes mean stop.

## Gate evidence

Run gates once per relevant head. Post one PR JSON receipt: `{"headSha":"<SHA>","gates":[{"command":"<command>","exitCode":0,"duration":5,"logTail":"passed","logUrl":"<durable CI/runner log URL when available>"}]}`. Duration is seconds. Validate: `node <fork-checkout>/scripts/check-gate-receipt.mjs <receipt.json> <verified-sha>`.

Verifiers audit coverage, SHA and gate fields; repeat only missing, stale or contradicted gates, plus a live run and diff audit. Red stays red until repaired.

## Wait and report

Start once; block until completion. Never poll/restart healthy work. Codex: `exec_command` yield 30000, then empty `write_stdin` yield 300000. Outer waits cover inner waits. Use blocking runner, CI and agent waits; keep them interruptible. Elapsed time is not failure.

End each turn: `{"state":"code-ready|blocked|failed","headSha":null,"prUrl":null,"receiptUrl":null,"trailUrl":null}`. Code-ready requires current SHA and all links, with green required gates. Explain blockers. Never merge, deploy, handle live credentials/customer data or change access; the local root owns permitted live steps.
