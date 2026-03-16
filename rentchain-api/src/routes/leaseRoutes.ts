import { Router, Request, Response } from "express";
import {
  CreateLeasePayload,
  leaseService,
  UpdateLeasePayload,
} from "../services/leaseService";
import { requireCapability } from "../services/capabilityGuard";
import { db } from "../config/firebase";
import { requireLandlord } from "../middleware/requireLandlord";
import {
  applyPatch,
  generateScheduleA,
  getDraftById,
  getSnapshotById,
  NS_PROVINCE,
  NS_TEMPLATE_VERSION,
  validateCreateInput,
} from "../services/leaseDraftsService";
import {
  getLeaseAutomationTasks,
  regenerateLeaseAutomationTasks,
} from "../services/automationScheduler/leaseAutomationTaskStore";
import { loadCanonicalPropertyLeases, loadUnitsForProperty, toCanonicalLeaseRecord } from "../services/leaseCanonicalizationService";
import { groupLeaseAgreementCandidates, pickAgreementWinner } from "../services/leasePartyConsolidationService";

const router = Router();
const LEDGER_COLLECTION = "ledgerEntries";
const PAYMENT_METHODS = new Set(["cash", "etransfer", "cheque", "bank", "card", "other"]);
const CHARGE_CATEGORIES = new Set(["rent", "fee", "adjustment"]);

type LedgerEntryType = "charge" | "payment";

