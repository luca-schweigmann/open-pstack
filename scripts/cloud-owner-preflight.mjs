#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { lstatSync, mkdirSync, readFileSync, readlinkSync, readdirSync, realpathSync, statSync, symlinkSync, unlinkSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

try {
  const [forkPath, projectPath, ...options] = process.argv.slice(2);
  let only = "poteto-mode";
  let catalogPath;
  for (let index = 0; index < options.length; index++) {
    const option = options[index];
    if (option === "--prepare") continue;
    if (option === "--only" && options[index + 1]) only = options[++index];
    else if (option === "--catalog" && options[index + 1]) catalogPath = options[++index];
    else throw new Error("Usage: cloud-owner-preflight.mjs <fork-checkout> <project-checkout> [--prepare] [--only a,b,c] [--catalog <executor-catalog.json>]");
  }
  if (!forkPath || !projectPath || !/^[a-z0-9][a-z0-9-]*(,[a-z0-9][a-z0-9-]*)*$/.test(only)) {
    throw new Error("Provide fork/project checkouts and comma-separated skill directory names");
  }
  const selected = [...new Set(["poteto-mode", ...only.split(",")])];
  const forkRoot = realpathSync(forkPath);
  const projectRoot = realpathSync(projectPath);
  const forkCommit = execFileSync("git", ["-C", forkRoot, "rev-parse", "--verify", "HEAD^{commit}"], { encoding: "utf8" }).trim();
  const sourceSkills = join(forkRoot, "plugins/pstack/skills");
  const installedSkills = join(projectRoot, ".agents/skills");
  const required = ["poteto-mode/references/cloud-owner-contract.md", ...selected.filter(name => name !== "poteto-mode").map(name => `${name}/SKILL.md`)];
  const linkedSkills = [];
  const forkSkills = new Set();
  mkdirSync(installedSkills, { recursive: true });
  const installedRelative = relative(projectRoot, realpathSync(installedSkills));
  if (isAbsolute(installedRelative) || installedRelative === ".." || installedRelative.startsWith(`..${sep}`)) {
    throw new Error("Installed skills directory resolves outside the project checkout");
  }
  const pointsIntoFork = (path, subdir = "") => [join(forkRoot, subdir), resolve(forkPath, subdir)].some(root => {
    const fromFork = relative(root, path);
    return !isAbsolute(fromFork) && fromFork !== ".." && !fromFork.startsWith(`..${sep}`);
  });
  for (const skill of readdirSync(installedSkills)) {
    const installed = join(installedSkills, skill);
    if (!selected.includes(skill) && lstatSync(installed).isSymbolicLink() && pointsIntoFork(resolve(installedSkills, readlinkSync(installed)), "plugins/pstack/skills")) {
      unlinkSync(installed);
    }
  }
  for (const skill of selected) {
    const source = join(sourceSkills, skill);
    const installed = join(installedSkills, skill);
    let resolvedSource;
    try { resolvedSource = realpathSync(source); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      if (!statSync(join(installed, "SKILL.md")).isFile()) throw new Error(`Missing repo skill: ${skill}`);
      continue;
    }
    const forkRelative = relative(forkRoot, resolvedSource);
    if (!statSync(source).isDirectory() || isAbsolute(forkRelative) || forkRelative === ".." || forkRelative.startsWith(`..${sep}`)) {
      throw new Error(`Skill directory does not resolve inside the fork checkout: ${skill}`);
    }
    forkSkills.add(skill);
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
      const target = resolve(installedSkills, readlinkSync(installed));
      if (target === source) continue;
      if (!pointsIntoFork(target)) throw new Error(`Skill link conflicts with an existing link outside the fork; preserved: .agents/skills/${skill}`);
      unlinkSync(installed);
    }
    symlinkSync(source, installed);
    linkedSkills.push(relative(projectRoot, installed));
  }
  const availableFiles = [];
  for (const skill of required) {
    const installed = join(installedSkills, skill);
    if (forkSkills.has(skill.split("/")[0]) && (!pointsIntoFork(realpathSync(installed)) || realpathSync(installed) !== realpathSync(join(sourceSkills, skill)))) {
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
  const bootstrapInstructions = `Read ${join(sourceSkills, "poteto-mode/references/cloud-owner-contract.md")}, project AGENTS.md, the slice inputs, and only these skills from ${installedSkills}: ${selected.filter(name => name !== "poteto-mode").join(", ") || "none"}. Follow the task's delegation limits.`;
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
