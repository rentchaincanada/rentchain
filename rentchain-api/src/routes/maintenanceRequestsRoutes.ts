import { Router } from "express";
import { db, FieldValue } from "../config/firebase";
import { authenticateJwt } from "../middleware/authMiddleware";
import { buildEmailHtml, buildEmailText } from "../email/templates/baseEmailTemplate";
import { sendEmail } from "../services/emailService";

const router = Router();

const ALLOWED_STATUS = [
  "NEW",
  "IN_PROGRESS",
  "WAITING_ON_TENANT",
  "SCHEDULED",
  "RESOLVED",
  "CLOSED",
];

const NOTIFY_STATUS = [
  "IN_PROGRESS",
  "WAITING_ON_TENANT",
  "SCHEDULED",
  "RESOLVED",
  "CLOSED",
];

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WORKFLOW_STATUSES = [
  "submitted",
  "reviewed",
  "assigned",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
] as const;
const WORKFLOW_TRANSITIONS: Record<(typeof WORKFLOW_STATUSES)[number], Array<(typeof WORKFLOW_STATUSES)[number]>> = {
  submitted: ["reviewed", "cancelled"],
  reviewed: ["assigned", "cancelled"],
  assigned: ["scheduled", "cancelled"],
  scheduled: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};
const LEGACY_TO_WORKFLOW_STATUS: Record<string, (typeof WORKFLOW_STATUSES)[number]> = {
  NEW: "submitted",
  IN_PROGRESS: "in_progress",
  WAITING_ON_TENANT: "reviewed",
  SCHEDULED: "scheduled",
  RESOLVED: "completed",
  CLOSED: "completed",
};

router.use(authenticateJwt);

function roleOf(req: any): string {
  return String(req.user?.actorRole || req.user?.role || "").trim().toLowerCase();
}

function landlordIdOf(req: any): string | null {
  return String(req.user?.landlordId || req.user?.id || "").trim() || null;
}

function contractorIdOf(req: any): string | null {
  return String(req.user?.contractorId || req.user?.id || "").trim() || null;
}

async function resolveContractorAccess(req: any): Promise<{
  role: string;
  contractorId: string | null;
}> {
  const directRole = roleOf(req);
  const directContractorId = contractorIdOf(req);
  if (directRole === "contractor" || directRole === "admin") {
    return { role: directRole, contractorId: directContractorId };
  }

  const userId = String(req.user?.id || "").trim();
  if (!userId) {
    return { role: directRole, contractorId: directContractorId };
  }

  const [userSnap, accountSnap] = await Promise.all([
    db.collection("users").doc(userId).get(),
    db.collection("accounts").doc(userId).get(),
  ]);
  const userData = userSnap.exists ? (userSnap.data() as any) : null;
  const accountData = accountSnap.exists ? (accountSnap.data() as any) : null;
  const persistedRole = String(
    userData?.actorRole || userData?.role || accountData?.actorRole || accountData?.role || directRole || ""
  )
    .trim()
    .toLowerCase();
  const persistedContractorId =
    String(
      userData?.contractorId || accountData?.contractorId || directContractorId || userId || ""
    ).trim() || null;

  return {
    role: persistedRole,
    contractorId: persistedContractorId,
  };
}

function normalizeWorkflowStatus(raw: any): (typeof WORKFLOW_STATUSES)[number] | null {
  const value = String(raw || "").trim();
  if (!value) return null;
  const lower = value.toLowerCase();
  if ((WORKFLOW_STATUSES as readonly string[]).includes(lower)) {
    return lower as (typeof WORKFLOW_STATUSES)[number];
  }
  const upper = value.toUpperCase();
  return LEGACY_TO_WORKFLOW_STATUS[upper] ?? null;
}

function ensureStatusHistory(item: any) {
  const history = Array.isArray(item?.statusHistory) ? item.statusHistory : [];
  return history;
}

function canTransitionWorkflowStatus(
  currentStatus: (typeof WORKFLOW_STATUSES)[number],
  nextStatus: (typeof WORKFLOW_STATUSES)[number]
) {
  if (currentStatus === nextStatus) return true;
  return WORKFLOW_TRANSITIONS[currentStatus]?.includes(nextStatus) || false;
}

