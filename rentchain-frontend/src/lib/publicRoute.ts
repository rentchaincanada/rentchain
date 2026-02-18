const PUBLIC_PREFIXES = [
  "/",
  "/site",
  "/login",
  "/app/login",
  "/signup",
  "/invite",
  "/request-access",
  "/pricing",
  "/join-waitlist",
  "/about",
  "/legal",
  "/help",
  "/privacy",
  "/terms",
  "/acceptable-use",
  "/subprocessors",
  "/trust",
  "/security",
  "/accessibility",
  "/status",
  "/contact",
  "/micro-live",
  "/apply",
  "/verify",
  "/tenant/login",
  "/tenant/magic",
  "/tenant/invite",
];

export function isPublicRoutePath(pathname?: string | null): boolean {
  const path = String(pathname || "").trim() || "/";
  if (path === "/") return true;
  return PUBLIC_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
