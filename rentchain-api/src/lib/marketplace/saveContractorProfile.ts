import { db } from "../../firebase";
import { normalizeContractorProfile } from "./loadContractorProfiles";
import type { ContractorProfileV1 } from "./contractorTypes";

function asString(value: unknown, max = 400) {
  return String(value || "").trim().slice(0, max);
}

function asOptionalString(value: unknown, max = 400) {
  const next = asString(value, max);
  return next || null;
}

function uniqueStrings(input: unknown, max = 50) {
  if (!Array.isArray(input)) return [];
  const next = new Set<string>();
  for (const value of input) {
    const normalized = asString(value, 120);
    if (!normalized) continue;
    next.add(normalized);
    if (next.size >= max) break;
  }
  return Array.from(next);
}

export async function saveContractorProfile(input: {
  id?: string | null;
  userId?: string | null;
  displayName: string;
  businessName?: string | null;
  serviceCategories?: string[];
  serviceAreas?: string[];
  availabilityStatus?: string | null;
  contact?: { email?: string | null; phone?: string | null } | null;
  summary?: string | null;
  metadata?: { internalNotes?: string | null; landlordNetworkIds?: string[] | null; createdByLandlordId?: string | null } | null;
}) {
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const ref = input.id ? db.collection("contractorProfiles").doc(asString(input.id, 120)) : db.collection("contractorProfiles").doc();
  const payload = {
    id: ref.id,
    version: "v1",
    userId: asOptionalString(input.userId, 120),
    displayName: asString(input.displayName, 180),
    businessName: asOptionalString(input.businessName, 180),
    serviceCategories: uniqueStrings(input.serviceCategories, 20).map((value) => value.toLowerCase()),
    serviceAreas: uniqueStrings(input.serviceAreas, 50),
    availabilityStatus: asString(input.availabilityStatus || "active", 40).toLowerCase(),
    contact: {
      email: asOptionalString(input.contact?.email, 320),
      phone: asOptionalString(input.contact?.phone, 80),
    },
    summary: asOptionalString(input.summary, 2000),
    metadata: {
      internalNotes: asOptionalString(input.metadata?.internalNotes, 2000),
      landlordNetworkIds: uniqueStrings(input.metadata?.landlordNetworkIds, 100),
      createdByLandlordId: asOptionalString(input.metadata?.createdByLandlordId, 120),
    },
    contactName: asString(input.displayName, 180),
    email: asOptionalString(input.contact?.email, 320),
    phone: asOptionalString(input.contact?.phone, 80),
    bio: asOptionalString(input.summary, 2000),
    isActive: String(input.availabilityStatus || "active").toLowerCase() !== "inactive",
    invitedByLandlordIds: uniqueStrings(input.metadata?.landlordNetworkIds, 100),
    createdAt: nowIso,
    updatedAt: nowIso,
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
  };
  await ref.set(payload, { merge: false });
  return normalizeContractorProfile(ref.id, payload) as ContractorProfileV1;
}