function formatTenantName(tenant: any, fallback?: string | null) {
  const direct = String(tenant?.name || "").trim();
  if (direct) return direct;
  const combined = [tenant?.firstName, tenant?.lastName]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
  if (combined) return combined;
  return String(fallback || "").trim() || null;
}

async function appendStatusHistory(
  requestId: string,
  payload: {
    status: string;
    actorRole: "tenant" | "landlord" | "contractor" | "admin";
    actorId: string | null;
    message?: string;
  }
) {
  await db
    .collection("maintenanceRequests")
    .doc(requestId)
    .set(
      {
        statusHistory: FieldValue.arrayUnion({
          status: payload.status,
          actorRole: payload.actorRole,
          actorId: payload.actorId || null,
          message: String(payload.message || "").trim().slice(0, 500),
          createdAt: Date.now(),
        }),
      },
      { merge: true }
    );
}

async function lookupEmailFromDoc(docPath: [string, string][]): Promise<string | null> {
  for (const [collection, id] of docPath) {
    if (!id) continue;
    try {
      const snap = await db.collection(collection).doc(id).get();
      if (!snap.exists) continue;
      const email = String((snap.data() as any)?.email || "").trim();
      if (email && emailRegex.test(email)) return email;
    } catch {
      // ignore lookup failures
    }
  }
  return null;
}

async function sendMaintenanceStatusEmail(params: {
  to: string | null;
  subject: string;
  intro: string;
  requestId: string;
}) {
  const to = String(params.to || "").trim();
  if (!to || !emailRegex.test(to)) return false;
  const apiKey = process.env.SENDGRID_API_KEY;
  const from =
    process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM || process.env.FROM_EMAIL;
  const replyTo = process.env.SENDGRID_REPLY_TO || process.env.SENDGRID_REPLYTO_EMAIL;
  if (!apiKey || !from) return false;
  const baseUrl =
    (process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
  const requestLink = `${baseUrl}/tenant/maintenance/${params.requestId}`;
  try {
    await sendEmail({
      to,
      from,
      replyTo: replyTo || from,
      subject: params.subject,
      text: buildEmailText({
        intro: params.intro,
        ctaText: "View request",
        ctaUrl: requestLink,
      }),
      html: buildEmailHtml({
        title: "Maintenance request update",
        intro: params.intro,
        ctaText: "View request",
        ctaUrl: requestLink,
      }),
    });
    return true;
  } catch (err: any) {
    console.error("[maintenance-v2] notification send failed", {
      to,
      requestId: params.requestId,
      message: err?.message || "send_failed",
    });
    return false;
  }
}

router.get("/maintenance-requests", async (req: any, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const landlordId = req.user?.landlordId || req.user?.id || null;
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const { tenantId, status } = req.query || {};
    let query: FirebaseFirestore.Query = db
      .collection("maintenanceRequests")
      .where("landlordId", "==", landlordId)
      .limit(100);

    if (tenantId) {
      query = query.where("tenantId", "==", String(tenantId));
    }
    if (status && typeof status === "string") {
      query = query.where("status", "==", status.toUpperCase());
    }

    const snap = await query.get();
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    items.sort((a, b) => (Number(b.updatedAt || 0) || 0) - (Number(a.updatedAt || 0) || 0));
    return res.json({ ok: true, data: items });
  } catch (err) {
    console.error("[maintenance-requests] list failed", { err });
    return res.status(500).json({ ok: false, error: "MAINT_REQUEST_LIST_FAILED" });
  }
});