function toIsoDate(input: unknown): string | null {
  const value = String(input || "").trim();
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function cents(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

function escapeCsvCell(value: unknown): string {
  const raw = String(value ?? "");
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

async function getLeaseForLandlord(leaseId: string, landlordId: string) {
  const leaseSnap = await db.collection("leases").doc(leaseId).get();
  if (!leaseSnap.exists) return { ok: false as const, status: 404, error: "Lease not found" };
  const lease = leaseSnap.data() as any;
  if (String(lease?.landlordId || "").trim() !== landlordId) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  return { ok: true as const, lease };
}

function toMillis(value: any): number {
  if (!value) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value?.toMillis === "function") {
    try {
      return Number(value.toMillis()) || 0;
    } catch {
      return 0;
    }
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeLeaseRow(id: string, raw: any) {
  return {
    id,
    landlordId: String(raw?.landlordId || "").trim() || null,
    tenantId: String(raw?.tenantId || raw?.primaryTenantId || raw?.tenantIds?.[0] || "").trim(),
    tenantIds: Array.isArray(raw?.tenantIds)
      ? raw.tenantIds.map((value: any) => String(value || "").trim()).filter(Boolean)
      : String(raw?.tenantId || raw?.primaryTenantId || "").trim()
      ? [String(raw?.tenantId || raw?.primaryTenantId || "").trim()]
      : [],
    primaryTenantId: String(raw?.primaryTenantId || raw?.tenantId || raw?.tenantIds?.[0] || "").trim() || null,
    propertyId: String(raw?.propertyId || "").trim(),
    unitId: String(raw?.unitId || "").trim() || null,
    unitNumber: String(raw?.unitNumber || raw?.unitId || raw?.unit || "").trim(),
    monthlyRent:
      typeof raw?.monthlyRent === "number"
        ? raw.monthlyRent
        : typeof raw?.currentRent === "number"
        ? raw.currentRent
        : typeof raw?.rent === "number"
        ? raw.rent
        : 0,
    startDate: String(raw?.startDate || raw?.leaseStartDate || raw?.leaseStart || "").trim(),
    endDate:
      raw?.endDate == null && raw?.leaseEndDate == null && raw?.leaseEnd == null
        ? null
        : String(raw?.endDate || raw?.leaseEndDate || raw?.leaseEnd || "").trim() || null,
    status: String(raw?.status || "active").trim().toLowerCase() || "active",
    createdAt: raw?.createdAt || null,
    updatedAt: raw?.updatedAt || null,
  };
}

function mergeLeaseRows(rows: any[]) {
  const byId = new Map<string, any>();
  for (const row of rows) {
    if (!row?.id) continue;
    byId.set(String(row.id), row);
  }
  return Array.from(byId.values()).sort((a, b) => {
    const updatedDiff = toMillis(b?.updatedAt) - toMillis(a?.updatedAt);
    if (updatedDiff !== 0) return updatedDiff;
    return toMillis(b?.createdAt) - toMillis(a?.createdAt);
  });
}

async function loadLedgerEntries(leaseId: string, landlordId: string, from?: string | null, to?: string | null) {
  let query: FirebaseFirestore.Query = db
    .collection(LEDGER_COLLECTION)
    .where("landlordId", "==", landlordId)
    .where("leaseId", "==", leaseId);

  if (from) query = query.where("effectiveDate", ">=", from);
  if (to) query = query.where("effectiveDate", "<=", to);
  query = query.orderBy("effectiveDate", "asc").orderBy("createdAt", "asc");
  const snap = await query.get();
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
}

async function enforceLeaseCapability(req: any, res: Response): Promise<boolean> {
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  const cap = await requireCapability(landlordId, "leases", req.user);
  if (!cap.ok) {
    res.status(403).json({ error: "Upgrade required", capability: "leases", plan: cap.plan });
    return false;
  }
  return true;
}

router.get("/", (_req: Request, res: Response) => {
  const leases = leaseService.getAll();
  res.json({ leases });
});

router.post("/drafts", requireLandlord, async (req: any, res: Response) => {
  try {
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
    const draft = validateCreateInput(landlordId, req.body || {});
    const ref = db.collection("leaseDrafts").doc();
    await ref.set(draft, { merge: false });
    return res.status(201).json({ ok: true, draftId: ref.id, draft: { id: ref.id, ...draft } });
  } catch (err: any) {
    const status = Number(err?.status || 500);
    if (status < 500) {
      return res.status(status).json({ ok: false, error: String(err?.code || "invalid_input") });
    }
    console.error("[POST /api/leases/drafts] error", err);
    return res.status(500).json({ ok: false, error: "Failed to create lease draft" });
  }
});

router.get("/drafts/:id", requireLandlord, async (req: any, res: Response) => {
  try {
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(400).json({ ok: false, error: "draft_id_required" });
    const snap = await getDraftById(id);
    if (!snap.exists) return res.status(404).json({ ok: false, error: "not_found" });
    const draft = snap.data() as any;
    if (String(draft?.landlordId || "").trim() !== landlordId) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }
    return res.json({ ok: true, draft: { id: snap.id, ...draft } });
  } catch (err) {
    console.error("[GET /api/leases/drafts/:id] error", err);
    return res.status(500).json({ ok: false, error: "Failed to load draft" });
  }
});

router.patch("/drafts/:id", requireLandlord, async (req: any, res: Response) => {
  try {
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(400).json({ ok: false, error: "draft_id_required" });
    const ref = db.collection("leaseDrafts").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "not_found" });
    const existing = snap.data() as any;
    if (String(existing?.landlordId || "").trim() !== landlordId) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }
    const next = applyPatch(existing, req.body || {});
    await ref.set(next, { merge: false });
    return res.json({ ok: true, draft: { id, ...next } });
  } catch (err: any) {
    const status = Number(err?.status || 500);
    if (status < 500) {
      return res.status(status).json({ ok: false, error: String(err?.code || "invalid_input") });
    }
    console.error("[PATCH /api/leases/drafts/:id] error", err);
    return res.status(500).json({ ok: false, error: "Failed to update draft" });
  }
});

