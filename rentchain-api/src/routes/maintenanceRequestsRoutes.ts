import { Router } from "express";
import { db, FieldValue } from "../config/firebase";
import { authenticateJwt } from "../middleware/authMiddleware";
import { verifyAuthToken } from "../auth/jwt";
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

function getBearerToken(req: any): string | null {
  const raw = req?.headers?.authorization || req?.headers?.Authorization;
  if (!raw || typeof raw !== "string") return null;
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

function fingerprint(value: string | null | undefined): string {
  const token = String(value || "").trim();
  if (!token) return "none";
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

async function resolveContractorAccess(req: any): Promise<{
  role: string;
  contractorId: string | null;
  directRole: string;
  directContractorId: string | null;
  jwtSub: string | null;
  jwtRole: string | null;
  jwtEmail: string | null;
  persistedUserRole: string | null;
  persistedAccountRole: string | null;
  source: string;
}> {
  const directRole = roleOf(req);
  const directContractorId = contractorIdOf(req);
  const rawToken = getBearerToken(req);
  let jwtSub: string | null = null;
  let jwtRole: string | null = null;
  let jwtEmail: string | null = null;

  try {
    if (rawToken) {
      const claims = verifyAuthToken(rawToken) as any;
      jwtSub = String(claims?.sub || "").trim() || null;
      jwtRole = String(claims?.role || "").trim().toLowerCase() || null;
      jwtEmail = String(claims?.email || "").trim().toLowerCase() || null;
    }
  } catch {
    // auth middleware already handles invalid bearer tokens
  }

  if (directRole === "contractor" || directRole === "admin") {
    return {
      role: directRole,
      contractorId: directContractorId,
      directRole,
      directContractorId,
      jwtSub,
      jwtRole,
      jwtEmail,
      persistedUserRole: null,
      persistedAccountRole: null,
      source: "direct_request_user",
    };
  }

  const userId = String(req.user?.id || jwtSub || "").trim();
  let userData: any = null;
  let accountData: any = null;

  if (userId) {
    const [userSnap, accountSnap] = await Promise.all([
      db.collection("users").doc(userId).get(),
      db.collection("accounts").doc(userId).get(),
    ]);
    userData = userSnap.exists ? (userSnap.data() as any) : null;
    accountData = accountSnap.exists ? (accountSnap.data() as any) : null;
  }

  let persistedUserRole = String(userData?.actorRole || userData?.role || "").trim().toLowerCase() || null;
  let persistedAccountRole = String(accountData?.actorRole || accountData?.role || "").trim().toLowerCase() || null;
  let resolvedRole = persistedUserRole || persistedAccountRole || directRole || jwtRole || "";
  let resolvedContractorId =
    String(userData?.contractorId || accountData?.contractorId || directContractorId || userId || "").trim() || null;
  let source = userId ? "persisted_by_user_id" : "no_identity";

  if (resolvedRole !== "contractor" && resolvedRole !== "admin") {
    const lookupEmail = String(req.user?.email || jwtEmail || "").trim().toLowerCase();
    if (lookupEmail) {
      const [userByEmailSnap, accountByEmailSnap, contractorProfileSnap] = await Promise.all([
        db.collection("users").where("email", "==", lookupEmail).limit(1).get(),
        db.collection("accounts").where("email", "==", lookupEmail).limit(1).get(),
        db.collection("contractorProfiles").where("email", "==", lookupEmail).limit(1).get(),
      ]);
      const userByEmail = !userByEmailSnap.empty ? (userByEmailSnap.docs[0].data() as any) : null;
      const accountByEmail = !accountByEmailSnap.empty ? (accountByEmailSnap.docs[0].data() as any) : null;
      const contractorProfile = !contractorProfileSnap.empty ? (contractorProfileSnap.docs[0].data() as any) : null;
      const emailUserRole = String(userByEmail?.actorRole || userByEmail?.role || "").trim().toLowerCase();
      const emailAccountRole = String(accountByEmail?.actorRole || accountByEmail?.role || "").trim().toLowerCase();
      const emailResolvedRole = emailUserRole || emailAccountRole || (contractorProfile ? "contractor" : "");
      const emailResolvedContractorId =
        String(
          userByEmail?.contractorId ||
            accountByEmail?.contractorId ||
            contractorProfile?.userId ||
            contractorProfileSnap.docs[0]?.id ||
            ""
        ).trim() || null;
      if (emailResolvedRole === "contractor" || emailResolvedRole === "admin") {
        resolvedRole = emailResolvedRole;
        resolvedContractorId = emailResolvedContractorId || resolvedContractorId;
        persistedUserRole = persistedUserRole || emailUserRole || null;
        persistedAccountRole = persistedAccountRole || emailAccountRole || null;
        source = "persisted_by_email";
      }
    }
  }

  return {
    role: resolvedRole,
    contractorId: resolvedContractorId,
    directRole,
    directContractorId,
    jwtSub,
    jwtRole,
    jwtEmail,
    persistedUserRole,
    persistedAccountRole,
    source,
  };
}

function logContractorAccess(event: string, access: Awaited<ReturnType<typeof resolveContractorAccess>>, extra?: Record<string, unknown>) {
  console.info(`[maintenance-v2] contractor-access:${event}`, {
    directRole: access.directRole || null,
    directContractorId: access.directContractorId || null,
    jwtSub: access.jwtSub || null,
    jwtRole: access.jwtRole || null,
    jwtEmail: access.jwtEmail || null,
    persistedUserRole: access.persistedUserRole || null,
    persistedAccountRole: access.persistedAccountRole || null,
    resolvedRole: access.role || null,
    resolvedContractorId: access.contractorId || null,
    source: access.source,
    ...extra,
  });
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
  workOrderId?: string | null;
  event: string;
}) {
  const to = String(params.to || "").trim();
  const provider = String(process.env.EMAIL_PROVIDER || "mailgun").trim().toLowerCase() || "mailgun";
  const from =
    process.env.EMAIL_FROM ||
    process.env.FROM_EMAIL ||
    process.env.SENDGRID_FROM_EMAIL ||
    process.env.SENDGRID_FROM;
  const replyTo = process.env.SENDGRID_REPLY_TO || process.env.SENDGRID_REPLYTO_EMAIL;
  if (!to || !emailRegex.test(to)) {
    console.warn("[maintenance-v2] notification skipped", {
      event: params.event,
      maintenanceRequestId: params.requestId,
      workOrderId: params.workOrderId || null,
      to: to || null,
      provider,
      reason: "INVALID_RECIPIENT",
    });
    return { ok: false, attempted: false, provider, to, reason: "INVALID_RECIPIENT" } as const;
  }
  if (!from) {
    console.error("[maintenance-v2] notification failed", {
      event: params.event,
      maintenanceRequestId: params.requestId,
      workOrderId: params.workOrderId || null,
      to,
      provider,
      reason: "EMAIL_FROM_MISSING",
    });
    return { ok: false, attempted: false, provider, to, reason: "EMAIL_FROM_MISSING" } as const;
  }
  const baseUrl =
    (process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
  const requestLink = `${baseUrl}/tenant/maintenance/${params.requestId}`;
  console.info("[maintenance-v2] notification attempt", {
    event: params.event,
    maintenanceRequestId: params.requestId,
    workOrderId: params.workOrderId || null,
    to,
    provider,
  });
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
    console.info("[maintenance-v2] notification sent", {
      event: params.event,
      maintenanceRequestId: params.requestId,
      workOrderId: params.workOrderId || null,
      to,
      provider,
      ok: true,
    });
    return { ok: true, attempted: true, provider, to } as const;
  } catch (err: any) {
    console.error("[maintenance-v2] notification failed", {
      event: params.event,
      to,
      maintenanceRequestId: params.requestId,
      workOrderId: params.workOrderId || null,
      provider,
      message: err?.message || "send_failed",
    });
    return { ok: false, attempted: true, provider, to, reason: err?.message || "send_failed" } as const;
  }
}

async function upsertMaintenanceWorkOrder(input: {
  maintenanceRequestId: string;
  landlordId: string | null;
  propertyId: string | null;
  unitId: string | null;
  tenantId: string | null;
  assignedContractorId: string | null;
  assignedContractorName: string | null;
  title: string | null;
  description: string | null;
  category: string | null;
  priority: string | null;
  status: string | null;
}) {
  const workOrderId = `maintenance_${input.maintenanceRequestId}`;
  const ref = db.collection("workOrders").doc(workOrderId);
  const existing = await ref.get();
  const existingData = existing.exists ? ((existing.data() as any) || {}) : {};
  const createdAtMs = Number(existingData.createdAtMs || existingData.createdAt || Date.now()) || Date.now();
  const now = Date.now();
  const payload = {
    id: workOrderId,
    maintenanceRequestId: input.maintenanceRequestId,
    landlordId: input.landlordId || null,
    propertyId: input.propertyId || null,
    unitId: input.unitId || null,
    tenantId: input.tenantId || null,
    assignedContractorId: input.assignedContractorId || null,
    assignedContractorName: input.assignedContractorName || null,
    title: String(input.title || "").trim() || "Maintenance request",
    description: String(input.description || "").trim() || "",
    category: String(input.category || "").trim() || "GENERAL",
    priority: String(input.priority || "").trim() || "normal",
    status: String(input.status || "assigned").trim() || "assigned",
    visibility: "private",
    createdAt: createdAtMs,
    updatedAt: now,
    createdAtMs,
    updatedAtMs: now,
  };
  await ref.set(payload, { merge: true });
  console.info("[maintenance-v2] work-order upserted", {
    maintenanceRequestId: input.maintenanceRequestId,
    workOrderId,
    assignedContractorId: input.assignedContractorId || null,
    status: payload.status,
    created: !existing.exists,
  });
  return { workOrderId, payload };
}

function shapeContractorJobFromSources(workOrder: any, maintenance: any) {
  const maintenanceId =
    String(workOrder?.maintenanceRequestId || maintenance?.id || "").trim() || String(workOrder?.id || "").trim();
  const status = normalizeWorkflowStatus(workOrder?.status || maintenance?.status) || "assigned";
  return {
    ...(maintenance || {}),
    ...(workOrder || {}),
    id: maintenanceId,
    workOrderId: String(workOrder?.id || "").trim() || null,
    maintenanceRequestId: maintenanceId,
    landlordId: String(workOrder?.landlordId || maintenance?.landlordId || "").trim() || null,
    tenantId: String(workOrder?.tenantId || maintenance?.tenantId || "").trim() || null,
    propertyId: String(workOrder?.propertyId || maintenance?.propertyId || "").trim() || null,
    unitId: String(workOrder?.unitId || maintenance?.unitId || "").trim() || null,
    assignedContractorId:
      String(workOrder?.assignedContractorId || maintenance?.assignedContractorId || "").trim() || null,
    assignedContractorName:
      String(workOrder?.assignedContractorName || maintenance?.assignedContractorName || "").trim() || null,
    title: String(workOrder?.title || maintenance?.title || "").trim() || "Maintenance request",
    description: String(workOrder?.description || maintenance?.description || "").trim() || "",
    category: String(workOrder?.category || maintenance?.category || "").trim() || "GENERAL",
    priority: String(workOrder?.priority || maintenance?.priority || "").trim() || "normal",
    status,
    contractorStatus:
      String(maintenance?.contractorStatus || workOrder?.contractorStatus || status).trim() || status,
    contractorLastUpdate:
      String(maintenance?.contractorLastUpdate || workOrder?.contractorLastUpdate || "").trim() || null,
    tenantName: String(maintenance?.tenantName || "").trim() || null,
    propertyLabel: String(maintenance?.propertyLabel || "").trim() || null,
    unitLabel: String(maintenance?.unitLabel || "").trim() || null,
    notes: String(maintenance?.notes || "").trim() || null,
    landlordNote: String(maintenance?.landlordNote || "").trim() || null,
    createdAt:
      Number(maintenance?.createdAt || workOrder?.createdAt || workOrder?.createdAtMs || Date.now()) || Date.now(),
    updatedAt:
      Number(maintenance?.updatedAt || workOrder?.updatedAt || workOrder?.updatedAtMs || Date.now()) || Date.now(),
    statusHistory: Array.isArray(maintenance?.statusHistory) ? maintenance.statusHistory : [],
  };
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
        event: "tenant_maintenance_created_notify_landlord",
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
    let workOrderId: string | null = null;
    if (String(refreshed.assignedContractorId || "").trim()) {
      const workOrder = await upsertMaintenanceWorkOrder({
        maintenanceRequestId: id,
        landlordId: String(refreshed.landlordId || landlordId || "").trim() || null,
        propertyId: String(refreshed.propertyId || "").trim() || null,
        unitId: String(refreshed.unitId || "").trim() || null,
        tenantId: String(refreshed.tenantId || "").trim() || null,
        assignedContractorId: String(refreshed.assignedContractorId || "").trim() || null,
        assignedContractorName: String(refreshed.assignedContractorName || "").trim() || null,
        title: String(refreshed.title || "").trim() || null,
        description: String(refreshed.description || "").trim() || null,
        category: String(refreshed.category || "").trim() || null,
        priority: String(refreshed.priority || "").trim() || null,
        status: String(refreshed.status || nextStatus || currentStatus).trim() || currentStatus,
      });
      workOrderId = workOrder.workOrderId;
    }
    const tenantEmail = await lookupEmailFromDoc([
      ["tenants", String(refreshed.tenantId || "")],
      ["users", String(refreshed.tenantId || "")],
    ]);
    let tenantNotification = null;
    if (nextStatus && nextStatus !== currentStatus) {
      tenantNotification = await sendMaintenanceStatusEmail({
        to: tenantEmail,
        subject: `Maintenance request updated: ${String(refreshed.title || "Request")}`,
        intro: `Your maintenance request status changed to ${nextStatus}.`,
        requestId: id,
        workOrderId,
        event: "landlord_maintenance_status_notify_tenant",
      });
    }

    return res.json({ ok: true, item: refreshed, data: refreshed, workOrderId, notifications: { tenant: tenantNotification } });
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
    const rawContractorId =
      String(req.body?.contractorId || req.body?.contractorUserId || req.body?.acceptedByUserId || "").trim();
    const inviteId = String(req.body?.inviteId || "").trim() || null;
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    console.info("[maintenance-v2] assignment request", {
      maintenanceRequestId: id,
      landlordId,
      payload: {
        contractorId: req.body?.contractorId ?? null,
        contractorUserId: req.body?.contractorUserId ?? null,
        acceptedByUserId: req.body?.acceptedByUserId ?? null,
        inviteId,
      },
    });

    let resolvedContractorId = rawContractorId;
    let inviteData: any = null;
    if (!resolvedContractorId && inviteId) {
      const inviteSnap = await db.collection("contractorInvites").doc(inviteId).get();
      if (!inviteSnap.exists) {
        return res.status(404).json({ ok: false, error: "CONTRACTOR_INVITE_NOT_FOUND" });
      }
      inviteData = inviteSnap.data() as any;
      if (String(inviteData?.landlordId || "").trim() !== landlordId) {
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }
      resolvedContractorId = String(inviteData?.acceptedByUserId || "").trim();
    }
    if (!resolvedContractorId) {
      return res.status(400).json({ ok: false, error: "CONTRACTOR_ID_REQUIRED" });
    }

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

    let profileSnap = await db.collection("contractorProfiles").doc(resolvedContractorId).get();
    let userSnap = await db.collection("users").doc(resolvedContractorId).get();
    let accountSnap = await db.collection("accounts").doc(resolvedContractorId).get();
    let contractorProfile = profileSnap.exists ? (profileSnap.data() as any) : null;
    let userData = userSnap.exists ? (userSnap.data() as any) : null;
    let accountData = accountSnap.exists ? (accountSnap.data() as any) : null;

    const profileUserId = String(contractorProfile?.userId || "").trim() || null;
    if ((!userData && !accountData) && profileUserId) {
      resolvedContractorId = profileUserId;
      userSnap = await db.collection("users").doc(resolvedContractorId).get();
      accountSnap = await db.collection("accounts").doc(resolvedContractorId).get();
      profileSnap = await db.collection("contractorProfiles").doc(resolvedContractorId).get();
      contractorProfile = profileSnap.exists ? (profileSnap.data() as any) : contractorProfile;
      userData = userSnap.exists ? (userSnap.data() as any) : null;
      accountData = accountSnap.exists ? (accountSnap.data() as any) : null;
    }

    const persistedRole = String(
      userData?.actorRole || userData?.role || accountData?.actorRole || accountData?.role || ""
    ).trim().toLowerCase();
    if (!profileSnap.exists && persistedRole !== "contractor" && role !== "admin") {
      console.error("[maintenance-v2] assignment resolution failed", {
        maintenanceRequestId: id,
        landlordId,
        rawContractorId,
        resolvedContractorId,
        inviteId,
        persistedRole: persistedRole || null,
        hasProfile: profileSnap.exists,
      });
      return res.status(400).json({ ok: false, error: "INVALID_CONTRACTOR_ID" });
    }

    const contractorName =
      String(
        contractorProfile?.businessName ||
          contractorProfile?.contactName ||
          userData?.fullName ||
          userData?.name ||
          accountData?.fullName ||
          accountData?.name ||
          accountData?.businessName ||
          ""
      ).trim() || null;
    const contractorEmail =
      String(contractorProfile?.email || userData?.email || accountData?.email || inviteData?.email || "").trim() || null;

    console.info("[maintenance-v2] assignment resolved", {
      maintenanceRequestId: id,
      landlordId,
      rawContractorId: rawContractorId || null,
      resolvedContractorId,
      inviteId,
      contractorName,
      contractorEmail,
      persistedRole: persistedRole || null,
      hasProfile: profileSnap.exists,
    });

    const now = Date.now();
    const workOrderId = `maintenance_${id}`;
    const batch = db.batch();
    batch.set(
      ref,
      {
        assignedContractorId: resolvedContractorId,
        assignedContractorName: contractorName,
        status: "assigned",
        updatedAt: now,
        lastUpdatedBy: "LANDLORD",
        statusHistory: FieldValue.arrayUnion({
          status: "assigned",
          actorRole: role === "admin" ? "admin" : "landlord",
          actorId,
          message: contractorName ? `Assigned contractor: ${contractorName}` : `Assigned contractor: ${resolvedContractorId}`,
          createdAt: now,
        }),
      },
      { merge: true }
    );
    batch.set(
      db.collection("workOrders").doc(workOrderId),
      {
        id: workOrderId,
        maintenanceRequestId: id,
        landlordId: String(current.landlordId || landlordId || "").trim() || null,
        propertyId: String(current.propertyId || "").trim() || null,
        unitId: String(current.unitId || "").trim() || null,
        tenantId: String(current.tenantId || "").trim() || null,
        assignedContractorId: resolvedContractorId,
        assignedContractorName: contractorName,
        title: String(current.title || "").trim() || "Maintenance request",
        description: String(current.description || "").trim() || "",
        category: String(current.category || "").trim() || "GENERAL",
        priority: String(current.priority || "").trim() || "normal",
        status: "assigned",
        visibility: "private",
        createdAt: Number(current.createdAt || now) || now,
        updatedAt: now,
        createdAtMs: Number(current.createdAt || now) || now,
        updatedAtMs: now,
      },
      { merge: true }
    );
    await batch.commit();

    const [refreshedSnap, workOrderSnap] = await Promise.all([
      ref.get(),
      db.collection("workOrders").doc(workOrderId).get(),
    ]);
    const refreshed = { id: refreshedSnap.id, ...(refreshedSnap.data() as any) };
    const workOrder = workOrderSnap.exists ? { id: workOrderSnap.id, ...(workOrderSnap.data() as any) } : null;
    const maintenanceAssignedContractorId = String(refreshed.assignedContractorId || "").trim() || null;
    const workOrderAssignedContractorId = String(workOrder?.assignedContractorId || "").trim() || null;

    console.info("[maintenance-v2] assignment persisted", {
      maintenanceRequestId: id,
      workOrderId,
      resolvedContractorId,
      maintenanceAssignedContractorId,
      workOrderAssignedContractorId,
      assignedContractorName: String(refreshed.assignedContractorName || workOrder?.assignedContractorName || "").trim() || null,
    });

    if (maintenanceAssignedContractorId !== resolvedContractorId || workOrderAssignedContractorId !== resolvedContractorId) {
      console.error("[maintenance-v2] assignment persistence mismatch", {
        maintenanceRequestId: id,
        workOrderId,
        resolvedContractorId,
        maintenanceAssignedContractorId,
        workOrderAssignedContractorId,
      });
      return res.status(500).json({
        ok: false,
        error: "ASSIGNMENT_PERSIST_FAILED",
        maintenanceAssignedContractorId,
        workOrderAssignedContractorId,
      });
    }

    const tenantEmail = await lookupEmailFromDoc([
      ["tenants", String(refreshed.tenantId || "")],
      ["users", String(refreshed.tenantId || "")],
    ]);
    const [tenantNotification, contractorNotification] = await Promise.all([
      sendMaintenanceStatusEmail({
        to: tenantEmail,
        subject: `Contractor assigned: ${String(refreshed.title || "Maintenance request")}`,
        intro: "A contractor has been assigned to your maintenance request.",
        requestId: id,
        workOrderId,
        event: "landlord_assignment_notify_tenant",
      }),
      sendMaintenanceStatusEmail({
        to: contractorEmail,
        subject: `New maintenance job assigned: ${String(refreshed.title || "Maintenance request")}`,
        intro: "You have been assigned a maintenance job in RentChain.",
        requestId: id,
        workOrderId,
        event: "landlord_assignment_notify_contractor",
      }),
    ]);

    return res.json({
      ok: true,
      item: refreshed,
      data: refreshed,
      workOrderId,
      resolvedContractorId,
      notifications: {
        tenant: tenantNotification,
        contractor: contractorNotification,
      },
    });
  } catch (err: any) {
    console.error("[maintenance-v2] landlord assign failed", { message: err?.message || "failed" });
    return res.status(500).json({ ok: false, error: "LANDLORD_MAINTENANCE_ASSIGN_FAILED" });
  }
});

