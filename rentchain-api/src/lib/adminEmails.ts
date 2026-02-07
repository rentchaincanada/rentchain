const DEFAULT_ADMIN_EMAILS = ["rentchain.ca@gmail.com"];

function normalize(email: string): string {
  return String(email || "").trim().toLowerCase();
}

export function getAdminEmails(): string[] {
  const raw = String(process.env.ADMIN_EMAILS || "").trim();
  if (!raw) return DEFAULT_ADMIN_EMAILS;
  return raw
    .split(",")
    .map((v) => normalize(v))
    .filter((v) => v);
}

export function isAdminEmail(email?: string | null): boolean {
  const e = normalize(String(email || ""));
  if (!e) return false;
  return getAdminEmails().includes(e);
}