router.post("/drafts/:id/generate", requireLandlord, async (req: any, res: Response) => {
  const correlationId = Math.random().toString(36).slice(2, 10);
  try {
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(400).json({ ok: false, error: "draft_id_required" });
    const ref = db.collection("leaseDrafts").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "not_found" });
    const draft = snap.data() as any;
    if (String(draft?.landlordId || "").trim() !== landlordId) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }
    if (String(draft?.province || "").toUpperCase() !== NS_PROVINCE) {
      return res.status(400).json({ ok: false, error: "province_not_supported" });
    }
    if (String(draft?.templateVersion || "") !== NS_TEMPLATE_VERSION) {
      return res.status(400).json({ ok: false, error: "template_version_invalid" });
    }

    const generated = await generateScheduleA({
      landlordId,
      draftId: id,
      draft,
      landlordDisplayName: String(
        req.user?.displayName || req.user?.name || req.user?.email || "Landlord"
      ),
      tenantDisplayNames: Array.isArray(req.body?.tenantNames)
        ? req.body.tenantNames.map((v: any) => String(v || "").trim()).filter(Boolean)
        : [],
      propertyAddressLine: String(req.body?.propertyAddress || "").trim() || String(draft.propertyId || ""),
      unitLabel: String(req.body?.unitLabel || "").trim() || String(draft.unitId || ""),
    });
    const file =
      generated.file ||
      ({
        kind: "schedule-a-pdf",
        url: "inline://schedule-a.pdf",
        sha256: generated.sha256,
        sizeBytes: generated.sizeBytes,
      } as const);

    const now = Date.now();
    const snapshotRef = db.collection("leaseSnapshots").doc();
    const snapshotDoc = {
      ...draft,
      status: "generated",
      generatedAt: now,
      generatedFiles: [file],
    };
    await snapshotRef.set(snapshotDoc, { merge: false });

    await ref.set(
      {
        ...draft,
        status: "generated",
        updatedAt: now,
        lastGeneratedSnapshotId: snapshotRef.id,
      },
      { merge: false }
    );

    const wantsInline =
      String(req.query?.inline || "").toLowerCase() === "1" ||
      String(req.headers?.accept || "").toLowerCase().includes("application/pdf") ||
      !generated.file;

    if (wantsInline) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="schedule-a.pdf"');
      return res.status(200).send(generated.pdfBuffer);
    }

    return res.status(201).json({
      ok: true,
      snapshotId: snapshotRef.id,
      scheduleAUrl: generated.file?.url || file.url,
      generatedFiles: [file],
    });
  } catch (err: any) {
    console.error("[POST /api/leases/drafts/:id/generate] error", {
      correlationId,
      draftId: String(req.params?.id || ""),
      landlordId: String(req.user?.landlordId || req.user?.id || ""),
      message: err?.message || String(err),
      stack: err?.stack || null,
    });
    return res
      .status(500)
      .json({ ok: false, error: "Failed to generate Schedule A PDF", correlationId });
  }
});

