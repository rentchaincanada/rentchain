import { spawnSync } from "node:child_process";

function pickBuildId() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (sha && sha.length >= 8) return sha.slice(0, 12);
  const dep = process.env.VERCEL_DEPLOYMENT_ID;
  if (dep && dep.length >= 8) return dep.slice(0, 12);
  const ts = new Date().toISOString().replace(/\D/g, "").slice(0, 12);
  return ts;
}

const buildId = pickBuildId();
const env = {
  ...process.env,
  VITE_BUILD_ID: buildId,
};

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: "inherit", env });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`[build] VITE_BUILD_ID=${buildId}`);

const npmExecPath = process.env.npm_execpath;
if (npmExecPath) {
  run(process.execPath, [npmExecPath, "run", "build:app"]);
} else {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  run(npmCmd, ["run", "build:app"]);
}
