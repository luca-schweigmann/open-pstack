#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";

try {
  const [forkPath, projectPath, ...extra] = process.argv.slice(2);
  if (!forkPath || !projectPath || extra.length) {
    throw new Error("Usage: cloud-owner-preflight.mjs <fork-checkout> <project-checkout>");
  }
  const forkRoot = realpathSync(forkPath);
  const projectRoot = realpathSync(projectPath);
  const forkCommit = execFileSync("git", ["-C", forkRoot, "rev-parse", "--verify", "HEAD^{commit}"], { encoding: "utf8" }).trim();
  const sourceSkills = join(forkRoot, "plugins/pstack/skills");
  const installedSkills = join(projectRoot, ".agents/skills");
  const required = [
    "poteto-mode/SKILL.md",
    "poteto-mode/playbooks/autopilot-full.md",
    "poteto-mode/references/cloud-owner-contract.md",
    "deslop/SKILL.md",
    "no-comments/SKILL.md",
    "technical-writing/SKILL.md",
    "unslop/SKILL.md",
  ];
  const readFiles = [];
  for (const skill of required) {
    const installed = join(installedSkills, skill);
    const source = join(sourceSkills, skill);
    const resolvedSource = realpathSync(source);
    const resolvedInstalled = realpathSync(installed);
    const forkRelative = relative(forkRoot, resolvedSource);
    if (isAbsolute(forkRelative) || forkRelative === ".." || forkRelative.startsWith(`..${sep}`) || resolvedInstalled !== resolvedSource) {
      throw new Error(`Installed skill does not resolve to the fork checkout: ${skill}`);
    }
    if (!statSync(installed).isFile() || !readFileSync(installed, "utf8").trim()) {
      throw new Error(`Missing or empty skill: ${skill}`);
    }
    readFiles.push(relative(projectRoot, installed));
  }
  const projectRules = join(projectRoot, "AGENTS.md");
  if (!statSync(projectRules).isFile() || !readFileSync(projectRules, "utf8").trim()) {
    throw new Error("Missing or empty project AGENTS.md");
  }
  readFiles.push(relative(projectRoot, projectRules));
  process.stdout.write(`${JSON.stringify({
    preflight: "ok",
    forkCommit,
    skillPaths: { source: relative(forkRoot, sourceSkills), installed: relative(projectRoot, installedSkills) },
    readFiles,
  }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({ preflight: "blocked", reason: error.code ? `Filesystem or Git check failed (${error.code})` : error.message })}\n`);
  process.exitCode = 1;
}
