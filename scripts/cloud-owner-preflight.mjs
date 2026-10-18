#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { lstatSync, mkdirSync, readFileSync, readlinkSync, readdirSync, realpathSync, statSync, symlinkSync, unlinkSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

try {
  const [forkPath, projectPath, mode, catalogPath, ...extra] = process.argv.slice(2);
  if (!forkPath || !projectPath || extra.length || !([undefined, "--prepare", "--catalog"].includes(mode)) || (mode === "--catalog" ? !catalogPath : catalogPath)) {
    throw new Error("Usage: cloud-owner-preflight.mjs <fork-checkout> <project-checkout> [--prepare | --catalog <executor-catalog.json>]");
  }
  const forkRoot = realpathSync(forkPath);
  const projectRoot = realpathSync(projectPath);
  const forkCommit = execFileSync("git", ["-C", forkRoot, "rev-parse", "--verify", "HEAD^{commit}"], { encoding: "utf8" }).trim();
  const sourceSkills = join(forkRoot, "plugins/pstack/skills");
  const installedSkills = join(projectRoot, ".agents/skills");
  const required = ["poteto-mode/references/cloud-owner-contract.md", "deslop/SKILL.md", "no-comments/SKILL.md", "principle-prove-it-works/SKILL.md"];
  const linkedSkills = [];
  mkdirSync(installedSkills, { recursive: true });
  const installedRelative = relative(projectRoot, realpathSync(installedSkills));
  if (isAbsolute(installedRelative) || installedRelative === ".." || installedRelative.startsWith(`..${sep}`)) {
    throw new Error("Installed skills directory resolves outside the project checkout");
  }
  for (const skill of readdirSync(sourceSkills).filter(name => statSync(join(sourceSkills, name)).isDirectory())) {
    const source = join(sourceSkills, skill);
    const installed = join(installedSkills, skill);
    const resolvedSource = realpathSync(source);
    const forkRelative = relative(forkRoot, resolvedSource);
    if (!statSync(source).isDirectory() || isAbsolute(forkRelative) || forkRelative === ".." || forkRelative.startsWith(`..${sep}`)) {
      throw new Error(`Skill directory does not resolve inside the fork checkout: ${skill}`);
    }
    let existing;
    try {
      existing = lstatSync(installed);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (existing) {
      if (!existing.isSymbolicLink()) {
        throw new Error(`Skill link conflicts with an existing file or directory; preserved: .agents/skills/${skill}`);
      }
      if (resolve(installedSkills, readlinkSync(installed)) === source) continue;
      unlinkSync(installed);
    }
    symlinkSync(source, installed);
    linkedSkills.push(relative(projectRoot, installed));
  }
  const availableFiles = [];
  for (const skill of required) {
    const installed = join(installedSkills, skill);
    const source = join(sourceSkills, skill);
    const resolvedSource = realpathSync(source);
    const resolvedInstalled = realpathSync(installed);
    const forkRelative = relative(forkRoot, resolvedSource);
    if (isAbsolute(forkRelative) || forkRelative === ".." || forkRelative.startsWith(`..${sep}`) || resolvedInstalled !== resolvedSource) {
      throw new Error(`Installed skill does not resolve to the fork checkout: ${skill}`);
    }
    if (!statSync(installed).isFile() || statSync(installed).size === 0) {
      throw new Error(`Missing or empty skill: ${skill}`);
    }
    availableFiles.push(relative(projectRoot, installed));
  }
  const projectRules = join(projectRoot, "AGENTS.md");
  if (!statSync(projectRules).isFile() || !readFileSync(projectRules, "utf8").trim()) {
    throw new Error("Missing or empty project AGENTS.md");
  }
  availableFiles.push(relative(projectRoot, projectRules));
  const expectedSkills = readdirSync(installedSkills).flatMap(directory => {
    const file = join(installedSkills, directory, "SKILL.md");
    const text = readFileSync(file, "utf8");
    const name = /^name:\s*["']?([^"'\r\n]+?)["']?\s*$/m.exec(text)?.[1];
    if (!name) throw new Error(`Missing skill name: .agents/skills/${directory}/SKILL.md`);
    return [name];
  });
  let catalog = { status: "not-queried", gating: false };
  if (catalogPath) {
    try { catalog = { status: "reported", gating: false, response: JSON.parse(readFileSync(catalogPath === "-" ? 0 : catalogPath, "utf8")) }; }
    catch (error) { catalog = { status: "unavailable", gating: false, reason: error.message }; }
  }
  const bootstrapInstructions = `Read ${join(sourceSkills, "poteto-mode/SKILL.md")} completely. Select its playbook, name roles and gates before owner work. Read applicable repo SKILL.md files completely from ${installedSkills}; for UI use ui-standard/SKILL.md when present. Follow the task's delegation limits.`;
  process.stdout.write(`${JSON.stringify({
    preflight: "ok",
    scope: "readable-files-and-bootstrap-instructions",
    bootstrapInstructions,
    catalog,
    forkCommit,
    skillPaths: { source: relative(forkRoot, sourceSkills), installed: relative(projectRoot, installedSkills) },
    availableFiles,
    linkedSkills,
    expectedSkills,
  }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({ preflight: "blocked", reason: error.code ? `Filesystem or Git check failed (${error.code}): ${error.path ?? error.message}` : error.message })}\n`);
  process.exitCode = 1;
}
