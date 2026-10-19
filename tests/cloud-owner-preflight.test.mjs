import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const script = resolve("scripts/cloud-owner-preflight.mjs");
const required = ["poteto-mode/references/cloud-owner-contract.md", "deslop/SKILL.md", "no-comments/SKILL.md", "principle-prove-it-works/SKILL.md"];

test("Cloud owner preflight checks the installed checkout through its CLI", () => {
  const root = mkdtempSync(join(tmpdir(), "pstack-preflight-"));
  try {
    const fork = join(root, "fork");
    const project = join(root, "project");
    const skills = join(fork, "plugins/pstack/skills");
    mkdirSync(skills, { recursive: true });
    mkdirSync(join(project, ".agents/skills"), { recursive: true });
    for (const path of required) {
      const file = join(skills, path);
      mkdirSync(resolve(file, ".."), { recursive: true });
      writeFileSync(file, `---\nname: ${path.split("/")[0]}\ndescription: fixture\n---\nskill\n`);
    }
    writeFileSync(join(skills, "poteto-mode/SKILL.md"), "---\nname: poteto-mode\ndescription: fixture\n---\n");
    writeFileSync(join(project, "AGENTS.md"), "project rules\n");
    execFileSync("git", ["init", "-q", fork]);
    execFileSync("git", ["-C", fork, "-c", "user.name=Preflight", "-c", "user.email=preflight@example.invalid", "commit", "--allow-empty", "-qm", "fixture"]);
    const run = (...args) => spawnSync(process.execPath, [script, ...args, ...(args.length === 2 ? ["--prepare", "--only", "deslop,no-comments,principle-prove-it-works"] : [])], { encoding: "utf8" });
    const blocked = (result) => {
      assert.notEqual(result.status, 0);
      assert.equal(JSON.parse(result.stderr).preflight, "blocked");
      assert.ok(JSON.parse(result.stderr).reason);
    };
    const ok = run(fork, project);
    assert.equal(ok.status, 0, ok.stderr);
    const evidence = JSON.parse(ok.stdout);
    assert.equal(evidence.forkCommit, execFileSync("git", ["-C", fork, "rev-parse", "HEAD"], { encoding: "utf8" }).trim());
    assert.deepEqual(evidence.skillPaths, { source: "plugins/pstack/skills", installed: ".agents/skills" });
    assert.deepEqual(evidence.availableFiles, [...required.map(path => `.agents/skills/${path}`), "AGENTS.md"]);
    assert.ok(evidence.bootstrapInstructions.includes(join(skills, "poteto-mode/references/cloud-owner-contract.md")));
    assert.equal(evidence.preflight, "ok");
    assert.match(evidence.bootstrapInstructions, /only these skills/);
    const catalog = join(root, "catalog.json");
    const gate = (...args) => spawnSync(process.execPath, [script, fork, project, "--only", "deslop,no-comments,principle-prove-it-works", ...args], { encoding: "utf8" });
    assert.equal(gate().status, 0);
    writeFileSync(catalog, JSON.stringify({ authority: "executor", skills: [] }));
    assert.equal(gate("--catalog", catalog).status, 0);
    writeFileSync(catalog, JSON.stringify({ authority: "executor", skills: evidence.expectedSkills }));
    assert.equal(gate("--catalog", catalog).status, 0);
    const repoSkill = join(project, ".agents/skills/ui-standard");
    mkdirSync(repoSkill);
    writeFileSync(join(repoSkill, "SKILL.md"), "---\nname: ui-standard\ndescription: repo skill\n---\n");
    assert.equal(gate("--catalog", catalog).status, 0);
    writeFileSync(catalog, JSON.stringify({ authority: "executor", skills: [...evidence.expectedSkills, "ui-standard"] }));
    assert.equal(gate("--catalog", catalog).status, 0);
    writeFileSync(catalog, JSON.stringify({ authority: "cloud", skills: evidence.expectedSkills }));
    assert.equal(gate("--catalog", catalog).status, 0);
    const installed = [...new Set(required.map(path => path.split("/")[0]))].map(skill => `.agents/skills/${skill}`);
    assert.deepEqual([...evidence.linkedSkills].sort(), [...installed].sort());
    assert.deepEqual(JSON.parse(run(fork, project).stdout).linkedSkills, []);
    const slot = join(project, installed[0]);
    rmSync(slot);
    symlinkSync(join(skills, "missing"), slot);
    assert.deepEqual(JSON.parse(run(fork, project).stdout).linkedSkills, [installed[0]]);
    rmSync(slot);
    symlinkSync(join(skills, "deslop"), slot);
    assert.deepEqual(JSON.parse(run(fork, project).stdout).linkedSkills, [installed[0]]);
    rmSync(slot);
    writeFileSync(slot, "preserve file\n");
    const conflict = run(fork, project);
    blocked(conflict);
    assert.match(JSON.parse(conflict.stderr).reason, /existing file or directory; preserved/);
    assert.equal(readFileSync(slot, "utf8"), "preserve file\n");
    rmSync(slot);
    mkdirSync(slot);
    writeFileSync(join(slot, "keep"), "preserve directory\n");
    blocked(run(fork, project));
    assert.equal(readFileSync(join(slot, "keep"), "utf8"), "preserve directory\n");
    rmSync(slot, { recursive: true });
    assert.equal(run(fork, project).status, 0);
    blocked(run());
    blocked(run(fork, project, "extra"));
    blocked(run(join(root, "missing"), project));
    for (const skill of required.slice(1)) {
      const missing = join(skills, skill);
      rmSync(missing);
      blocked(run(fork, project));
      writeFileSync(missing, `---\nname: ${skill.split("/")[0]}\ndescription: fixture\n---\n`);
    }
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
    rmSync(join(project, ".agents/skills"), { recursive: true });
    symlinkSync(join(root, "fork-sibling"), join(project, ".agents/skills"));
    blocked(run(fork, project));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