router.patch("/maintenance-requests/:id", async (req: any, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const landlordId = req.user?.landlordId || req.user?.id || null;
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const docRef = db.collection("maintenanceRequests").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }
    const data = snap.data() as any;
    if (data?.landlordId && data.landlordId !== landlordId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const updates: any = {};
    if (req.body?.status) {
      const st = String(req.body.status || "").toUpperCase();
      if (ALLOWED_STATUS.includes(st)) {
        updates.status = st;
      }
    }
    if (req.body?.landlordNote !== undefined) {
      const note = req.body.landlordNote;
      updates.landlordNote = note === null ? null : String(note || "").trim().slice(0, 5000);
    }
    updates.updatedAt = Date.now();
    updates.lastUpdatedBy = "LANDLORD";

    const previousStatus = String(data?.status || "NEW").toUpperCase();

    await docRef.update(updates);
    const refreshed = await docRef.get();
    const refreshedData = refreshed.data() as any;

    let emailed = false;
    let emailError: string | undefined;
    const nextStatus = String(refreshedData?.status || previousStatus).toUpperCase();
    const statusChanged = Boolean(updates.status) && nextStatus !== previousStatus;
    const shouldNotify = statusChanged && NOTIFY_STATUS.includes(nextStatus);

    if (shouldNotify) {
      const tenantId = refreshedData?.tenantId || data?.tenantId || null;
      if (!tenantId) {
        emailError = "MISSING_TENANT_ID";
      } else {
        let tenantEmail: string | null = null;
        try {
          const tenantSnap = await db.collection("tenants").doc(String(tenantId)).get();
          if (tenantSnap.exists) {
            const tenant = tenantSnap.data() as any;
            tenantEmail = typeof tenant?.email === "string" ? tenant.email.trim() : null;
          }
        } catch {
          // ignore lookup errors
        }

        if (!tenantEmail || !emailRegex.test(tenantEmail)) {
          emailError = "INVALID_TENANT_EMAIL";
        } else {
          const apiKey = process.env.SENDGRID_API_KEY;
          const from =
            process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM || process.env.FROM_EMAIL;
          const replyTo = process.env.SENDGRID_REPLY_TO || process.env.SENDGRID_REPLYTO_EMAIL;
          const baseUrl =
            (process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://www.rentchain.ai").replace(
              /\/$/,
              ""
            );
          const requestLink = `${baseUrl}/tenant/maintenance/${refreshed.id}`;
          const title = String(refreshedData?.title || "Maintenance request");
          const category = String(refreshedData?.category || "GENERAL");
          const priority = String(refreshedData?.priority || "NORMAL");
          const descriptionRaw = String(refreshedData?.description || "");
          const excerpt =
            descriptionRaw.length > 400 ? `${descriptionRaw.slice(0, 400)}...` : descriptionRaw;
          const timestamp = new Date().toISOString();

          if (!apiKey || !from) {
            emailError = "EMAIL_NOT_CONFIGURED";
          } else {
            try {
              await sendEmail({
                to: tenantEmail,
                from,
                replyTo: replyTo || from,
                subject: `Maintenance update: ${title} (${nextStatus})`,
                text: buildEmailText({
                  intro: `Your maintenance request was updated to ${nextStatus}.\nUpdated at: ${timestamp}\nCategory: ${category}\nPriority: ${priority}\n\n${excerpt}`,
                  ctaText: "View request",
                  ctaUrl: requestLink,
                }),
                html: buildEmailHtml({
                  title: "Maintenance request updated",
                  intro: `Status: ${nextStatus}. Updated at: ${timestamp}. Category: ${category}. Priority: ${priority}.`,
                  ctaText: "View request",
                  ctaUrl: requestLink,
                }),
              });
              emailed = true;
            } catch (err: any) {
              emailed = false;
              emailError = err?.message || "SEND_FAILED";
              console.error("[maintenance-requests] tenant email send failed", {
                requestId: refreshed.id,
                tenantId,
                tenantEmail,
                errMessage: err?.message,
                errBody: err?.response?.body,
              });
            }
          }
        }
      }
    }

    return res.json({
      ok: true,
      data: { id: refreshed.id, ...(refreshedData as any) },
      emailed,
      emailError,
    });
  } catch (err) {
    console.error("[maintenance-requests] update failed", { id: req.params?.id, err });
    return res.status(500).json({ ok: false, error: "MAINT_REQUEST_UPDATE_FAILED" });
  }
});

// ---------------------------
// Maintenance Workflow V2 APIs
// ---------------------------

