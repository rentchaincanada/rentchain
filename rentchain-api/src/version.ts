import fs from "fs";
import path from "path";

export function getVersion() {
  if (process.env.RENTCHAIN_VERSION) return process.env.RENTCHAIN_VERSION;

  try {
    const pkgPath = path.resolve(process.cwd(), "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}
