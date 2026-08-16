#!/usr/bin/env node

import fs from "node:fs";

const readJson = (path) => JSON.parse(fs.readFileSync(path, "utf8"));
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
};
const stable = (value) => JSON.stringify(canonical(value));
const DEPENDENCY_FIELDS = Object.freeze(["dependencies", "devDependencies", "optionalDependencies"]);
const APPROVED_NODE_ENGINE_TRANSITIONS = new Set([">=20 <21->>=24 <25"]);

function withoutGovernedFields(manifest) {
  const copy = { ...manifest };
  for (const field of DEPENDENCY_FIELDS) delete copy[field];
  delete copy.engines;
  return copy;
}

function validateNodeEngineTransition(trusted, candidate) {
  if (trusted.engineStrict !== true || candidate.engineStrict !== true) {
    throw new Error("Package engineStrict must remain exactly true");
  }
  if (!trusted.engines || !candidate.engines || stable(Object.keys(trusted.engines).sort()) !== stable(["node"]) || stable(Object.keys(candidate.engines).sort()) !== stable(["node"])) {
    throw new Error("Package engines must contain exactly the protected node field");
  }
  const trustedNode = trusted.engines.node;
  const candidateNode = candidate.engines.node;
  if (typeof trustedNode !== "string" || typeof candidateNode !== "string") {
    throw new Error("Package engines.node must be an exact string");
  }
  if (candidateNode !== trustedNode && !APPROVED_NODE_ENGINE_TRANSITIONS.has(`${trustedNode}->${candidateNode}`)) {
    throw new Error(`Unapproved Node engine transition: ${trustedNode} -> ${candidateNode}`);
  }
}

function withoutRootGovernedFields(root) {
  const copy = { ...root };
  for (const field of DEPENDENCY_FIELDS) delete copy[field];
  delete copy.engines;
  return copy;
}

function withoutPackages(lock) {
  const copy = { ...lock };
  delete copy.packages;
  return copy;
}

export function validateRuntimeDependencyFiles({ trustedPackagePath, trustedLockPath, candidatePackagePath, candidateLockPath }) {
  const trusted = readJson(trustedPackagePath);
  const trustedLock = readJson(trustedLockPath);
  const candidate = readJson(candidatePackagePath);
  const lock = readJson(candidateLockPath);
  validateNodeEngineTransition(trusted, candidate);
  if (stable(withoutGovernedFields(candidate)) !== stable(withoutGovernedFields(trusted))) {
    throw new Error("Only governed dependency maps and the approved Node engine transition may differ from the trusted package manifest");
  }
  if (trustedLock.lockfileVersion !== 3 || !trustedLock.packages || !trustedLock.packages[""] || lock.lockfileVersion !== 3 || !lock.packages || !lock.packages[""]) {
    throw new Error("A valid npm lockfileVersion 3 root package is required");
  }
  if (stable(withoutPackages(lock)) !== stable(withoutPackages(trustedLock))) {
    throw new Error("Unrelated lockfile metadata may not differ from the trusted lockfile");
  }
  if (stable(withoutRootGovernedFields(lock.packages[""])) !== stable(withoutRootGovernedFields(trustedLock.packages[""]))) {
    throw new Error("Unrelated lockfile root metadata may not differ from the trusted lockfile");
  }
  if (stable(trustedLock.packages[""].engines || {}) !== stable(trusted.engines) || stable(lock.packages[""].engines || {}) !== stable(candidate.engines)) {
    throw new Error("Lockfile root engines must match package.json");
  }
  for (const field of DEPENDENCY_FIELDS) {
    if (stable(trustedLock.packages[""][field] || {}) !== stable(trusted[field] || {})) {
      throw new Error(`Trusted lockfile root ${field} does not match its package.json`);
    }
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
    if (mode === "dependencies" && args.length === 4) {
      validateRuntimeDependencyFiles({ trustedPackagePath: args[0], trustedLockPath: args[1], candidatePackagePath: args[2], candidateLockPath: args[3] });
    } else {
      throw new Error("usage: validate-runtime-dependency-policy.mjs dependencies <trusted-package> <trusted-lock> <candidate-package> <candidate-lock>");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