router.post("/drafts/:draftId/activate", requireLandlord, async (req: any, res: Response) => {
  try {
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const draftId = String(req.params?.draftId || "").trim();
    if (!draftId) return res.status(400).json({ ok: false, error: "draft_id_required" });

    const draftRef = db.collection("leaseDrafts").doc(draftId);
    const draftSnap = await draftRef.get();
    if (!draftSnap.exists) {
      return res.status(404).json({ ok: false, error: "draft_not_found" });
    }
    const draft = draftSnap.data() as any;
    if (String(draft?.landlordId || "").trim() !== landlordId) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const propertyId = String(draft?.propertyId || "").trim();
    const unitId = String(draft?.unitId || "").trim();
    const tenantIds = Array.isArray(draft?.tenantIds)
      ? draft.tenantIds.map((v: any) => String(v || "").trim()).filter(Boolean)
      : [];
    const termType = String(draft?.termType || "").trim();
    const startDate = String(draft?.startDate || "").trim();
    const endDate = draft?.endDate == null ? null : String(draft.endDate || "").trim();
    const baseRentCents = Number(draft?.baseRentCents || 0);
    const dueDay = Number(draft?.dueDay || 0);
    const paymentMethod = String(draft?.paymentMethod || "").trim();
    const province = String(draft?.province || "").toUpperCase();

    if (!propertyId) return res.status(400).json({ ok: false, error: "property_required" });
    if (!unitId) return res.status(400).json({ ok: false, error: "unit_required" });
    if (!tenantIds.length) return res.status(400).json({ ok: false, error: "tenant_required" });
    if (!startDate) return res.status(400).json({ ok: false, error: "start_date_required" });
    if (!termType) return res.status(400).json({ ok: false, error: "term_type_required" });
    if (termType === "fixed" && !endDate) {
      return res.status(400).json({ ok: false, error: "end_date_required" });
    }
    if (!Number.isFinite(baseRentCents) || baseRentCents <= 0) {
      return res.status(400).json({ ok: false, error: "base_rent_required" });
    }
    if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 31) {
      return res.status(400).json({ ok: false, error: "due_day_required" });
    }
    if (!paymentMethod) {
      return res.status(400).json({ ok: false, error: "payment_method_required" });
    }

    if (String(draft?.leaseId || "").trim()) {
      const existingLeaseId = String(draft.leaseId).trim();
      const existingLeaseSnap = await db.collection("leases").doc(existingLeaseId).get();
      if (existingLeaseSnap.exists) {
        return res.status(200).json({
          ok: true,
          leaseId: existingLeaseId,
          lease: { id: existingLeaseId, ...(existingLeaseSnap.data() as any) },
        });
      }
    }

    const now = Date.now();
    const tenantId = tenantIds[0];
    const leaseRef = db.collection("leases").doc();
    const leaseRecord: any = {
      landlordId,
      tenantId,
      tenantIds,
      primaryTenantId: tenantId,
      propertyId,
      unitId,
      unitNumber: unitId,
      province: province || "NS",
      termType,
      startDate,
      endDate: endDate || null,
      baseRentCents,
      monthlyRent: Math.round(baseRentCents / 100),
      parkingCents: Number(draft?.parkingCents || 0),
      dueDay,
      paymentMethod,
      nsfFeeCents: draft?.nsfFeeCents ?? null,
      utilitiesIncluded: Array.isArray(draft?.utilitiesIncluded) ? draft.utilitiesIncluded : [],
      depositCents: draft?.depositCents ?? null,
      additionalClauses: String(draft?.additionalClauses || ""),
      automationEnabled: true,
      renewalStatus: "unknown",
      status: "active",
      sourceDraftId: draftId,
      createdAt: now,
      updatedAt: now,
    };
    await leaseRef.set(leaseRecord, { merge: false });

    // Keep in-memory lease service in sync for existing automation/toggle flows.
    leaseService.getAll().push({
      id: leaseRef.id,
      tenantId,
      propertyId,
      unitNumber: unitId,
      monthlyRent: Math.round(baseRentCents / 100),
      startDate,
      endDate: endDate || null,
      automationEnabled: true,
      renewalStatus: "unknown",
      status: "active",
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    });

    await draftRef.set(
      {
        ...draft,
        status: "activated",
        leaseId: leaseRef.id,
        activatedAt: now,
        updatedAt: now,
      },
      { merge: false }
    );

    return res.status(200).json({
      ok: true,
      leaseId: leaseRef.id,
      lease: { id: leaseRef.id, ...leaseRecord },
    });
  } catch (err: any) {
    console.error("[POST /api/leases/drafts/:draftId/activate] error", err);
    return res.status(500).json({ ok: false, error: "Failed to activate lease draft" });
  }
});

router.get("/snapshots/:id", requireLandlord, async (req: any, res: Response) => {
  try {
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(400).json({ ok: false, error: "snapshot_id_required" });
    const snap = await getSnapshotById(id);
    if (!snap.exists) return res.status(404).json({ ok: false, error: "not_found" });
    const snapshot = snap.data() as any;
    if (String(snapshot?.landlordId || "").trim() !== landlordId) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }
    return res.json({ ok: true, snapshot: { id: snap.id, ...snapshot } });
  } catch (err) {
    console.error("[GET /api/leases/snapshots/:id] error", err);
    return res.status(500).json({ ok: false, error: "Failed to load snapshot" });
  }
});

