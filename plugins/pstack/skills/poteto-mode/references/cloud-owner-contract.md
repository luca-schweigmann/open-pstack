# Cloud owner card

Read this card and project AGENTS.md. The parent supplies your slice, checkout, starting SHA, branch and forge identities. Work only in that checkout and branch. First run `node <fork-checkout>/scripts/cloud-owner-preflight.mjs <fork-checkout> <project-checkout>`; on failure report blocked before building. Give any helper the checkout and require it to confirm `git rev-parse --show-toplevel` before work.

Build the slice, open the PR early through the GitHub connector, and keep repairs on it. Push completed units and preserve an uncommitted decisions trail with a durable link. Report every new head. Run project-required gates on committed code; finish deslop and no-comments before code-ready. Read individual principles or instructions only when needed. A hold means zero writes. Unexpected branch writes mean stop and report.

## Gate evidence

Owner gates run once per relevant head. Post one JSON receipt on the PR: `{"headSha":"<full SHA>","gates":[{"command":"<command>","exitCode":0,"duration":5,"logTail":"passed"}]}`. Duration is seconds. Validate with `node <fork-checkout>/scripts/check-gate-receipt.mjs <receipt.json> <verified-sha>`.

Verifiers check required gate coverage, SHA, commands, exit codes, duration and log tail against the diff. Repeat only missing, stale or contradicted gates; a red gate stays red until repaired. Check structure with the same validator. Every verification includes a live run of the changed flow on its real surface and a diff audit. Small fixes and rebases get one verifier on the delta, as the playbook specifies.

## Wait and report

Start once, then block until completion; never poll or restart healthy work. Codex: `exec_command` yield 30000, then empty `write_stdin` yield 300000 while running. Outer waits must cover inner waits. Use a runner's blocking wait, CI watch, and blocking agent waits. Keep waits interruptible; elapsed time alone is not failure.

End each turn with JSON: `{"state":"code-ready|blocked|failed","prUrl":null,"headSha":null,"gates":[],"trailUrl":null}`. Code-ready requires the PR URL, full current SHA, green required gates with commands and exit codes, and trail link. Explain a blocker before the block. Never merge, deploy, handle live credentials/customer data, or change access; the local root owns permitted live steps after verification.
