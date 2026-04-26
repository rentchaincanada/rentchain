import { Router } from "express";
import { db } from "../config/firebase";
import { capabilitiesForPlan, requiredPlanForCapability } from "../services/entitlements/planCapabilities";
import { resolveLandlordAndTier } from "../lib/landlordResolver";
import { requireAuth } from "../middleware/requireAuth";
import { findContractorsForWorkOrder, normalizeServiceCategory } from "../lib/marketplace/findContractorsForWorkOrder";
import { loadContractorProfilesForActor, normalizeContractorProfile } from "../lib/marketplace/loadContractorProfiles";
import { saveContractorProfile } from "../lib/marketplace/saveContractorProfile";
import { updateContractorProfile } from "../lib/marketplace/updateContractorProfile";

const router = Router();

function asString(value: unknown, max = 400) {
  return String(value || "").trim().slice(0, max);
}

function asOptionalString(value: unknown, max = 400) {
  const next = asString(value, max);
  return next || null;
}

function normalizeRole(req: any) {
  const actorRole = asString(req.user?.actorRole, 40).toLowerCase();
  const role = asString(req.user?.role, 40).toLowerCase();
  return actorRole || role;
}

function isAdmin(req: any) {
  return normalizeRole(req) === "admin";
}

function isLandlord(req: any) {
  const role = normalizeRole(req);
  return role === "landlord" || role === "admin";
}

function getLandlordId(req: any) {
  return asString(req.user?.actorLandlordId || req.user?.landlordId || req.user?.id, 120);
}

function getUserId(req: any) {
  return asString(req.user?.id, 120);
}

async function hasMarketplaceCapability(req: any, capability: string) {
  if (isAdmin(req)) return true;
  const resolved = await resolveLandlordAndTier(req.user);
  const features = new Set(capabilitiesForPlan(resolved.tier));
  return features.has(capability);
}

