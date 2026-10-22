# Cloud owner card

Luca fork: your brief's `Owner rules (Luca)` block wins over this card where they differ.

Read this card, project AGENTS.md, the slice inputs, and only the skills the parent lists for this slice in `Skills:` from `<project-checkout>/.agents/skills`. This card is the owner's pstack manual. The parent supplies slice, checkout, starting SHA, branch and forge identities. Work there. Run `node <fork-checkout>/scripts/cloud-owner-preflight.mjs <fork-checkout> <project-checkout> --only <comma-separated Skills list>` first (use `poteto-mode` when no skills are listed). It verifies readable skill files and prints bootstrapInstructions. Run live proof through the repo's `verify-<project>` skill when it has one, and update it with the maintain-verification-skill skill when the slice changes a flow it covers. A service catalog is diagnostic information only; an empty executor catalog does not block direct file use. Helpers confirm the checkout root. Register their handles and states in `children.tsv`; delegate once with a full brief, then block, without ping-pong. Before rebase/rewrite apply Shipping step 4: disarm merge requests and confirm them off.

Build, open the PR early through the GitHub connector, and keep repairs there. Fix rounds use a fresh owner with merged scope; resume only indispensable agent-local state. Start only after the prior writer returns or holds. Push completed units; preserve an uncommitted decisions trail with a durable link. Report new heads. Run project gates on committed code; run deslop and no-comments only for large changes or data/rights/security, then prove the change on the real artifact per the prove-it-works principle. Read more only when needed. Hold means zero writes; unexpected branch writes mean stop.

## Output

Keep tool output small: pipe long commands through `tail -n 80` or `head -c 4000`, grep logs instead of printing them whole, and read files in ranges. Never cat whole large files or print full test logs.

Images: never load screenshots in batches. Look at one image only when it decides a step, shrunk first (`sips -Z 1000`) or cropped to the region. Otherwise keep screenshots as files and cite paths. When a visual check needs several images, hand the paths to a fresh Luna subagent that views them and returns only its verdict and findings. DOM reads target the region (`getByRole(...).innerText()`), never a full-page snapshot.

## Gate evidence

Run gates once per relevant head. Post one PR JSON receipt: `{"headSha":"<SHA>","gates":[{"command":"<command>","exitCode":0,"duration":5,"logTail":"passed","logUrl":"<durable CI/runner log URL when available>"}]}`. Duration is seconds. Validate: `node <fork-checkout>/scripts/check-gate-receipt.mjs <receipt.json> <verified-sha>`.

Verifiers audit coverage, SHA and gate fields; they repeat only missing, stale or contradicted gates and run live only what receipts do not cover. Only a P0 red (broken flow, wrong numbers, data/security risk) blocks code-ready; report P1 and below as follow-ups. Never repeat a failed gate unchanged. Name the cause from its log first; an environment failure your slice cannot fix is a blocker to report. Otherwise rerun once after a repair aimed at that cause. If the same failure recurs, stop and report; a different, newly diagnosed failure gets its own repair.

## Wait and report

Start once; block until completion. Never poll/restart healthy work. Codex: `exec_command` yield 30000, then empty `write_stdin` yield 300000. Outer waits cover inner waits. Use blocking runner, CI and agent waits; keep them interruptible. Elapsed time is not failure.

End each turn: `{"state":"code-ready|blocked|failed","headSha":null,"prUrl":null,"receiptUrl":null,"trailUrl":null}`. Code-ready requires current SHA and all links, with green required gates. Explain blockers. No human watches this task: never use a question or ask-user tool; when blocked, end the turn with state blocked and the exact question for the root, which answers it. Never merge, deploy, handle live credentials/customer data or change access; the local build chat runs merge and deploy after its verdict, and a fresh owner repairs what comes back.
