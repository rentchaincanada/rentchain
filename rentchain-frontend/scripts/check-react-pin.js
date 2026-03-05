import fs from "node:fs";
import path from "node:path";

const EXPECTED = "18.3.1";
const lockPath = path.resolve(process.cwd(), "package-lock.json");

function fail(message) {
  console.error(`[check-react-pin] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(lockPath)) {
  fail("package-lock.json not found. Run npm install first.");
}

let lock;
try {
  lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
} catch (error) {
  fail(`failed to read package-lock.json: ${String(error?.message || error)}`);
}

const pkgReact = lock?.packages?.["node_modules/react"]?.version;
const pkgReactDom = lock?.packages?.["node_modules/react-dom"]?.version;

if (pkgReact !== EXPECTED) {
  fail(`react version drift detected: expected ${EXPECTED}, found ${String(pkgReact || "missing")}`);
}

if (pkgReactDom !== EXPECTED) {
  fail(
    `react-dom version drift detected: expected ${EXPECTED}, found ${String(pkgReactDom || "missing")}`
  );
}

console.log(`[check-react-pin] OK: react=${pkgReact}, react-dom=${pkgReactDom}`);
