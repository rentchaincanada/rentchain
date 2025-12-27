/* eslint-disable @typescript-eslint/no-var-requires */
const http = require("http");

const BASE = process.env.SMOKE_BASE || "http://localhost:3000";
const unauthTargets = ["/api/dashboard/overview", "/api/dashboard/ai-portfolio-summary"];

async function hit(path) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE}${path}`, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({ status: res.statusCode || 0, body: data });
      });
    });
    req.on("error", reject);
  });
}

async function main() {
  const targets = ["/health", "/health/version", "/health/ready"];
  for (const t of targets) {
    const res = await hit(t);
    if (res.status >= 400) {
      console.error(`[smoke] ${t} failed: ${res.status} ${res.body}`);
      process.exit(1);
    }
    console.log(`[smoke] ${t} ok: ${res.status}`);
  }
  for (const t of unauthTargets) {
    const res = await hit(t);
    if (res.status !== 401 && res.status !== 403) {
      console.error(`[smoke] ${t} expected auth rejection, got ${res.status}`);
      process.exit(1);
    }
    console.log(`[smoke] ${t} auth gate ok: ${res.status}`);
  }
  console.log("[smoke] all checks passed");
}

main().catch((err) => {
  console.error("[smoke] error", err);
  process.exit(1);
});
