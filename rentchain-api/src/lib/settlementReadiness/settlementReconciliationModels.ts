import type {
  SettlementReference,
  SettlementReferenceStatus,
  SettlementReferenceType,
} from "./settlementReadinessTypes";

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

export function settlementIdPart(value: unknown): string {
  return asString(value, 500)
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function settlementAmount(cents: unknown, currency: unknown = "CAD") {
  const amount = Number(cents);
  const normalizedCurrency = asString(currency, 10).toUpperCase() || "CAD";
  if (!Number.isFinite(amount) || amount <= 0) return { currency: "CAD" as const, amount: null };
  return {
    currency: normalizedCurrency === "CAD" ? ("CAD" as const) : ("CAD" as const),
    amount: (Math.round(amount) / 100).toFixed(2),
  };
}

export function settlementReference(input: {
  idParts: unknown[];
  referenceType: SettlementReferenceType;
  status?: SettlementReferenceStatus;
  label: string;
  description: string;
  amountCents?: unknown;
  currency?: unknown;
  ledgerLinked?: boolean;
  reviewLinked?: boolean;
  evidenceLinked?: boolean;
  sourceId?: unknown;
  destination?: string | null;
  redacted?: boolean;
  redactionReason?: string | null;
  blockedReason?: string | null;
}): SettlementReference {
  const id = settlementIdPart(["settlement", input.referenceType, ...input.idParts].filter(Boolean).join(":"));
  return {
    settlementReferenceId: id || "settlement:unknown",
    referenceType: input.referenceType,
    status: input.status || "partially_verified",
    label: input.label,
    description: input.description,
    amountSummary: settlementAmount(input.amountCents, input.currency),
    traceability: {
      ledgerLinked: input.ledgerLinked === true,
      reviewLinked: input.reviewLinked === true,
      evidenceLinked: input.evidenceLinked === true,
    },
    sourceId: asString(input.sourceId, 500) || null,
    destination: input.destination || null,
    redacted: input.redacted === true,
    redactionReason: input.redactionReason || null,
    blockedReason: input.blockedReason || null,
  };
}
