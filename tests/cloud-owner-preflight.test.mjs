import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const script = resolve("scripts/cloud-owner-preflight.mjs");
const required = ["poteto-mode/SKILL.md", "poteto-mode/playbooks/autopilot-full.md", "poteto-mode/references/cloud-owner-contract.md", "deslop/SKILL.md", "no-comments/SKILL.md", "technical-writing/SKILL.md", "unslop/SKILL.md"];

test("Cloud owner preflight checks the installed checkout through its CLI", () => {
  const root = mkdtempSync(join(tmpdir(), "pstack-preflight-"));
  try {
    const fork = join(root, "fork");
    const project = join(root, "project");
    const skills = join(fork, "plugins/pstack/skills");
    mkdirSync(skills, { recursive: true });
    mkdirSync(join(project, ".agents"), { recursive: true });
    for (const path of required) {
      const file = join(skills, path);
      mkdirSync(resolve(file, ".."), { recursive: true });
      writeFileSync(file, "skill\n");
    }
    writeFileSync(join(project, "AGENTS.md"), "project rules\n");
    symlinkSync(skills, join(project, ".agents/skills"));
    execFileSync("git", ["init", "-q", fork]);
    execFileSync("git", ["-C", fork, "-c", "user.name=Preflight", "-c", "user.email=preflight@example.invalid", "commit", "--allow-empty", "-qm", "fixture"]);
    const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
    const blocked = (result) => {
      assert.notEqual(result.status, 0);
      assert.equal(JSON.parse(result.stderr).preflight, "blocked");
      assert.ok(!result.stderr.includes(root));
    };
    const ok = run(fork, project);
    assert.equal(ok.status, 0, ok.stderr);
    const evidence = JSON.parse(ok.stdout);
    assert.equal(evidence.forkCommit, execFileSync("git", ["-C", fork, "rev-parse", "HEAD"], { encoding: "utf8" }).trim());
    assert.deepEqual(evidence.skillPaths, { source: "plugins/pstack/skills", installed: ".agents/skills" });
    assert.deepEqual(evidence.readFiles, [...required.map(path => `.agents/skills/${path}`), "AGENTS.md"]);
    assert.ok(!ok.stdout.includes(root));
    blocked(run());
    blocked(run(fork, project, "extra"));
    blocked(run(join(root, "missing"), project));
    const file = join(skills, required[0]);
    writeFileSync(file, "");
    blocked(run(fork, project));
    rmSync(file);
    blocked(run(fork, project));
    const outside = join(root, "fork-sibling", "SKILL.md");
    mkdirSync(resolve(outside, ".."));
    writeFileSync(outside, "outside skill\n");
    symlinkSync(outside, file);
    blocked(run(fork, project));
    rmSync(file);
    const inside = join(skills, "shared.md");
    writeFileSync(inside, "inside skill\n");
    symlinkSync(inside, file);
    assert.equal(run(fork, project).status, 0);
    rmSync(join(project, "AGENTS.md"));
    blocked(run(fork, project));
    writeFileSync(join(project, "AGENTS.md"), "");
    blocked(run(fork, project));
    writeFileSync(join(project, "AGENTS.md"), "rules\n");
    rmSync(join(project, ".agents/skills"));
    symlinkSync(join(root, "fork-sibling"), join(project, ".agents/skills"));
    blocked(run(fork, project));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
