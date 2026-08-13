#!/usr/bin/env node

import fs from "node:fs";
import { execFileSync } from "node:child_process";

export const PROTECTED_BUILD_FILES = Object.freeze(["rentchain-api/Dockerfile"]);

const readJson = (path) => JSON.parse(fs.readFileSync(path, "utf8"));
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
};
const stable = (value) => JSON.stringify(canonical(value));

function withoutDependencies(manifest) {
  const copy = { ...manifest };
  delete copy.dependencies;
  delete copy.devDependencies;
  delete copy.optionalDependencies;
  return copy;
}

export function validateProtectedFiles({ repository, trustedSha, sourceSha }) {
  execFileSync("git", ["-C", repository, "diff", "--quiet", trustedSha, sourceSha, "--", ...PROTECTED_BUILD_FILES], {
    stdio: "pipe",
  });
}

export function validateRuntimeDependencyFiles({ trustedPackagePath, trustedLockPath, candidatePackagePath, candidateLockPath }) {
  const trusted = readJson(trustedPackagePath);
  const trustedLock = readJson(trustedLockPath);
  const candidate = readJson(candidatePackagePath);
  const lock = readJson(candidateLockPath);
  if (stable(withoutDependencies(candidate)) !== stable(withoutDependencies(trusted))) {
    throw new Error("Only dependency maps may differ from the trusted package manifest");
  }
  if (lock.lockfileVersion !== 3 || !lock.packages || !lock.packages[""]) {
    throw new Error("A valid npm lockfileVersion 3 root package is required");
  }
  for (const field of ["dependencies", "devDependencies", "optionalDependencies"]) {
    if (stable(lock.packages[""][field] || {}) !== stable(candidate[field] || {})) {
      throw new Error(`Lockfile root ${field} does not match package.json`);
    }
  }
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (!path || !entry.resolved) continue;
    if (!String(entry.resolved).startsWith("https://registry.npmjs.org/")) {
      throw new Error(`Unapproved package source at ${path}`);
    }
    if (!entry.integrity || !String(entry.integrity).startsWith("sha512-")) {
      throw new Error(`Missing sha512 integrity at ${path}`);
    }
  }
  const installScripts = (document) => Object.entries(document.packages || {})
    .filter(([, entry]) => entry.hasInstallScript === true)
    .map(([path, entry]) => `${path}@${entry.version || "unknown"}`)
    .sort();
  if (stable(installScripts(lock)) !== stable(installScripts(trustedLock))) {
    throw new Error("PR dependency changes may not introduce or alter package install scripts");
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const [mode, ...args] = process.argv.slice(2);
    if (mode === "protected-files" && args.length === 3) {
      validateProtectedFiles({ repository: args[0], trustedSha: args[1], sourceSha: args[2] });
    } else if (mode === "dependencies" && args.length === 4) {
      validateRuntimeDependencyFiles({ trustedPackagePath: args[0], trustedLockPath: args[1], candidatePackagePath: args[2], candidateLockPath: args[3] });
    } else {
      throw new Error("usage: validate-runtime-dependency-policy.mjs <protected-files repo trusted-sha source-sha | dependencies trusted-package trusted-lock candidate-package candidate-lock>");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
