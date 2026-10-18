# Cloud owner contract

Create the local build root through session_bridge `codex_create_visible_session`, keep it visible, pin it through `codex_move_thread_to_sidebar_section` with `sectionId: "pinned"`, and read back both states before handing it the queue. Do not use `codex_create_thread`. The local build root runs Autopilot-full and owns verdicts, local verification, merge, and live steps. One Cloud owner builds each assigned slice and keeps its branch and PR through repairs. The root runs the configured Luna verify swarm locally on the reported head. Findings return to the same owner and PR. The route's queue and receipt rules live in [provider-dispatch](provider-dispatch.md#codex-cloud-owners).

## Start with the installed skills

Before building, run the fork's `scripts/cloud-owner-preflight.mjs` with the fork checkout and project checkout supplied in the brief. Paste its evidence block into the task. If it fails, report `blocked` and stop without building. A successful block proves file availability and records the fork commit; it does not prove the model has read the instructions.

Then read the installed poteto-mode SKILL.md, the owner duties in [Autopilot-full](../playbooks/autopilot-full.md), this contract, and the project's AGENTS.md. Apply poteto-mode, its relevant principles, deslop, no-comments, and technical-writing. Keep the decisions trail and push each completed unit worth preserving. Project-specific gates, commands, release permissions, and data rules come from the project's AGENTS.md, not this contract. Do not bypass a gate or substitute a weaker model.

## Ground every Cloud subagent in the project checkout

For every subagent a Cloud owner starts through `collaboration.spawn_agent`, put the absolute project-checkout path in the brief and use it as the working directory for every command, including commands run by read-only helpers. Require the subagent to begin with `cd <absolute-project-checkout>` and then run `git rev-parse --show-toplevel`. If `cd` or the Git command fails, or the reported top-level path is not the assigned checkout, the subagent must stop before any further work and report the failure to its owner. Do not rely on an inherited working directory: Cloud subagents have been observed starting in `/workspace` outside the repository, where Git exits 128.

## Build and report

Build and test the assigned slice. Run every gate that the project's AGENTS.md requires on the committed head before reporting code-ready. Use one E2E test per user flow and no new unit tests. When a test is red, rerun only that red test after the repair; do not rerun green tests without a relevant change. Report the actual gate commands and exit codes. Post one PR comment per head with each gate's command, exit code, duration, and log tail, tagged with the full head SHA. The root's verifiers check these receipts and do not re-run green gates, so a missing or vague receipt costs a rerun.

Use the GitHub connector for PR creation, updates, and check inspection. Do not use `gh` or Origin in Cloud. Push only the assigned branch and keep all repairs on the same PR. Finish deslop and no-comments before handing the head to the root. Keep the trail available through a durable link.

Reports are short and in German. End every turn with the structured status block in [Autopilot-full](../playbooks/autopilot-full.md): `state` is `code-ready`, `blocked`, or `failed`, plus `prUrl`, `headSha`, `gates` with exit codes, and `trailUrl`. A code-ready report needs a PR URL, full current head SHA, and every required gate green. A blocked report names what is missing. Never treat a turn ending as merge permission.

## Keep live work local

Receive no live credentials or real customer data. Do not deploy, run remote database migrations, perform live data steps, merge, or change access. If a task requires any of these, hand it to the local root. Never upload customer data into Cloud.

The local root follows the project's release rule after its pstack verdict:

1. Merge and deploy with rollback are free after green where the repository permits them.
2. Migrations and data steps also require a recorded restore point, a dry run on a copy, no deletion, and a fresh independent reviewer's OK.
3. Sending real customer data to a new recipient, permanent deletes, new access, keys, and logins require the operator's decision.

Changes touching real customer data need an Opus or Oracle security review locally before merge. This contract grants no release permission where the repository has none.