router.get("/contractor/jobs", async (req: any, res) => {
  try {
    const access = await resolveContractorAccess(req);
    if (access.role !== "contractor" && access.role !== "admin") {
      logContractorAccess("forbidden_role", access, { authorization: fingerprint(getBearerToken(req)) });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const contractorId = access.contractorId;
    if (!contractorId) {
      logContractorAccess("missing_contractor_id", access, { authorization: fingerprint(getBearerToken(req)) });
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const statusFilter = normalizeWorkflowStatus(req.query?.status);
    const workOrderSnap = await db
      .collection("workOrders")
      .where("assignedContractorId", "==", contractorId)
      .limit(300)
      .get();
    const workOrders = workOrderSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
    const maintenanceIds = Array.from(
      new Set(
        workOrders
          .map((item) => String(item.maintenanceRequestId || "").trim())
          .filter(Boolean)
      )
    );
    const maintenanceDocs = await Promise.all(
      maintenanceIds.map(async (maintenanceId) => {
        const maintenanceSnap = await db.collection("maintenanceRequests").doc(maintenanceId).get();
        return maintenanceSnap.exists ? { id: maintenanceSnap.id, ...(maintenanceSnap.data() as any) } : null;
      })
    );
    const maintenanceMap = new Map(
      maintenanceDocs.filter((item): item is any => Boolean(item)).map((item) => [String(item.id), item])
    );

    let items = workOrders
      .map((workOrder) => shapeContractorJobFromSources(workOrder, maintenanceMap.get(String(workOrder.maintenanceRequestId || "").trim()) || null))
      .filter((item) => Boolean(item?.id) && Boolean(item?.title) && Boolean(item?.description));
    if (statusFilter) {
      items = items.filter((item) => normalizeWorkflowStatus(item.status) === statusFilter);
    }
    items.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    console.info("[maintenance-v2] contractor-jobs result", {
      contractorId,
      workOrderCount: workOrders.length,
      jobCount: items.length,
      statusFilter: statusFilter || null,
      source: "workOrders",
    });
    logContractorAccess("allowed", access, { authorization: fingerprint(getBearerToken(req)), matchedJobs: items.length, source: "workOrders" });
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
      logContractorAccess("status_forbidden_role", access, { authorization: fingerprint(getBearerToken(req)), requestId: String(req.params?.id || "").trim() || null });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const contractorId = access.contractorId;
    const actorId = String(req.user?.id || "").trim() || contractorId;
    const id = String(req.params?.id || "").trim();
    if (!contractorId) {
      logContractorAccess("status_missing_contractor_id", access, { authorization: fingerprint(getBearerToken(req)), requestId: id || null });
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }
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
      logContractorAccess("status_assignee_mismatch", access, { authorization: fingerprint(getBearerToken(req)), requestId: id, assignedContractorId: String(item.assignedContractorId || "") || null });
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
    const workOrder = await upsertMaintenanceWorkOrder({
      maintenanceRequestId: id,
      landlordId: String(item.landlordId || "").trim() || null,
      propertyId: String(item.propertyId || "").trim() || null,
      unitId: String(item.unitId || "").trim() || null,
      tenantId: String(item.tenantId || "").trim() || null,
      assignedContractorId: contractorId,
      assignedContractorName: String(item.assignedContractorName || "").trim() || null,
      title: String(item.title || "").trim() || null,
      description: String(item.description || "").trim() || null,
      category: String(item.category || "").trim() || null,
      priority: String(item.priority || "").trim() || null,
      status: nextStatus,
    });

    const refreshedSnap = await ref.get();
    const refreshed = { id: refreshedSnap.id, ...(refreshedSnap.data() as any) };

    let notifications = null;
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

      const [tenantNotification, landlordNotification] = await Promise.all([
        sendMaintenanceStatusEmail({
          to: tenantEmail,
          subject: `Maintenance update: ${String(refreshed.title || "Request")}`,
          intro: `Your maintenance request is now ${nextStatus}.`,
          requestId: id,
          workOrderId: workOrder.workOrderId,
          event: "contractor_status_notify_tenant",
        }),
        sendMaintenanceStatusEmail({
          to: landlordEmail,
          subject: `Contractor update: ${String(refreshed.title || "Request")}`,
          intro: `Contractor marked request as ${nextStatus}.`,
          requestId: id,
          workOrderId: workOrder.workOrderId,
          event: "contractor_status_notify_landlord",
        }),
      ]);
      notifications = {
        tenant: tenantNotification,
        landlord: landlordNotification,
      };
    }

    return res.json({ ok: true, item: refreshed, data: refreshed, workOrderId: workOrder.workOrderId, notifications });
  } catch (err: any) {
    console.error("[maintenance-v2] contractor status patch failed", {
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "CONTRACTOR_MAINTENANCE_PATCH_FAILED" });
  }
});

export default router;
