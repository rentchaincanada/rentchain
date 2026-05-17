export type IdentityReferenceKind =
  | "application"
  | "event"
  | "ledgerEntry"
  | "lease"
  | "payment"
  | "property"
  | "record"
  | "tenant"
  | "unit";

const KIND_LABELS: Record<IdentityReferenceKind, string> = {
  application: "application",
  event: "event",
  ledgerEntry: "ledger entry",
  lease: "lease",
  payment: "payment",
  property: "property",
  record: "record",
  tenant: "tenant",
  unit: "unit",
};

function cleanString(value: unknown): string {
  return String(value ?? "").trim();
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function shortenInternalId(value: unknown, visiblePrefix = 8, visibleSuffix = 4): string {
  const text = cleanString(value);
  if (!text) return "not available";
  const minimumLength = visiblePrefix + visibleSuffix + 2;
  if (text.length <= minimumLength) return text;
  return `${text.slice(0, visiblePrefix)}...${text.slice(-visibleSuffix)}`;
}

export function formatInternalReference(kind: IdentityReferenceKind, value: unknown): string {
  return `Internal ${KIND_LABELS[kind]} ID: ${shortenInternalId(value)}`;
}

export function formatOperationalReference(kind: IdentityReferenceKind, value: unknown): string {
  return `${titleCase(KIND_LABELS[kind])} ref ${shortenInternalId(value)}`;
}

export function slugifyOperationalReference(parts: unknown[], fallback = "rentchain-export"): string {
  const slug = parts
    .map(cleanString)
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || fallback;
}
