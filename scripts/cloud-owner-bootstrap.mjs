#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, realpathSync, writeFileSync, mkdirSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

try {
  const fork = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  if (git("-C", fork, "status", "--porcelain")) throw new Error("Fork checkout has local changes; preserved");
  const sha = git("-C", fork, "rev-parse", "HEAD");
  if (sha !== git("-C", fork, "rev-parse", "refs/remotes/origin/luca")) throw new Error("Fork is not at the fetched luca head");
  let project;
  try { project = git("rev-parse", "--show-toplevel"); } catch {}
  if (!project || realpathSync(project) === realpathSync(fork)) {
    const candidates = readdirSync("/workspace").map(name => join("/workspace", name))
      .filter(path => path !== fork && existsSync(join(path, ".git")));
    if (candidates.length !== 1) throw new Error("Project checkout missing or ambiguous");
    project = git("-C", candidates[0], "rev-parse", "--show-toplevel");
  }
  writeFileSync(join(homedir(), "open-pstack-sha.txt"), `${sha}\n`);
  process.stdout.write(`CLOUD_FORK_SHA=${sha}\nCLOUD_PROJECT=${project}\n`);
  execFileSync(process.execPath, [join(fork, "scripts/cloud-owner-preflight.mjs"), fork, project, "--prepare"], { stdio: "inherit" });
  const userSkills = join(homedir(), ".agents/skills");
  mkdirSync(userSkills, { recursive: true });
  for (const name of readdirSync(join(project, ".agents/skills"))) {
    const source = join(project, ".agents/skills", name);
    const target = join(userSkills, name);
    if (existsSync(target)) {
      if (realpathSync(target) !== realpathSync(source)) throw new Error(`User skill conflicts with project skill; preserved: ${name}`);
    } else {
      symlinkSync(source, target);
    }
  }
  process.stdout.write("CLOUD_OWNER_BOOTSTRAP=pending-catalog\n");
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
