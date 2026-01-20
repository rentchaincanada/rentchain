import { execSync } from "node:child_process";

const pad = (value) => String(value).padStart(2, "0");
const now = new Date();
const buildId = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(
  now.getHours()
)}${pad(now.getMinutes())}`;

const env = { ...process.env, VITE_BUILD_ID: buildId };

execSync("tsc -b", { stdio: "inherit", env });
execSync("vite build", { stdio: "inherit", env });
