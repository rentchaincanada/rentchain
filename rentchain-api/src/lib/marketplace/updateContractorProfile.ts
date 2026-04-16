import { db } from "../../config/firebase";
import { normalizeContractorProfile } from "./loadContractorProfiles";

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

export async function updateContractorProfile(
  contractorId: string,
  patch: {
    displayName?: string;
    businessName?: string | null;
    serviceCategories?: string[];
    serviceAreas?: string[];
    availabilityStatus?: string | null;
    contact?: { email?: string | null; phone?: string | null } | null;
    summary?: string | null;
    metadata?: { internalNotes?: string | null; landlordNetworkIds?: string[] | null; createdByLandlordId?: string | null } | null;
  }
) {
  const ref = db.collection("contractorProfiles").doc(asString(contractorId, 120));
  const snap = await ref.get();
  if (!snap.exists) return null;
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const nextPatch: Record<string, unknown> = {
    updatedAt: nowIso,
    updatedAtMs: nowMs,
  };
  if (patch.displayName !== undefined) {
    nextPatch.displayName = asString(patch.displayName, 180);
    nextPatch.contactName = asString(patch.displayName, 180);
  }
  if (patch.businessName !== undefined) nextPatch.businessName = asOptionalString(patch.businessName, 180);
  if (patch.serviceCategories !== undefined) nextPatch.serviceCategories = uniqueStrings(patch.serviceCategories, 20).map((value) => value.toLowerCase());
  if (patch.serviceAreas !== undefined) nextPatch.serviceAreas = uniqueStrings(patch.serviceAreas, 50);
  if (patch.availabilityStatus !== undefined) {
    const availability = asString(patch.availabilityStatus, 40).toLowerCase();
    nextPatch.availabilityStatus = availability;
    nextPatch.isActive = availability !== "inactive";
  }
  if (patch.contact?.email !== undefined || patch.contact?.phone !== undefined) {
    const currentContact = typeof (snap.data() as any)?.contact === "object" && (snap.data() as any)?.contact !== null
      ? (snap.data() as any).contact
      : {};
    nextPatch.contact = {
      email: patch.contact?.email !== undefined ? asOptionalString(patch.contact?.email, 320) : asOptionalString(currentContact?.email, 320),
      phone: patch.contact?.phone !== undefined ? asOptionalString(patch.contact?.phone, 80) : asOptionalString(currentContact?.phone, 80),
    };
    if (patch.contact?.email !== undefined) nextPatch.email = asOptionalString(patch.contact?.email, 320);
    if (patch.contact?.phone !== undefined) nextPatch.phone = asOptionalString(patch.contact?.phone, 80);
  }
  if (patch.summary !== undefined) {
    nextPatch.summary = asOptionalString(patch.summary, 2000);
    nextPatch.bio = asOptionalString(patch.summary, 2000);
  }
  if (patch.metadata !== undefined) {
    const currentMetadata =
      typeof (snap.data() as any)?.metadata === "object" && (snap.data() as any)?.metadata !== null
        ? (snap.data() as any).metadata
        : {};
    const landlordNetworkIds =
      patch.metadata?.landlordNetworkIds !== undefined
        ? uniqueStrings(patch.metadata.landlordNetworkIds, 100)
        : uniqueStrings(currentMetadata?.landlordNetworkIds ?? (snap.data() as any)?.invitedByLandlordIds, 100);
    nextPatch.metadata = {
      ...currentMetadata,
      internalNotes:
        patch.metadata?.internalNotes !== undefined
          ? asOptionalString(patch.metadata.internalNotes, 2000)
          : asOptionalString(currentMetadata?.internalNotes, 2000),
      landlordNetworkIds,
      createdByLandlordId:
        patch.metadata?.createdByLandlordId !== undefined
          ? asOptionalString(patch.metadata.createdByLandlordId, 120)
          : asOptionalString(currentMetadata?.createdByLandlordId, 120),
    };
    nextPatch.invitedByLandlordIds = landlordNetworkIds;
  }
  await ref.set(nextPatch, { merge: true });
  const refreshed = await ref.get();
  return normalizeContractorProfile(ref.id, refreshed.data());
}
