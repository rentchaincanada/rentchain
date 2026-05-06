import { Router } from "express";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { deriveIdentityProfile } from "../lib/identityLayer/deriveIdentityProfile";
import { deriveNetworkParticipantProfile } from "../lib/networkParticipants/deriveNetworkParticipantProfile";
import type {
  NetworkParticipantProfile,
  NetworkParticipantStatus,
  NetworkParticipantType,
} from "../lib/networkParticipants/networkParticipantTypes";

const router = Router();
const PARTICIPANT_TYPES = new Set<NetworkParticipantType>([
  "landlord",
  "operator",
  "lender",
  "insurer",
  "auditor",
  "regulator",
  "contractor",
  "institutional_partner",
  "review_actor",
]);
const STATUSES = new Set<NetworkParticipantStatus>(["verified", "partially_verified", "review_required", "blocked", "unknown"]);

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function landlordIdFromReq(req: any) {
  return asString(req.user?.landlordId || req.user?.id || req.user?.sub, 240);
}

async function loadLandlordCollection(collectionName: string, landlordId: string) {
  const byId = new Map<string, any>();
  async function collect(field: "landlordId" | "ownerId" | "userId" | "createdByLandlordId") {
    const snap = await db.collection(collectionName).where(field, "==", landlordId).get().catch(() => null);
    for (const doc of snap?.docs || []) byId.set(doc.id, { id: doc.id, ...((doc.data() as any) || {}) });
  }
  await Promise.all([collect("landlordId"), collect("ownerId"), collect("userId"), collect("createdByLandlordId")]);
  return Array.from(byId.values()).filter((record) =>
    [record?.landlordId, record?.ownerId, record?.userId, record?.createdByLandlordId].some((value) => asString(value, 240) === landlordId)
  );
}

function normalizedParticipantType(value: unknown): NetworkParticipantType | "" {
  const raw = asString(value, 80) as NetworkParticipantType;
  return PARTICIPANT_TYPES.has(raw) ? raw : "";
}

function profileMatches(profile: NetworkParticipantProfile, id: string) {
  return profile.participantId === id;
}

function identityProfiles(input: {
  participantType: NetworkParticipantType;
  participantId: string;
  tenants: any[];
  properties: any[];
  organizations: any[];
  reviews: any[];
  consents: any[];
  events: any[];
  registryStatuses: any[];
}) {
  const profiles = [];
  if (input.participantType === "landlord") {
    profiles.push(
      deriveIdentityProfile({
        identityType: "organization",
        identityId: input.participantId || "landlord",
        organization: { id: input.participantId || "landlord", organizationId: input.participantId || "landlord" },
        consentRecords: input.consents,
        reviewSessions: input.reviews,
        canonicalEvents: input.events,
      })
    );
  }
  if (input.participantType === "operator" || input.participantType === "review_actor") {
    profiles.push(
      deriveIdentityProfile({
        identityType: input.participantType === "operator" ? "operator" : "review_actor",
        identityId: input.participantId,
        operator: input.reviews[0] || null,
        consentRecords: input.consents,
        reviewSessions: input.reviews,
        canonicalEvents: input.events,
      })
    );
  }
  if (input.participantType === "contractor") {
    profiles.push(
      deriveIdentityProfile({
        identityType: "organization",
        identityId: input.participantId || "contractor",
        organization: { id: input.participantId || "contractor", organizationId: input.participantId || "contractor" },
        consentRecords: input.consents,
        reviewSessions: input.reviews,
        canonicalEvents: input.events,
      })
    );
  }
  if (["lender", "insurer", "auditor", "regulator", "institutional_partner"].includes(input.participantType)) {
    profiles.push(
      deriveIdentityProfile({
        identityType: "organization",
        identityId: input.participantId || input.participantType,
        organization: { id: input.participantId || input.participantType, organizationId: input.participantId || input.participantType },
        consentRecords: input.consents,
        reviewSessions: input.reviews,
        canonicalEvents: input.events,
      })
    );
  }
  return profiles;
}

