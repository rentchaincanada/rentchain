import { Router } from "express";
import crypto from "crypto";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

const WORK_ORDER_PRIORITIES = new Set(["low", "medium", "high", "urgent"]);
const WORK_ORDER_STATUSES = new Set([
  "open",
  "invited",
  "assigned",
  "accepted",
  "in_progress",
  "completed",
  "cancelled",
]);

const CONTRACTOR_VISIBLE_STATUSES = new Set(["accepted", "in_progress", "completed"]);

function nowMs() {
  return Date.now();
}

function asString(value: unknown, max = 2000): string {
  return String(value || "").trim().slice(0, max);
}

function asOptionalString(value: unknown, max = 2000): string | null {
  const v = asString(value, max);
  return v || null;
}

function uniqueStrings(input: unknown, max = 100): string[] {
  if (!Array.isArray(input)) return [];
  const set = new Set<string>();
  for (const raw of input) {
    const v = asString(raw, 120);
    if (v) set.add(v);
    if (set.size >= max) break;
  }
  return Array.from(set);
}

function parseMoneyToCents(value: unknown): number | null {
  if (value == null || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.round(numeric);
}

function normalizeRole(req: any): string {
  const actorRole = asString(req.user?.actorRole, 40).toLowerCase();
  const role = asString(req.user?.role, 40).toLowerCase();
  return actorRole || role;
}

function getLandlordId(req: any): string {
  return asString(req.user?.actorLandlordId || req.user?.landlordId || req.user?.id, 120);
}

function getUserId(req: any): string {
  return asString(req.user?.id, 120);
}

function getUserEmail(req: any): string {
  return asString(req.user?.email, 320).toLowerCase();
}

function isAdmin(req: any): boolean {
  return normalizeRole(req) === "admin";
}

function isLandlord(req: any): boolean {
  const role = normalizeRole(req);
  return role === "landlord" || role === "admin";
}

function isContractor(req: any): boolean {
  const role = normalizeRole(req);
  return role === "contractor" || role === "admin";
}

function toWorkOrderResponse(id: string, data: any) {
  return { id, ...(data || {}) };
}

async function ensureLandlordOwnsProperty(propertyId: string, landlordId: string, adminAccess: boolean) {
  const snap = await db.collection("properties").doc(propertyId).get();
  if (!snap.exists) {
    return { ok: false as const, code: "PROPERTY_NOT_FOUND" as const };
  }
  const data = snap.data() as any;
  const ownerLandlordId = asString(data?.landlordId || data?.ownerId || data?.owner, 120);
  if (!adminAccess && ownerLandlordId && ownerLandlordId !== landlordId) {
    return { ok: false as const, code: "FORBIDDEN" as const };
  }
  return { ok: true as const, data };
}

async function ensureLandlordOwnsUnit(unitId: string, propertyId: string, landlordId: string, adminAccess: boolean) {
  const snap = await db.collection("units").doc(unitId).get();
  if (!snap.exists) {
    return { ok: false as const, code: "UNIT_NOT_FOUND" as const };
  }
  const data = snap.data() as any;
  const unitPropertyId = asString(data?.propertyId, 120);
  const unitLandlordId = asString(data?.landlordId, 120);
  if (unitPropertyId && unitPropertyId !== propertyId) {
    return { ok: false as const, code: "UNIT_PROPERTY_MISMATCH" as const };
  }
  if (!adminAccess && unitLandlordId && unitLandlordId !== landlordId) {
    return { ok: false as const, code: "FORBIDDEN" as const };
  }
  return { ok: true as const, data };
}

async function writeWorkOrderUpdate(input: {
  workOrderId: string;
  actorRole: "landlord" | "contractor" | "admin";
  actorId: string;
  updateType:
    | "created"
    | "invited"
    | "accepted"
    | "declined"
    | "status_changed"
    | "note"
    | "photo"
    | "invoice"
    | "completed";
  message?: string;
  attachmentUrl?: string | null;
}) {
  const createdAtMs = nowMs();
  const ref = db.collection("workOrderUpdates").doc();
  await ref.set({
    id: ref.id,
    workOrderId: input.workOrderId,
    actorRole: input.actorRole,
    actorId: input.actorId,
    updateType: input.updateType,
    message: asString(input.message || "", 5000),
    attachmentUrl: asOptionalString(input.attachmentUrl, 2000),
    createdAtMs,
  });
}

async function getWorkOrderAuthorized(req: any, workOrderId: string) {
  const snap = await db.collection("workOrders").doc(workOrderId).get();
  if (!snap.exists) return { ok: false as const, code: "NOT_FOUND" as const };

  const item = toWorkOrderResponse(snap.id, snap.data());
  const role = normalizeRole(req);
  const userId = getUserId(req);
  const landlordId = getLandlordId(req);

  if (role === "admin") {
    return { ok: true as const, item, role, userId, landlordId };
  }

  if (role === "landlord") {
    if (asString(item.landlordId) !== landlordId) {
      return { ok: false as const, code: "FORBIDDEN" as const };
    }
    return { ok: true as const, item, role, userId, landlordId };
  }

  if (role === "contractor") {
    const assigned = asString(item.assignedContractorId);
    const invited = Array.isArray(item.invitedContractorIds)
      ? item.invitedContractorIds.map((v: any) => asString(v))
      : [];
    if (assigned !== userId && !invited.includes(userId)) {
      return { ok: false as const, code: "FORBIDDEN" as const };
    }
    return { ok: true as const, item, role, userId, landlordId };
  }

  return { ok: false as const, code: "FORBIDDEN" as const };
}
router.post("/contractor/profile", requireAuth, async (req: any, res) => {
  try {
    if (!isContractor(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const now = nowMs();
    const profileRef = db.collection("contractorProfiles").doc(userId);
    const existing = await profileRef.get();
    const base = (existing.data() as any) || {};

    const next = {
      id: userId,
      userId,
      businessName: asString(req.body?.businessName || base.businessName, 180),
      contactName: asString(req.body?.contactName || base.contactName, 180),
      email: asString(req.body?.email || getUserEmail(req) || base.email, 320).toLowerCase(),
      phone: asString(req.body?.phone || base.phone, 80),
      serviceCategories: uniqueStrings(req.body?.serviceCategories ?? base.serviceCategories, 30),
      serviceAreas: uniqueStrings(req.body?.serviceAreas ?? base.serviceAreas, 30),
      bio: asString(req.body?.bio ?? base.bio, 2000),
      isActive: req.body?.isActive === undefined ? Boolean(base.isActive ?? true) : Boolean(req.body?.isActive),
      invitedByLandlordIds: uniqueStrings(
        req.body?.invitedByLandlordIds ?? base.invitedByLandlordIds,
        100
      ),
      createdAtMs: Number(base.createdAtMs || now),
      updatedAtMs: now,
    };

    await profileRef.set(next, { merge: true });
    return res.json({ ok: true, profile: next });
  } catch (err) {
    console.error("[contractor/profile] create failed", err);
    return res.status(500).json({ ok: false, error: "CONTRACTOR_PROFILE_CREATE_FAILED" });
  }
});

router.get("/contractor/profile", requireAuth, async (req: any, res) => {
  try {
    if (!isContractor(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const snap = await db.collection("contractorProfiles").doc(userId).get();
    const data = snap.exists ? snap.data() : null;
    return res.json({ ok: true, profile: data ? { id: snap.id, ...(data as any) } : null });
  } catch (err) {
    console.error("[contractor/profile] get failed", err);
    return res.status(500).json({ ok: false, error: "CONTRACTOR_PROFILE_GET_FAILED" });
  }
});

router.patch("/contractor/profile", requireAuth, async (req: any, res) => {
  try {
    if (!isContractor(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const profileRef = db.collection("contractorProfiles").doc(userId);
    const snap = await profileRef.get();
    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: "CONTRACTOR_PROFILE_NOT_FOUND" });
    }

    const prev = snap.data() as any;
    const patch: Record<string, any> = { updatedAtMs: nowMs() };

    if (req.body?.businessName !== undefined) patch.businessName = asString(req.body.businessName, 180);
    if (req.body?.contactName !== undefined) patch.contactName = asString(req.body.contactName, 180);
    if (req.body?.email !== undefined) patch.email = asString(req.body.email, 320).toLowerCase();
    if (req.body?.phone !== undefined) patch.phone = asString(req.body.phone, 80);
    if (req.body?.serviceCategories !== undefined) patch.serviceCategories = uniqueStrings(req.body.serviceCategories, 30);
    if (req.body?.serviceAreas !== undefined) patch.serviceAreas = uniqueStrings(req.body.serviceAreas, 30);
    if (req.body?.bio !== undefined) patch.bio = asString(req.body.bio, 2000);
    if (req.body?.isActive !== undefined) patch.isActive = Boolean(req.body.isActive);
    if (req.body?.invitedByLandlordIds !== undefined) {
      patch.invitedByLandlordIds = uniqueStrings(req.body.invitedByLandlordIds, 100);
    }

    await profileRef.set(patch, { merge: true });
    const merged = { ...prev, ...patch, id: userId };
    return res.json({ ok: true, profile: merged });
  } catch (err) {
    console.error("[contractor/profile] patch failed", err);
    return res.status(500).json({ ok: false, error: "CONTRACTOR_PROFILE_PATCH_FAILED" });
  }
});

router.post("/contractor/invites", requireAuth, async (req: any, res) => {
  try {
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    const landlordId = getLandlordId(req);
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const email = asString(req.body?.email, 320).toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: "INVALID_EMAIL" });
    }

    const now = nowMs();
    const token = crypto.randomBytes(24).toString("hex");
    const ref = db.collection("contractorInvites").doc();
    const invite = {
      id: ref.id,
      landlordId,
      email,
      token,
      status: "pending",
      createdAtMs: now,
      acceptedAtMs: null,
      createdByUserId: getUserId(req),
      message: asString(req.body?.message, 1000),
    };

    await ref.set(invite);

    const appBaseUrl = String(process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
    const inviteLink = `${appBaseUrl}/contractor/signup?invite=${encodeURIComponent(token)}`;

    console.log("[contractor-invite] created", {
      inviteId: ref.id,
      landlordId,
      email,
      inviteLink,
    });

    return res.status(201).json({ ok: true, invite: { ...invite, inviteLink } });
  } catch (err) {
    console.error("[contractor/invites] create failed", err);
    return res.status(500).json({ ok: false, error: "CONTRACTOR_INVITE_CREATE_FAILED" });
  }
});

router.get("/contractor/invites", requireAuth, async (req: any, res) => {
  try {
    const role = normalizeRole(req);
    const userEmail = getUserEmail(req);
    const landlordId = getLandlordId(req);

    if (role === "landlord" || role === "admin") {
      if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
      const snap = await db
        .collection("contractorInvites")
        .where("landlordId", "==", landlordId)
        .limit(300)
        .get();
      const invites = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
      return res.json({ ok: true, invites });
    }

    if (role === "contractor") {
      if (!userEmail) return res.json({ ok: true, invites: [] });
      const snap = await db
        .collection("contractorInvites")
        .where("email", "==", userEmail)
        .limit(100)
        .get();
      const invites = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
      return res.json({ ok: true, invites });
    }

    return res.status(403).json({ ok: false, error: "FORBIDDEN" });
  } catch (err) {
    console.error("[contractor/invites] list failed", err);
    return res.status(500).json({ ok: false, error: "CONTRACTOR_INVITE_LIST_FAILED" });
  }
});

router.post("/contractor/invites/:token/accept", requireAuth, async (req: any, res) => {
  try {
    const token = asString(req.params?.token, 120);
    if (!token) return res.status(400).json({ ok: false, error: "TOKEN_REQUIRED" });

    const snap = await db
      .collection("contractorInvites")
      .where("token", "==", token)
      .limit(1)
      .get();

    if (snap.empty) return res.status(404).json({ ok: false, error: "INVITE_NOT_FOUND" });

    const inviteDoc = snap.docs[0];
    const invite = inviteDoc.data() as any;
    if (String(invite?.status || "") !== "pending") {
      return res.status(409).json({ ok: false, error: "INVITE_NOT_PENDING" });
    }
    const admin = isAdmin(req);
    const userId = getUserId(req);
    const userEmail = getUserEmail(req);
    if (!userId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const inviteEmail = asString(invite?.email, 320).toLowerCase();
    if (!admin && inviteEmail && inviteEmail !== userEmail) {
      return res.status(403).json({ ok: false, error: "INVITE_EMAIL_MISMATCH" });
    }

    const now = nowMs();
    await inviteDoc.ref.set(
      {
        status: "accepted",
        acceptedAtMs: now,
        acceptedByUserId: userId,
      },
      { merge: true }
    );

    const contractorProfileRef = db.collection("contractorProfiles").doc(userId);
    const profileSnap = await contractorProfileRef.get();
    const prevProfile = (profileSnap.data() as any) || {};
    const invitedBy = uniqueStrings([...(Array.isArray(prevProfile.invitedByLandlordIds) ? prevProfile.invitedByLandlordIds : []), invite.landlordId], 100);

    const nextProfile = {
      id: userId,
      userId,
      businessName: asString(req.body?.businessName || prevProfile.businessName, 180),
      contactName: asString(req.body?.contactName || prevProfile.contactName, 180),
      email: asString(userEmail || inviteEmail || prevProfile.email, 320).toLowerCase(),
      phone: asString(req.body?.phone || prevProfile.phone, 80),
      serviceCategories: uniqueStrings(req.body?.serviceCategories ?? prevProfile.serviceCategories, 30),
      serviceAreas: uniqueStrings(req.body?.serviceAreas ?? prevProfile.serviceAreas, 30),
      bio: asString(req.body?.bio ?? prevProfile.bio, 2000),
      isActive: true,
      invitedByLandlordIds: invitedBy,
      createdAtMs: Number(prevProfile.createdAtMs || now),
      updatedAtMs: now,
    };
    await contractorProfileRef.set(nextProfile, { merge: true });

    if (!admin) {
      await Promise.all([
        db.collection("users").doc(userId).set(
          {
            role: "contractor",
            contractorId: userId,
            contractorLandlordIds: invitedBy,
            landlordId: null,
            updatedAt: now,
          },
          { merge: true }
        ),
        db.collection("accounts").doc(userId).set(
          {
            role: "contractor",
            contractorId: userId,
            contractorLandlordIds: invitedBy,
            landlordId: null,
            updatedAt: now,
          },
          { merge: true }
        ),
      ]);
    }

    return res.json({ ok: true, invite: { id: inviteDoc.id, ...invite, status: "accepted", acceptedAtMs: now } });
  } catch (err) {
    console.error("[contractor/invites] accept failed", err);
    return res.status(500).json({ ok: false, error: "CONTRACTOR_INVITE_ACCEPT_FAILED" });
  }
});

router.post("/work-orders", requireAuth, async (req: any, res) => {
  try {
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const landlordId = getLandlordId(req);
    const actorId = getUserId(req);
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const propertyId = asString(req.body?.propertyId, 120);
    if (!propertyId) return res.status(400).json({ ok: false, error: "PROPERTY_REQUIRED" });

    const propertyCheck = await ensureLandlordOwnsProperty(propertyId, landlordId, isAdmin(req));
    if (!propertyCheck.ok) {
      if (propertyCheck.code === "PROPERTY_NOT_FOUND") {
        return res.status(404).json({ ok: false, error: "PROPERTY_NOT_FOUND" });
      }
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const unitId = asOptionalString(req.body?.unitId, 120);
    if (unitId) {
      const unitCheck = await ensureLandlordOwnsUnit(unitId, propertyId, landlordId, isAdmin(req));
      if (!unitCheck.ok) {
        return res.status(400).json({ ok: false, error: unitCheck.code });
      }
    }

    const title = asString(req.body?.title, 180);
    const description = asString(req.body?.description, 5000);
    const category = asString(req.body?.category, 120);
    const priorityRaw = asString(req.body?.priority, 30).toLowerCase();
    const priority = WORK_ORDER_PRIORITIES.has(priorityRaw) ? priorityRaw : "medium";

    if (!title) return res.status(400).json({ ok: false, error: "TITLE_REQUIRED" });

    const invitedContractorIds = uniqueStrings(req.body?.invitedContractorIds, 100);
    const assignedContractorId = asOptionalString(req.body?.assignedContractorId, 120);

    const now = nowMs();
    const initialStatus = assignedContractorId
      ? "assigned"
      : invitedContractorIds.length
      ? "invited"
      : "open";

    const ref = db.collection("workOrders").doc();
    const item = {
      id: ref.id,
      landlordId,
      propertyId,
      unitId: unitId || null,
      title,
      description,
      category,
      priority,
      status: initialStatus,
      visibility: "private",
      budgetMinCents: parseMoneyToCents(req.body?.budgetMinCents),
      budgetMaxCents: parseMoneyToCents(req.body?.budgetMaxCents),
      assignedContractorId: assignedContractorId || null,
      invitedContractorIds,
      acceptedAtMs: null,
      startedAtMs: null,
      completedAtMs: null,
      notesInternal: asString(req.body?.notesInternal, 5000),
      linkedExpenseId: asOptionalString(req.body?.linkedExpenseId, 120),
      createdAtMs: now,
      updatedAtMs: now,
    };

    await ref.set(item);

    await writeWorkOrderUpdate({
      workOrderId: ref.id,
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId,
      updateType: "created",
      message: "Work order created",
    });

    if (invitedContractorIds.length > 0) {
      await writeWorkOrderUpdate({
        workOrderId: ref.id,
        actorRole: isAdmin(req) ? "admin" : "landlord",
        actorId,
        updateType: "invited",
        message: `Invited ${invitedContractorIds.length} contractor(s).`,
      });
    }

    return res.status(201).json({ ok: true, item });
  } catch (err) {
    console.error("[work-orders] create failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_CREATE_FAILED" });
  }
});

router.get("/work-orders", requireAuth, async (req: any, res) => {
  try {
    const role = normalizeRole(req);
    const userId = getUserId(req);
    const landlordId = getLandlordId(req);
    const statusFilter = asString(req.query?.status, 40).toLowerCase();

    if (role === "landlord" || role === "admin") {
      if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
      const snap = await db
        .collection("workOrders")
        .where("landlordId", "==", landlordId)
        .limit(500)
        .get();
      let items = snap.docs.map((d) => toWorkOrderResponse(d.id, d.data()));
      if (statusFilter) items = items.filter((item) => String(item.status || "").toLowerCase() === statusFilter);
      items.sort((a, b) => Number(b.updatedAtMs || 0) - Number(a.updatedAtMs || 0));
      return res.json({ ok: true, items });
    }

    if (role === "contractor") {
      const [assignedSnap, invitedSnap] = await Promise.all([
        db.collection("workOrders").where("assignedContractorId", "==", userId).limit(400).get(),
        db.collection("workOrders").where("invitedContractorIds", "array-contains", userId).limit(400).get(),
      ]);

      const map = new Map<string, any>();
      for (const doc of [...assignedSnap.docs, ...invitedSnap.docs]) {
        map.set(doc.id, toWorkOrderResponse(doc.id, doc.data()));
      }

      let items = Array.from(map.values());
      if (statusFilter) items = items.filter((item) => String(item.status || "").toLowerCase() === statusFilter);
      items.sort((a, b) => Number(b.updatedAtMs || 0) - Number(a.updatedAtMs || 0));
      return res.json({ ok: true, items });
    }

    return res.status(403).json({ ok: false, error: "FORBIDDEN" });
  } catch (err) {
    console.error("[work-orders] list failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_LIST_FAILED" });
  }
});

router.get("/work-orders/:id", requireAuth, async (req: any, res) => {
  try {
    const id = asString(req.params?.id, 120);
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const access = await getWorkOrderAuthorized(req, id);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    return res.json({ ok: true, item: access.item });
  } catch (err) {
    console.error("[work-orders] get failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_GET_FAILED" });
  }
});
router.patch("/work-orders/:id", requireAuth, async (req: any, res) => {
  try {
    const id = asString(req.params?.id, 120);
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const access = await getWorkOrderAuthorized(req, id);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const patch: Record<string, any> = { updatedAtMs: nowMs() };
    let updateMessage = "Work order updated";

    if (access.role === "landlord" || access.role === "admin") {
      if (req.body?.title !== undefined) patch.title = asString(req.body.title, 180);
      if (req.body?.description !== undefined) patch.description = asString(req.body.description, 5000);
      if (req.body?.category !== undefined) patch.category = asString(req.body.category, 120);
      if (req.body?.priority !== undefined) {
        const nextPriority = asString(req.body.priority, 30).toLowerCase();
        if (WORK_ORDER_PRIORITIES.has(nextPriority)) patch.priority = nextPriority;
      }
      if (req.body?.budgetMinCents !== undefined) patch.budgetMinCents = parseMoneyToCents(req.body.budgetMinCents);
      if (req.body?.budgetMaxCents !== undefined) patch.budgetMaxCents = parseMoneyToCents(req.body.budgetMaxCents);
      if (req.body?.assignedContractorId !== undefined) {
        patch.assignedContractorId = asOptionalString(req.body.assignedContractorId, 120);
      }
      if (req.body?.invitedContractorIds !== undefined) {
        patch.invitedContractorIds = uniqueStrings(req.body.invitedContractorIds, 100);
      }
      if (req.body?.notesInternal !== undefined) patch.notesInternal = asString(req.body.notesInternal, 5000);
      if (req.body?.linkedExpenseId !== undefined) patch.linkedExpenseId = asOptionalString(req.body.linkedExpenseId, 120);
      if (req.body?.status !== undefined) {
        const nextStatus = asString(req.body.status, 40).toLowerCase();
        if (WORK_ORDER_STATUSES.has(nextStatus)) {
          patch.status = nextStatus;
          if (nextStatus === "completed") patch.completedAtMs = nowMs();
          if (nextStatus === "in_progress") patch.startedAtMs = nowMs();
          updateMessage = `Status changed to ${nextStatus}`;
        }
      }
    } else if (access.role === "contractor") {
      if (req.body?.status !== undefined) {
        const nextStatus = asString(req.body.status, 40).toLowerCase();
        if (CONTRACTOR_VISIBLE_STATUSES.has(nextStatus)) {
          patch.status = nextStatus;
          if (nextStatus === "in_progress") patch.startedAtMs = nowMs();
          if (nextStatus === "completed") patch.completedAtMs = nowMs();
          updateMessage = `Contractor status updated to ${nextStatus}`;
        }
      }
    }

    await db.collection("workOrders").doc(id).set(patch, { merge: true });

    await writeWorkOrderUpdate({
      workOrderId: id,
      actorRole: access.role === "admin" ? "admin" : access.role === "contractor" ? "contractor" : "landlord",
      actorId: access.userId,
      updateType: patch.status === "completed" ? "completed" : "status_changed",
      message: updateMessage,
    });

    const refreshed = await db.collection("workOrders").doc(id).get();
    return res.json({ ok: true, item: toWorkOrderResponse(refreshed.id, refreshed.data()) });
  } catch (err) {
    console.error("[work-orders] patch failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_PATCH_FAILED" });
  }
});

