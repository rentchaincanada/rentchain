import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);

const packageRoots = [
  "rentchain-api",
  "rentchain-frontend",
  "status-frontend",
  "rentchain-ai-agent",
];

const disallowedLockfiles = [
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lock",
  "bun.lockb",
  "npm-shrinkwrap.json",
];

const workflowFiles = [
  ".github/workflows/ci.yml",
  ".github/workflows/codex-autofix-ci.yml",
  ".github/workflows/codex-mission-runner.yml",
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function fail(message) {
  console.error(`[supply-chain-governance] ${message}`);
  process.exitCode = 1;
}

for (const root of packageRoots) {
  const packageJsonPath = `${root}/package.json`;
  const lockfilePath = `${root}/package-lock.json`;

  if (!fs.existsSync(path.join(repoRoot, packageJsonPath))) {
    fail(`${packageJsonPath} is missing.`);
    continue;
  }

  if (!fs.existsSync(path.join(repoRoot, lockfilePath))) {
    fail(`${lockfilePath} is missing. RentChain package roots must use npm lockfiles.`);
    continue;
  }

  const pkg = readJson(packageJsonPath);
  const lock = readJson(lockfilePath);

  if (lock.lockfileVersion !== 3) {
    fail(`${lockfilePath} must use npm lockfileVersion 3.`);
  }

  if (pkg.packageManager && !String(pkg.packageManager).startsWith("npm@")) {
    fail(`${packageJsonPath} declares non-npm packageManager ${pkg.packageManager}.`);
  }
}

for (const lockfile of disallowedLockfiles) {
  for (const root of ["", ...packageRoots]) {
    const candidate = path.join(repoRoot, root, lockfile);
    if (fs.existsSync(candidate)) {
      fail(`Unexpected package-manager lockfile found: ${path.relative(repoRoot, candidate)}`);
    }
  }
}

for (const workflowFile of workflowFiles) {
  const contents = fs.readFileSync(path.join(repoRoot, workflowFile), "utf8");
  if (contents.includes("npm install")) {
    fail(`${workflowFile} must use npm ci for deterministic installs.`);
  }
}

if (!process.exitCode) {
  console.log("[supply-chain-governance] npm lockfile and install discipline verified.");
}