router.post("/tenant/maintenance", async (req: any, res) => {
  try {
    const role = roleOf(req);
    if (role !== "tenant") return res.status(403).json({ ok: false, error: "TENANT_ONLY" });
    const tenantId = String(req.user?.tenantId || req.user?.id || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const title = String(req.body?.title || "").trim().slice(0, 180);
    const description = String(req.body?.description || "").trim().slice(0, 5000);
    const category = String(req.body?.category || "GENERAL").trim().toUpperCase().slice(0, 80);
    const priorityRaw = String(req.body?.priority || "normal").trim().toLowerCase();
    const priority = ["low", "normal", "urgent"].includes(priorityRaw) ? priorityRaw : "normal";
    const notes = String(req.body?.notes || req.body?.optionalNotes || "").trim().slice(0, 2000) || null;

    if (!title || !description) {
      return res.status(400).json({ ok: false, error: "TITLE_AND_DESCRIPTION_REQUIRED" });
    }

    const tenantSnap = await db.collection("tenants").doc(tenantId).get();
    const tenant = (tenantSnap.exists ? (tenantSnap.data() as any) : {}) || {};
    const landlordId = String(tenant?.landlordId || req.user?.landlordId || "").trim() || null;
    const propertyId = String(tenant?.propertyId || tenant?.property || "").trim() || null;
    const unitId = String(tenant?.unitId || tenant?.unit || "").trim() || null;
    const tenantName = formatTenantName(tenant, req.user?.name || req.user?.email || null);
    const propertyLabel = String(tenant?.propertyName || tenant?.propertyLabel || propertyId || "").trim() || null;
    const unitLabel = String(tenant?.unitLabel || unitId || "").trim() || null;
    const now = Date.now();
    const ref = db.collection("maintenanceRequests").doc();
    const data = {
      id: ref.id,
      tenantId,
      landlordId,
      propertyId,
      unitId,
      tenantName,
      propertyLabel,
      unitLabel,
      title,
      description,
      notes,
      category,
      priority,
      status: "submitted",
      assignedContractorId: null,
      contractorStatus: null,
      createdAt: now,
      updatedAt: now,
      lastUpdatedBy: "TENANT",
      photoUploadPending: Boolean(req.body?.photoUploadPending || false),
      statusHistory: [
        {
          status: "submitted",
          actorRole: "tenant",
          actorId: tenantId,
          message: "Maintenance request submitted",
          createdAt: now,
        },
      ],
      messages: [],
    };
    await ref.set(data);

    if (landlordId) {
      const landlordEmail = await lookupEmailFromDoc([
        ["users", landlordId],
        ["landlords", landlordId],
      ]);
      await sendMaintenanceStatusEmail({
        to: landlordEmail,
        subject: `New maintenance request: ${title}`,
        intro: `A tenant submitted a new maintenance request.\nCategory: ${category}\nPriority: ${priority}\nStatus: submitted`,
        requestId: ref.id,
      });
    }

    return res.status(201).json({ ok: true, requestId: ref.id, status: "submitted", data });
  } catch (err: any) {
    console.error("[maintenance-v2] tenant create failed", {
      tenantId: req.user?.tenantId || null,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_MAINTENANCE_CREATE_FAILED" });
  }
});

router.get("/tenant/maintenance", async (req: any, res) => {
  try {
    const role = roleOf(req);
    if (role !== "tenant") return res.status(403).json({ ok: false, error: "TENANT_ONLY" });
    const tenantId = String(req.user?.tenantId || req.user?.id || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const snap = await db
      .collection("maintenanceRequests")
      .where("tenantId", "==", tenantId)
      .limit(200)
      .get();
    const items = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
    items.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    return res.json({ ok: true, items, data: items });
  } catch (err: any) {
    console.error("[maintenance-v2] tenant list failed", { message: err?.message || "failed" });
    return res.status(500).json({ ok: false, error: "TENANT_MAINTENANCE_LIST_FAILED" });
  }
});

router.get("/tenant/maintenance/:id", async (req: any, res) => {
  try {
    const role = roleOf(req);
    if (role !== "tenant") return res.status(403).json({ ok: false, error: "TENANT_ONLY" });
    const tenantId = String(req.user?.tenantId || req.user?.id || "").trim();
    const id = String(req.params?.id || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const snap = await db.collection("maintenanceRequests").doc(id).get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const item = { id: snap.id, ...(snap.data() as any) };
    if (String(item.tenantId || "") !== tenantId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    return res.json({ ok: true, item, data: item });
  } catch (err: any) {
    console.error("[maintenance-v2] tenant get failed", { message: err?.message || "failed" });
    return res.status(500).json({ ok: false, error: "TENANT_MAINTENANCE_GET_FAILED" });
  }
});

router.get("/landlord/maintenance", async (req: any, res) => {
  try {
    const role = roleOf(req);
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const landlordId = landlordIdOf(req);
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const statusFilter = normalizeWorkflowStatus(req.query?.status);
    const snap = await db
      .collection("maintenanceRequests")
      .where("landlordId", "==", landlordId)
      .limit(400)
      .get();
    let items = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
    if (statusFilter) {
      items = items.filter((item) => normalizeWorkflowStatus(item.status) === statusFilter);
    }
    items.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    return res.json({ ok: true, items, data: items });
  } catch (err: any) {
    console.error("[maintenance-v2] landlord list failed", { message: err?.message || "failed" });
    return res.status(500).json({ ok: false, error: "LANDLORD_MAINTENANCE_LIST_FAILED" });
  }
});

router.patch("/landlord/maintenance/:id", async (req: any, res) => {
  try {
    const role = roleOf(req);
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const landlordId = landlordIdOf(req);
    const actorId = String(req.user?.id || "").trim() || landlordId;
    const id = String(req.params?.id || "").trim();
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const ref = db.collection("maintenanceRequests").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const current = { id: snap.id, ...(snap.data() as any) };
    if (String(current.landlordId || "") !== landlordId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const currentStatus = normalizeWorkflowStatus(current.status) || "submitted";
    const nextStatus = req.body?.status === undefined ? null : normalizeWorkflowStatus(req.body?.status);
    if (req.body?.status !== undefined && !nextStatus) {
      return res.status(400).json({ ok: false, error: "INVALID_STATUS" });
    }
    if (nextStatus && !canTransitionWorkflowStatus(currentStatus, nextStatus)) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_STATUS_TRANSITION",
        currentStatus,
        nextStatus,
      });
    }

    const update: any = {
      updatedAt: Date.now(),
      lastUpdatedBy: "LANDLORD",
    };
    if (nextStatus) update.status = nextStatus;
    if (req.body?.priority !== undefined) {
      const rawPriority = String(req.body.priority || "").trim().toLowerCase();
      update.priority = ["low", "normal", "urgent"].includes(rawPriority) ? rawPriority : current.priority || "normal";
    }
    if (req.body?.landlordNote !== undefined) {
      update.landlordNote = req.body.landlordNote === null ? null : String(req.body.landlordNote || "").trim().slice(0, 5000);
    }
    await ref.set(update, { merge: true });
    if (nextStatus && nextStatus !== currentStatus) {
      await appendStatusHistory(id, {
        status: nextStatus,
        actorRole: role === "admin" ? "admin" : "landlord",
        actorId,
        message: String(req.body?.message || `Status changed to ${nextStatus}`).slice(0, 500),
      });
    }

    const refreshedSnap = await ref.get();
    const refreshed = { id: refreshedSnap.id, ...(refreshedSnap.data() as any) };
    const tenantEmail = await lookupEmailFromDoc([
      ["tenants", String(refreshed.tenantId || "")],
      ["users", String(refreshed.tenantId || "")],
    ]);
    if (nextStatus && nextStatus !== currentStatus) {
      await sendMaintenanceStatusEmail({
        to: tenantEmail,
        subject: `Maintenance request updated: ${String(refreshed.title || "Request")}`,
        intro: `Your maintenance request status changed to ${nextStatus}.`,
        requestId: id,
      });
    }

    return res.json({ ok: true, item: refreshed, data: refreshed });
  } catch (err: any) {
    console.error("[maintenance-v2] landlord patch failed", { message: err?.message || "failed" });
    return res.status(500).json({ ok: false, error: "LANDLORD_MAINTENANCE_PATCH_FAILED" });
  }
});

router.get("/landlord/maintenance/contractors", async (req: any, res) => {
  try {
    const role = roleOf(req);
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const landlordId = landlordIdOf(req);
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const snap = await db
      .collection("contractorProfiles")
      .where("invitedByLandlordIds", "array-contains", landlordId)
      .limit(200)
      .get();
    const items = snap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as any) }))
      .filter((item) => item.isActive !== false)
      .sort((a, b) =>
        String(a.businessName || a.contactName || a.email || "").localeCompare(
          String(b.businessName || b.contactName || b.email || "")
        )
      )
      .map((item) => ({
        id: item.id,
        businessName: String(item.businessName || "").trim() || null,
        contactName: String(item.contactName || "").trim() || null,
        email: String(item.email || "").trim() || null,
      }));

    return res.json({ ok: true, items, data: items });
  } catch (err: any) {
    console.error("[maintenance-v2] landlord contractor list failed", { message: err?.message || "failed" });
    return res.status(500).json({ ok: false, error: "LANDLORD_MAINTENANCE_CONTRACTOR_LIST_FAILED" });
  }
});

