#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
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
  process.stdout.write("CLOUD_OWNER_BOOTSTRAP=ok\n");
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