router.post("/:id/automation/tasks/regenerate", requireLandlord, (req: any, res: Response) => {
  const lease = leaseService.getById(String(req.params?.id || "").trim());
  if (!lease) {
    return res.status(404).json({ ok: false, error: "Lease not found" });
  }
  const tasks = regenerateLeaseAutomationTasks({
    id: lease.id,
    startDate: lease.startDate,
    endDate: lease.endDate || null,
    automationEnabled: (lease as any).automationEnabled,
    renewalStatus: (lease as any).renewalStatus,
  });
  return res.status(200).json({ ok: true, tasks });
});

router.get("/:id/automation/tasks", requireLandlord, (req: any, res: Response) => {
  const lease = leaseService.getById(String(req.params?.id || "").trim());
  if (!lease) {
    return res.status(404).json({ ok: false, error: "Lease not found" });
  }
  const tasks = getLeaseAutomationTasks(lease.id);
  return res.status(200).json({ ok: true, tasks });
});

router.get("/:id", (req: Request, res: Response) => {
  const lease = leaseService.getById(req.params.id);
  if (!lease) {
    return res.status(404).json({ error: "Lease not found" });
  }
  res.json({ lease });
});

router.get("/tenant/:tenantId", requireLandlord, async (req: any, res: Response) => {
  const { tenantId } = req.params;
  if (!tenantId) {
    return res.status(400).json({ ok: false, error: "tenantId is required" });
  }
  const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
  const memoryLeases = leaseService.getByTenantId(tenantId).map((lease) => normalizeLeaseRow(String(lease.id), lease));
  try {
    const collectionRef: any = (db as any).collection("leases");
    if (!collectionRef || typeof collectionRef.where !== "function") {
      return res.status(200).json({ ok: true, leases: memoryLeases });
    }
    const [directSnap, arraySnap] = await Promise.all([
      collectionRef.where("tenantId", "==", tenantId).get().catch(() => ({ docs: [] })),
      collectionRef.where("tenantIds", "array-contains", tenantId).get().catch(() => ({ docs: [] })),
    ]);
    const firestoreLeases = [...(directSnap.docs || []), ...(arraySnap.docs || [])]
      .map((doc: any) => normalizeLeaseRow(doc.id, doc.data() as any))
      .filter((lease: any) => !landlordId || String(lease.landlordId || "").trim() === landlordId)
      .map(({ landlordId: _landlordId, ...lease }: any) => lease);
    return res.status(200).json({ ok: true, leases: mergeLeaseRows([...memoryLeases, ...firestoreLeases]) });
  } catch {
    return res.status(200).json({ ok: true, leases: memoryLeases });
  }
});

router.options("/tenant/:tenantId", (_req: Request, res: Response) => {
  return res.sendStatus(204);
});