router.post("/landlord/maintenance/:id/assign", async (req: any, res) => {
  try {
    const role = roleOf(req);
    if (role !== "landlord" && role !== "admin") return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    const landlordId = landlordIdOf(req);
    const actorId = String(req.user?.id || "").trim() || landlordId;
    const id = String(req.params?.id || "").trim();
    const contractorId = String(req.body?.contractorId || "").trim();
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    if (!contractorId) return res.status(400).json({ ok: false, error: "CONTRACTOR_ID_REQUIRED" });

    const ref = db.collection("maintenanceRequests").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const current = { id: snap.id, ...(snap.data() as any) };
    if (String(current.landlordId || "") !== landlordId) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const currentStatus = normalizeWorkflowStatus(current.status) || "submitted";
    if (!["reviewed", "assigned"].includes(currentStatus)) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_STATUS_TRANSITION",
        currentStatus,
        nextStatus: "assigned",
      });
    }

    const contractorProfileSnap = await db.collection("contractorProfiles").doc(contractorId).get();
    const contractorProfile = contractorProfileSnap.exists ? (contractorProfileSnap.data() as any) : {};
    const contractorName =
      String(contractorProfile?.businessName || contractorProfile?.contactName || "").trim() || null;

    await ref.set(
      {
        assignedContractorId: contractorId,
        assignedContractorName: contractorName,
        status: "assigned",
        updatedAt: Date.now(),
        lastUpdatedBy: "LANDLORD",
      },
      { merge: true }
    );
    await appendStatusHistory(id, {
      status: "assigned",
      actorRole: role === "admin" ? "admin" : "landlord",
      actorId,
      message: contractorName ? `Assigned contractor: ${contractorName}` : "Assigned contractor",
    });

    const refreshedSnap = await ref.get();
    const refreshed = { id: refreshedSnap.id, ...(refreshedSnap.data() as any) };
    const [tenantEmail, contractorEmail] = await Promise.all([
      lookupEmailFromDoc([
        ["tenants", String(refreshed.tenantId || "")],
        ["users", String(refreshed.tenantId || "")],
      ]),
      lookupEmailFromDoc([
        ["contractorProfiles", contractorId],
        ["users", contractorId],
      ]),
    ]);

    await Promise.all([
      sendMaintenanceStatusEmail({
        to: tenantEmail,
        subject: `Contractor assigned: ${String(refreshed.title || "Maintenance request")}`,
        intro: "A contractor has been assigned to your maintenance request.",
        requestId: id,
      }),
      sendMaintenanceStatusEmail({
        to: contractorEmail,
        subject: `New maintenance job assigned: ${String(refreshed.title || "Maintenance request")}`,
        intro: "You have been assigned a maintenance job in RentChain.",
        requestId: id,
      }),
    ]);

    return res.json({ ok: true, item: refreshed, data: refreshed });
  } catch (err: any) {
    console.error("[maintenance-v2] landlord assign failed", { message: err?.message || "failed" });
    return res.status(500).json({ ok: false, error: "LANDLORD_MAINTENANCE_ASSIGN_FAILED" });
  }
});