async function buildProfiles(landlordId: string, filters: { participantType: NetworkParticipantType | ""; participantId: string }) {
  const [tenants, properties, organizations, reviews, evidencePacks, sharingRooms, consents, events, registryStatuses, contractors, settlementRecords, regulatoryRecords] =
    await Promise.all([
      loadLandlordCollection("tenants", landlordId),
      loadLandlordCollection("properties", landlordId),
      loadLandlordCollection("organizations", landlordId),
      loadLandlordCollection("operatorReviewSessions", landlordId),
      loadLandlordCollection("evidencePacks", landlordId),
      loadLandlordCollection("institutionalSharingRooms", landlordId),
      loadLandlordCollection("consents", landlordId),
      loadLandlordCollection("events", landlordId),
      loadLandlordCollection("propertyRegistryStatuses", landlordId),
      loadLandlordCollection("contractorProfiles", landlordId),
      loadLandlordCollection("settlementReadiness", landlordId),
      loadLandlordCollection("regulatoryProfiles", landlordId),
    ]);

  const types: NetworkParticipantType[] = filters.participantType
    ? [filters.participantType]
    : ["landlord", "operator", "lender", "insurer", "auditor", "regulator", "contractor", "institutional_partner", "review_actor"];

  return types.map((participantType) => {
    const scopedSharingRooms =
      participantType === "lender" || participantType === "insurer" || participantType === "auditor" || participantType === "regulator"
        ? sharingRooms.filter((room) => asString(room.accessControls?.institutionType || room.institutionType, 80) === participantType)
        : sharingRooms;
    const scopedReviews =
      participantType === "operator" || participantType === "review_actor"
        ? reviews.filter((review) => !filters.participantId || [review.id, review.actorId, review.openedById, review.userId].map((value) => asString(value, 500)).includes(filters.participantId))
        : reviews;
    const scopedContractors =
      participantType === "contractor"
        ? contractors.filter((contractor) => !filters.participantId || [contractor.id, contractor.contractorId].map((value) => asString(value, 500)).includes(filters.participantId))
        : [];

    return deriveNetworkParticipantProfile({
      landlordId,
      participantType,
      participantId: filters.participantId,
      identityProfiles: identityProfiles({
        participantType,
        participantId: filters.participantId,
        tenants,
        properties,
        organizations,
        reviews: scopedReviews,
        consents,
        events,
        registryStatuses,
      }),
      sharingRooms: scopedSharingRooms,
      operatorReviewSessions: scopedReviews,
      evidencePacks,
      settlementReadiness: settlementRecords[0] || null,
      regulatoryProfiles: regulatoryRecords,
      canonicalEvents: events,
      contractorProfiles: scopedContractors,
    });
  });
}

router.get("/network-participants", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const participantType = normalizedParticipantType(req.query?.participantType);
    const participantId = asString(req.query?.participantId, 500);
    const status = asString(req.query?.status, 80) as NetworkParticipantStatus;
    let participants = await buildProfiles(landlordId, { participantType, participantId });
    if (status && STATUSES.has(status)) participants = participants.filter((profile) => profile.status === status);
    return res.json({ ok: true, participants });
  } catch (err: any) {
    console.error("[landlord-network-participants] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "NETWORK_PARTICIPANTS_FAILED" });
  }
});

router.get("/network-participants/:participantId", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    const participantId = decodeURIComponent(asString(req.params?.participantId, 500));
    if (!landlordId || !participantId) return res.status(400).json({ ok: false, error: "NETWORK_PARTICIPANT_ID_REQUIRED" });
    const participants = await buildProfiles(landlordId, { participantType: "", participantId: "" });
    const profile = participants.find((participant) => profileMatches(participant, participantId));
    if (!profile) return res.status(404).json({ ok: false, error: "NETWORK_PARTICIPANT_NOT_FOUND" });
    return res.json({ ok: true, participant: profile });
  } catch (err: any) {
    console.error("[landlord-network-participants] get failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "NETWORK_PARTICIPANT_GET_FAILED" });
  }
});

export default router;