router.get("/property/:propertyId", requireLandlord, async (req: any, res: Response) => {
  const { propertyId } = req.params;
  if (!propertyId) {
    return res.status(400).json({ error: "propertyId is required" });
  }
  const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
  const memoryLeases = leaseService.getByPropertyId(propertyId).map((lease) => normalizeLeaseRow(String(lease.id), lease));
  try {
    const collectionRef: any = (db as any).collection("leases");
    if (!collectionRef || typeof collectionRef.where !== "function") {
      return res.status(200).json({ leases: memoryLeases });
    }
    const snap = await collectionRef.where("propertyId", "==", propertyId).get();
    const firestoreLeaseRows = (snap.docs || [])
      .map((doc: any) => {
        const raw = doc.data() as any;
        const lease = normalizeLeaseRow(doc.id, raw);
        return { raw, lease: { ...lease, landlordId: String(raw?.landlordId || "").trim() } };
      })
      .filter((entry: any) => !landlordId || entry.lease.landlordId === landlordId);

    const combinedRows = [
      ...memoryLeases,
      ...firestoreLeaseRows.map((entry: any) => {
        const { landlordId: _landlordId, ...lease } = entry.lease;
        return lease;
      }),
    ];

    const units = await loadUnitsForProperty(db as any, propertyId, landlordId);
    const agreementCandidates = [
      ...memoryLeases.map((lease) => ({ lease: toCanonicalLeaseRecord(lease.id, lease as any, units), raw: lease as any })),
      ...firestoreLeaseRows.map((entry: any) => ({ lease: toCanonicalLeaseRecord(entry.lease.id, entry.raw, units), raw: entry.raw })),
    ].filter((entry) => entry.lease.status);
    const grouped = groupLeaseAgreementCandidates(agreementCandidates);
    const winnerIds = new Set<string>();
    grouped.mergeGroups.forEach((group) => winnerIds.add(pickAgreementWinner(group.candidates).lease.id));
    grouped.ambiguousGroups.forEach((group) => winnerIds.add(pickAgreementWinner(group.candidates).lease.id));
    grouped.singles.forEach((candidate) => winnerIds.add(candidate.lease.id));

    // Occupancy and rent roll consumers must operate on lease agreements, not per-tenant rows.
    return res.status(200).json({ leases: mergeLeaseRows(combinedRows.filter((lease) => winnerIds.has(lease.id))) });
  } catch (err) {
    console.warn("[GET /api/leases/property/:propertyId] firestore fallback", err);
    return res.status(200).json({ leases: memoryLeases });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    if (!(await enforceLeaseCapability(req, res))) return;
    const body = req.body as Partial<CreateLeasePayload>;
    if (!body.tenantId || !body.propertyId || !body.unitNumber) {
      return res.status(400).json({
        error: "tenantId, propertyId, and unitNumber are required",
      });
    }
    if (
      typeof body.monthlyRent !== "number" ||
      Number.isNaN(Number(body.monthlyRent))
    ) {
      return res.status(400).json({ error: "monthlyRent must be a number" });
    }
    if (!body.startDate) {
      return res.status(400).json({ error: "startDate is required" });
    }

    const existingActive = leaseService.getActiveByPropertyAndUnit(
      body.propertyId,
      body.unitNumber
    );
    if (existingActive) {
      return res.status(400).json({
        error: "An active lease already exists for this property and unit",
      });
    }

    const payload: CreateLeasePayload = {
      tenantId: body.tenantId,
      propertyId: body.propertyId,
      unitNumber: body.unitNumber,
      monthlyRent: Number(body.monthlyRent),
      startDate: body.startDate,
      endDate: body.endDate,
    };

    const lease = leaseService.create(payload);
    res.status(201).json({ lease });
  } catch (err) {
    console.error("[POST /api/leases] error", err);
    res.status(500).json({ error: "Failed to process lease" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    if (!(await enforceLeaseCapability(req, res))) return;
    const payload = req.body as UpdateLeasePayload;
    const lease = leaseService.update(req.params.id, payload);
    if (!lease) {
      return res.status(404).json({ error: "Lease not found" });
    }
    return res.json({ lease });
  } catch (err) {
    console.error("[PUT /api/leases/:id] error", err);
    return res.status(500).json({ error: "Failed to process lease" });
  }
});

router.post("/:id/end", async (req: Request, res: Response) => {
  try {
    if (!(await enforceLeaseCapability(req, res))) return;
    const endDate: string = req.body?.endDate || new Date().toISOString();
    const lease = leaseService.endLease(req.params.id, endDate);
    if (!lease) {
      return res.status(404).json({ error: "Lease not found" });
    }
    return res.json({ lease });
  } catch (err) {
    console.error("[POST /api/leases/:id/end] error", err);
    return res.status(500).json({ error: "Failed to process lease" });
  }
});

router.get("/:leaseId/ledger", async (req: any, res: Response) => {
  try {
    const landlordId = req.user?.landlordId || req.user?.id;
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const leaseId = String(req.params?.leaseId || "").trim();
    if (!leaseId) return res.status(400).json({ ok: false, error: "leaseId is required" });

    const leaseCheck = await getLeaseForLandlord(leaseId, landlordId);
    if (!leaseCheck.ok) return res.status(leaseCheck.status).json({ ok: false, error: leaseCheck.error });

    const from = toIsoDate(req.query?.from) || null;
    const to = toIsoDate(req.query?.to) || null;
    const entries = await loadLedgerEntries(leaseId, landlordId, from, to);

    let runningBalanceCents = 0;
    const monthlyTotals: Record<string, { chargesCents: number; paymentsCents: number; netCents: number }> = {};
    const rows = entries.map((entry: any) => {
      const signedAmountCents =
        entry.entryType === "payment" ? -Math.abs(Number(entry.amountCents || 0)) : Math.abs(Number(entry.amountCents || 0));
      runningBalanceCents += signedAmountCents;
      const monthKey = String(entry.effectiveDate || "").slice(0, 7);
      if (monthKey) {
        monthlyTotals[monthKey] ||= { chargesCents: 0, paymentsCents: 0, netCents: 0 };
        if (entry.entryType === "payment") {
          monthlyTotals[monthKey].paymentsCents += Math.abs(Number(entry.amountCents || 0));
        } else {
          monthlyTotals[monthKey].chargesCents += Math.abs(Number(entry.amountCents || 0));
        }
        monthlyTotals[monthKey].netCents =
          monthlyTotals[monthKey].chargesCents - monthlyTotals[monthKey].paymentsCents;
      }
      return {
        ...entry,
        signedAmountCents,
        balanceCents: runningBalanceCents,
      };
    });

    return res.json({
      ok: true,
      leaseId,
      entries: rows,
      totals: {
        chargesCents: rows
          .filter((row) => row.entryType === "charge")
          .reduce((sum, row) => sum + Math.abs(Number(row.amountCents || 0)), 0),
        paymentsCents: rows
          .filter((row) => row.entryType === "payment")
          .reduce((sum, row) => sum + Math.abs(Number(row.amountCents || 0)), 0),
        balanceCents: runningBalanceCents,
      },
      monthlyTotals,
    });
  } catch (err) {
    console.error("[GET /api/leases/:leaseId/ledger] error", err);
    return res.status(500).json({ ok: false, error: "Failed to load lease ledger" });
  }
});

router.post("/:leaseId/ledger/charge", async (req: any, res: Response) => {
  try {
    const landlordId = req.user?.landlordId || req.user?.id;
    const createdBy = req.user?.id || req.user?.email || landlordId;
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const leaseId = String(req.params?.leaseId || "").trim();
    if (!leaseId) return res.status(400).json({ ok: false, error: "leaseId is required" });
    const leaseCheck = await getLeaseForLandlord(leaseId, landlordId);
    if (!leaseCheck.ok) return res.status(leaseCheck.status).json({ ok: false, error: leaseCheck.error });

    const amountCents = cents(req.body?.amountCents);
    const effectiveDate = toIsoDate(req.body?.date || req.body?.effectiveDate);
    const category = String(req.body?.type || req.body?.category || "").trim().toLowerCase();
    if (!amountCents) return res.status(400).json({ ok: false, error: "amountCents must be a positive integer" });
    if (!effectiveDate) return res.status(400).json({ ok: false, error: "date is required" });
    if (!CHARGE_CATEGORIES.has(category)) {
      return res.status(400).json({ ok: false, error: "type must be rent|fee|adjustment" });
    }

    const lease = leaseCheck.lease as any;
    const now = Date.now();
    const entryRef = db.collection(LEDGER_COLLECTION).doc();
    const entry = {
      id: entryRef.id,
      landlordId,
      propertyId: String(req.body?.propertyId || lease?.propertyId || "").trim() || null,
      unitId:
        String(req.body?.unitId || lease?.unitId || lease?.unitNumber || "").trim() || null,
      leaseId,
      entryType: "charge" as LedgerEntryType,
      category,
      amountCents,
      effectiveDate,
      notes: req.body?.notes ? String(req.body.notes).trim().slice(0, 5000) : null,
      createdAt: now,
      createdBy,
    };
    await entryRef.set(entry, { merge: false });
    return res.status(201).json({ ok: true, entry });
  } catch (err) {
    console.error("[POST /api/leases/:leaseId/ledger/charge] error", err);
    return res.status(500).json({ ok: false, error: "Failed to add ledger charge" });
  }
});

router.post("/:leaseId/ledger/payment", async (req: any, res: Response) => {
  try {
    const landlordId = req.user?.landlordId || req.user?.id;
    const createdBy = req.user?.id || req.user?.email || landlordId;
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const leaseId = String(req.params?.leaseId || "").trim();
    if (!leaseId) return res.status(400).json({ ok: false, error: "leaseId is required" });
    const leaseCheck = await getLeaseForLandlord(leaseId, landlordId);
    if (!leaseCheck.ok) return res.status(leaseCheck.status).json({ ok: false, error: leaseCheck.error });

    const amountCents = cents(req.body?.amountCents);
    const effectiveDate = toIsoDate(req.body?.date || req.body?.effectiveDate);
    const method = String(req.body?.method || "").trim().toLowerCase();
    if (!amountCents) return res.status(400).json({ ok: false, error: "amountCents must be a positive integer" });
    if (!effectiveDate) return res.status(400).json({ ok: false, error: "date is required" });
    if (!PAYMENT_METHODS.has(method)) {
      return res.status(400).json({ ok: false, error: "method must be cash|etransfer|cheque|bank|card|other" });
    }

    const lease = leaseCheck.lease as any;
    const now = Date.now();
    const entryRef = db.collection(LEDGER_COLLECTION).doc();
    const entry = {
      id: entryRef.id,
      landlordId,
      propertyId: String(req.body?.propertyId || lease?.propertyId || "").trim() || null,
      unitId:
        String(req.body?.unitId || lease?.unitId || lease?.unitNumber || "").trim() || null,
      leaseId,
      entryType: "payment" as LedgerEntryType,
      category: "payment",
      amountCents,
      effectiveDate,
      method,
      reference: req.body?.reference ? String(req.body.reference).trim().slice(0, 120) : null,
      notes: req.body?.notes ? String(req.body.notes).trim().slice(0, 5000) : null,
      createdAt: now,
      createdBy,
    };
    await entryRef.set(entry, { merge: false });
    return res.status(201).json({ ok: true, entry });
  } catch (err) {
    console.error("[POST /api/leases/:leaseId/ledger/payment] error", err);
    return res.status(500).json({ ok: false, error: "Failed to record payment" });
  }
});

router.get("/:leaseId/ledger/export.csv", async (req: any, res: Response) => {
  try {
    const landlordId = req.user?.landlordId || req.user?.id;
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const leaseId = String(req.params?.leaseId || "").trim();
    if (!leaseId) return res.status(400).json({ ok: false, error: "leaseId is required" });
    const leaseCheck = await getLeaseForLandlord(leaseId, landlordId);
    if (!leaseCheck.ok) return res.status(leaseCheck.status).json({ ok: false, error: leaseCheck.error });

    const from = toIsoDate(req.query?.from) || null;
    const to = toIsoDate(req.query?.to) || null;
    const entries = await loadLedgerEntries(leaseId, landlordId, from, to);
    let runningBalance = 0;
    const header = [
      "date",
      "entryType",
      "category",
      "amountCents",
      "signedAmountCents",
      "balanceCents",
      "method",
      "reference",
      "notes",
      "propertyId",
      "unitId",
      "createdAt",
    ];
    const rows = entries.map((entry: any) => {
      const signed = entry.entryType === "payment" ? -Math.abs(Number(entry.amountCents || 0)) : Math.abs(Number(entry.amountCents || 0));
      runningBalance += signed;
      return [
        entry.effectiveDate,
        entry.entryType,
        entry.category,
        entry.amountCents,
        signed,
        runningBalance,
        entry.method || "",
        entry.reference || "",
        entry.notes || "",
        entry.propertyId || "",
        entry.unitId || "",
        entry.createdAt || "",
      ]
        .map(escapeCsvCell)
        .join(",");
    });
    const csv = [header.join(","), ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=\"lease-ledger-${leaseId}.csv\"`
    );
    return res.status(200).send(csv);
  } catch (err) {
    console.error("[GET /api/leases/:leaseId/ledger/export.csv] error", err);
    return res.status(500).json({ ok: false, error: "Failed to export lease ledger" });
  }
});

export default router;