router.get("/contractor/jobs", async (req: any, res) => {
  try {
    const access = await resolveContractorAccess(req);
    if (access.role !== "contractor" && access.role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const contractorId = access.contractorId;
    if (!contractorId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const statusFilter = normalizeWorkflowStatus(req.query?.status);
    const snap = await db
      .collection("maintenanceRequests")
      .where("assignedContractorId", "==", contractorId)
      .limit(300)
      .get();
    let items = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
    if (statusFilter) {
      items = items.filter((item) => normalizeWorkflowStatus(item.status) === statusFilter);
    }
    items.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    return res.json({ ok: true, items, data: items });
  } catch (err: any) {
    console.error("[maintenance-v2] contractor jobs failed", { message: err?.message || "failed" });
    return res.status(500).json({ ok: false, error: "CONTRACTOR_MAINTENANCE_LIST_FAILED" });
  }
});

router.patch("/contractor/jobs/:id/status", async (req: any, res) => {
  try {
    const access = await resolveContractorAccess(req);
    if (access.role !== "contractor" && access.role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const contractorId = access.contractorId;
    const actorId = String(req.user?.id || "").trim() || contractorId;
    const id = String(req.params?.id || "").trim();
    if (!contractorId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const nextStatus = normalizeWorkflowStatus(req.body?.status);
    if (!nextStatus || !["assigned", "scheduled", "in_progress", "completed"].includes(nextStatus)) {
      return res.status(400).json({ ok: false, error: "INVALID_STATUS" });
    }

    const ref = db.collection("maintenanceRequests").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const item = { id: snap.id, ...(snap.data() as any) };
    if (String(item.assignedContractorId || "") !== contractorId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const currentStatus = normalizeWorkflowStatus(item.status) || "assigned";
    const isAcknowledgement = nextStatus === "assigned" && currentStatus === "assigned";
    if (!isAcknowledgement && !canTransitionWorkflowStatus(currentStatus, nextStatus)) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_STATUS_TRANSITION",
        currentStatus,
        nextStatus,
      });
    }

    const note = String(req.body?.message || "").trim().slice(0, 500);
    await ref.set(
      {
        status: nextStatus,
        contractorStatus: nextStatus,
        contractorLastUpdate: note || null,
        updatedAt: Date.now(),
        lastUpdatedBy: "CONTRACTOR",
      },
      { merge: true }
    );
    await appendStatusHistory(id, {
      status: nextStatus,
      actorRole: access.role === "admin" ? "admin" : "contractor",
      actorId,
      message:
        note ||
        (isAcknowledgement ? "Contractor accepted the assigned job" : `Contractor updated status to ${nextStatus}`),
    });

    const refreshedSnap = await ref.get();
    const refreshed = { id: refreshedSnap.id, ...(refreshedSnap.data() as any) };

    if (!isAcknowledgement) {
      const [tenantEmail, landlordEmail] = await Promise.all([
        lookupEmailFromDoc([
          ["tenants", String(refreshed.tenantId || "")],
          ["users", String(refreshed.tenantId || "")],
        ]),
        lookupEmailFromDoc([
          ["users", String(refreshed.landlordId || "")],
          ["landlords", String(refreshed.landlordId || "")],
        ]),
      ]);

      await Promise.all([
        sendMaintenanceStatusEmail({
          to: tenantEmail,
          subject: `Maintenance update: ${String(refreshed.title || "Request")}`,
          intro: `Your maintenance request is now ${nextStatus}.`,
          requestId: id,
        }),
        sendMaintenanceStatusEmail({
          to: landlordEmail,
          subject: `Contractor update: ${String(refreshed.title || "Request")}`,
          intro: `Contractor marked request as ${nextStatus}.`,
          requestId: id,
        }),
      ]);
    }

    return res.json({ ok: true, item: refreshed, data: refreshed });
  } catch (err: any) {
    console.error("[maintenance-v2] contractor status patch failed", {
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "CONTRACTOR_MAINTENANCE_PATCH_FAILED" });
  }
});

export default router;