async function ensureMarketplaceCapability(req: any, res: any, capability: string) {
  if (await hasMarketplaceCapability(req, capability)) return true;
  const resolved = await resolveLandlordAndTier(req.user);
  res.status(403).json({
    ok: false,
    error: "UPGRADE_REQUIRED",
    upgradeRequired: true,
    featureKey: capability,
    requiredPlan: requiredPlanForCapability(capability),
    plan: resolved.tier,
  });
  return false;
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

async function ensureAccessibleContractorProfile(contractorId: string, req: any) {
  const snap = await db.collection("contractorProfiles").doc(contractorId).get();
  if (!snap.exists) return null;
  const profile = normalizeContractorProfile(snap.id, snap.data());
  if (isAdmin(req)) return profile;
  const landlordId = getLandlordId(req);
  const networkIds = Array.isArray(profile.metadata?.landlordNetworkIds) ? profile.metadata?.landlordNetworkIds : [];
  if (!landlordId || (!networkIds.includes(landlordId) && profile.metadata?.createdByLandlordId !== landlordId)) {
    return null;
  }
  return profile;
}

router.get("/marketplace/contractors", requireAuth, async (req: any, res) => {
  try {
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    const items = await loadContractorProfilesForActor({
      role: isAdmin(req) ? "admin" : "landlord",
      landlordId: getLandlordId(req),
    });
    const limit = Math.max(1, Math.min(Number(req.query?.limit || 50), 100));
    const filtered = findContractorsForWorkOrder({
      contractors: items,
      serviceCategory: asOptionalString(req.query?.serviceCategory, 80),
      serviceArea: asOptionalString(req.query?.serviceArea, 120),
      availabilityStatus: asOptionalString(req.query?.availabilityStatus, 40),
      limit: 500,
    }).filter((item) => {
      if (!req.query?.serviceCategory && !req.query?.serviceArea && !req.query?.availabilityStatus) return true;
      return true;
    });
    const cursor = asString(req.query?.cursor, 120);
    const sorted = filtered.sort((left, right) => left.displayName.localeCompare(right.displayName));
    const startIndex = cursor ? Math.max(0, sorted.findIndex((item) => item.id === cursor) + 1) : 0;
    const page = sorted.slice(startIndex, startIndex + limit);
    const nextCursor = startIndex + limit < sorted.length ? page[page.length - 1]?.id || null : null;
    return res.json({ ok: true, items: page, nextCursor });
  } catch (err) {
    console.error("[marketplace/contractors] list failed", err);
    return res.status(500).json({ ok: false, error: "MARKETPLACE_CONTRACTOR_LIST_FAILED" });
  }
});

router.post("/marketplace/contractors", requireAuth, async (req: any, res) => {
  try {
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    const landlordId = getLandlordId(req);
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const displayName = asString(req.body?.displayName, 180);
    if (!displayName) return res.status(400).json({ ok: false, error: "DISPLAY_NAME_REQUIRED" });
    const profile = await saveContractorProfile({
      userId: asOptionalString(req.body?.userId, 120),
      displayName,
      businessName: asOptionalString(req.body?.businessName, 180),
      serviceCategories: uniqueStrings(req.body?.serviceCategories, 20),
      serviceAreas: uniqueStrings(req.body?.serviceAreas, 50),
      availabilityStatus: asOptionalString(req.body?.availabilityStatus, 40) || "active",
      contact: {
        email: asOptionalString(req.body?.contact?.email, 320),
        phone: asOptionalString(req.body?.contact?.phone, 80),
      },
      summary: asOptionalString(req.body?.summary, 2000),
      metadata: {
        internalNotes: isAdmin(req) ? asOptionalString(req.body?.metadata?.internalNotes, 2000) : null,
        landlordNetworkIds: uniqueStrings([...(uniqueStrings(req.body?.metadata?.landlordNetworkIds, 100)), landlordId], 100),
        createdByLandlordId: landlordId,
      },
    });
    return res.status(201).json({ ok: true, contractor: profile });
  } catch (err) {
    console.error("[marketplace/contractors] create failed", err);
    return res.status(500).json({ ok: false, error: "MARKETPLACE_CONTRACTOR_CREATE_FAILED" });
  }
});

router.patch("/marketplace/contractors/:contractorId", requireAuth, async (req: any, res) => {
  try {
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    const contractorId = asString(req.params?.contractorId, 120);
    if (!contractorId) return res.status(400).json({ ok: false, error: "CONTRACTOR_ID_REQUIRED" });
    const current = await ensureAccessibleContractorProfile(contractorId, req);
    if (!current) return res.status(404).json({ ok: false, error: "CONTRACTOR_PROFILE_NOT_FOUND" });
    const landlordId = getLandlordId(req);
    const nextLandlordNetworkIds = uniqueStrings(
      [
        ...(current.metadata?.landlordNetworkIds || []),
        ...(uniqueStrings(req.body?.metadata?.landlordNetworkIds, 100)),
        landlordId,
      ],
      100
    );
    const profile = await updateContractorProfile(contractorId, {
      displayName: req.body?.displayName,
      businessName: req.body?.businessName,
      serviceCategories: req.body?.serviceCategories,
      serviceAreas: req.body?.serviceAreas,
      availabilityStatus: req.body?.availabilityStatus,
      contact: req.body?.contact,
      summary: req.body?.summary,
      metadata: {
        internalNotes: isAdmin(req) ? req.body?.metadata?.internalNotes : current.metadata?.internalNotes,
        landlordNetworkIds: nextLandlordNetworkIds,
        createdByLandlordId: current.metadata?.createdByLandlordId || landlordId,
      },
    });
    return res.json({ ok: true, contractor: profile });
  } catch (err) {
    console.error("[marketplace/contractors] patch failed", err);
    return res.status(500).json({ ok: false, error: "MARKETPLACE_CONTRACTOR_PATCH_FAILED" });
  }
});

router.post("/marketplace/work-orders/:workOrderId/assign-contractor", requireAuth, async (req: any, res) => {
  try {
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    if (!(await ensureMarketplaceCapability(req, res, "marketplace_contractor_assignment"))) return;
    const landlordId = getLandlordId(req);
    const actorId = getUserId(req);
    const workOrderId = asString(req.params?.workOrderId, 120);
    const contractorId = asString(req.body?.contractorId, 120);
    if (!landlordId || !actorId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!workOrderId) return res.status(400).json({ ok: false, error: "WORK_ORDER_ID_REQUIRED" });
    if (!contractorId) return res.status(400).json({ ok: false, error: "CONTRACTOR_ID_REQUIRED" });

    const workOrderRef = db.collection("workOrders").doc(workOrderId);
    const workOrderSnap = await workOrderRef.get();
    if (!workOrderSnap.exists) return res.status(404).json({ ok: false, error: "WORK_ORDER_NOT_FOUND" });
    const workOrder = workOrderSnap.data() as any;
    if (!isAdmin(req) && asString(workOrder?.landlordId, 120) !== landlordId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const contractor = await ensureAccessibleContractorProfile(contractorId, req);
    if (!contractor) return res.status(404).json({ ok: false, error: "CONTRACTOR_PROFILE_NOT_FOUND" });

    const nowMs = Date.now();
    const currentStatus = asString(workOrder?.status, 40).toLowerCase();
    const nextStatus =
      currentStatus === "open" || currentStatus === "invited" ? "assigned" : currentStatus || "assigned";

    await workOrderRef.set(
      {
        assignedContractorId: contractor.id,
        contractorAssignment: {
          contractorId: contractor.id,
          displayName: contractor.displayName,
          businessName: contractor.businessName || null,
          assignedAt: new Date(nowMs).toISOString(),
        },
        status: nextStatus,
        updatedAtMs: nowMs,
      },
      { merge: true }
    );
    await db.collection("workOrderUpdates").doc().set({
      workOrderId,
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId,
      updateType: "status_changed",
      message: `Assigned contractor ${contractor.displayName}`,
      attachmentUrl: null,
      createdAtMs: nowMs,
    });
    const refreshed = await workOrderRef.get();
    return res.json({ ok: true, item: { id: refreshed.id, ...(refreshed.data() as any) } });
  } catch (err) {
    console.error("[marketplace/work-orders] assign contractor failed", err);
    return res.status(500).json({ ok: false, error: "MARKETPLACE_ASSIGN_CONTRACTOR_FAILED" });
  }
});

export default router;