router.post("/work-orders/:id/accept", requireAuth, async (req: any, res) => {
  try {
    if (!isContractor(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const workOrderId = asString(req.params?.id, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const userId = getUserId(req);
    const now = nowMs();
    await db.collection("workOrders").doc(workOrderId).set(
      {
        status: "accepted",
        assignedContractorId: userId,
        acceptedAtMs: now,
        updatedAtMs: now,
      },
      { merge: true }
    );

    await writeWorkOrderUpdate({
      workOrderId,
      actorRole: isAdmin(req) ? "admin" : "contractor",
      actorId: userId,
      updateType: "accepted",
      message: "Work order accepted",
    });

    const refreshed = await db.collection("workOrders").doc(workOrderId).get();
    return res.json({ ok: true, item: toWorkOrderResponse(refreshed.id, refreshed.data()) });
  } catch (err) {
    console.error("[work-orders] accept failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_ACCEPT_FAILED" });
  }
});

router.post("/work-orders/:id/decline", requireAuth, async (req: any, res) => {
  try {
    if (!isContractor(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const workOrderId = asString(req.params?.id, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const userId = getUserId(req);
    const invited = uniqueStrings((access.item as any)?.invitedContractorIds, 100).filter((id) => id !== userId);
    const nextStatus = invited.length ? "invited" : "open";

    await db.collection("workOrders").doc(workOrderId).set(
      {
        status: nextStatus,
        invitedContractorIds: invited,
        assignedContractorId:
          asString((access.item as any)?.assignedContractorId) === userId
            ? null
            : asOptionalString((access.item as any)?.assignedContractorId),
        updatedAtMs: nowMs(),
      },
      { merge: true }
    );

    await writeWorkOrderUpdate({
      workOrderId,
      actorRole: isAdmin(req) ? "admin" : "contractor",
      actorId: userId,
      updateType: "declined",
      message: "Work order declined",
    });

    const refreshed = await db.collection("workOrders").doc(workOrderId).get();
    return res.json({ ok: true, item: toWorkOrderResponse(refreshed.id, refreshed.data()) });
  } catch (err) {
    console.error("[work-orders] decline failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_DECLINE_FAILED" });
  }
});

router.post("/work-orders/:id/start", requireAuth, async (req: any, res) => {
  try {
    if (!isContractor(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const workOrderId = asString(req.params?.id, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const userId = getUserId(req);
    const now = nowMs();
    await db.collection("workOrders").doc(workOrderId).set(
      {
        status: "in_progress",
        assignedContractorId: userId,
        startedAtMs: now,
        updatedAtMs: now,
      },
      { merge: true }
    );

    await writeWorkOrderUpdate({
      workOrderId,
      actorRole: isAdmin(req) ? "admin" : "contractor",
      actorId: userId,
      updateType: "status_changed",
      message: "Work order marked in progress",
    });

    const refreshed = await db.collection("workOrders").doc(workOrderId).get();
    return res.json({ ok: true, item: toWorkOrderResponse(refreshed.id, refreshed.data()) });
  } catch (err) {
    console.error("[work-orders] start failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_START_FAILED" });
  }
});

router.post("/work-orders/:id/complete", requireAuth, async (req: any, res) => {
  try {
    if (!isContractor(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const workOrderId = asString(req.params?.id, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const userId = getUserId(req);
    const now = nowMs();
    await db.collection("workOrders").doc(workOrderId).set(
      {
        status: "completed",
        assignedContractorId: userId,
        completedAtMs: now,
        updatedAtMs: now,
      },
      { merge: true }
    );

    await writeWorkOrderUpdate({
      workOrderId,
      actorRole: isAdmin(req) ? "admin" : "contractor",
      actorId: userId,
      updateType: "completed",
      message: "Work order marked completed",
    });

    const refreshed = await db.collection("workOrders").doc(workOrderId).get();
    return res.json({ ok: true, item: toWorkOrderResponse(refreshed.id, refreshed.data()) });
  } catch (err) {
    console.error("[work-orders] complete failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_COMPLETE_FAILED" });
  }
});

router.get("/work-orders/:id/updates", requireAuth, async (req: any, res) => {
  try {
    const workOrderId = asString(req.params?.id, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const snap = await db
      .collection("workOrderUpdates")
      .where("workOrderId", "==", workOrderId)
      .limit(500)
      .get();

    const items = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .sort((a, b) => Number(a.createdAtMs || 0) - Number(b.createdAtMs || 0));

    return res.json({ ok: true, items });
  } catch (err) {
    console.error("[work-orders] updates list failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_UPDATES_LIST_FAILED" });
  }
});

router.post("/work-orders/:id/updates", requireAuth, async (req: any, res) => {
  try {
    const workOrderId = asString(req.params?.id, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const updateTypeRaw = asString(req.body?.updateType, 40).toLowerCase();
    const updateType = [
      "created",
      "invited",
      "accepted",
      "declined",
      "status_changed",
      "note",
      "photo",
      "invoice",
      "completed",
    ].includes(updateTypeRaw)
      ? (updateTypeRaw as
          | "created"
          | "invited"
          | "accepted"
          | "declined"
          | "status_changed"
          | "note"
          | "photo"
          | "invoice"
          | "completed")
      : "note";

    await writeWorkOrderUpdate({
      workOrderId,
      actorRole: access.role === "admin" ? "admin" : access.role === "contractor" ? "contractor" : "landlord",
      actorId: access.userId,
      updateType,
      message: asString(req.body?.message, 5000),
      attachmentUrl: asOptionalString(req.body?.attachmentUrl, 2000),
    });

    await db.collection("workOrders").doc(workOrderId).set({ updatedAtMs: nowMs() }, { merge: true });

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error("[work-orders] updates create failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_UPDATES_CREATE_FAILED" });
  }
});

export default router;
