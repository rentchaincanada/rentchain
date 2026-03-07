import { Router } from "express";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

const EXPENSE_CATEGORIES = [
  "Repairs",
  "Maintenance",
  "Utilities",
  "Cleaning",
  "Supplies",
  "Landscaping",
  "Insurance",
  "Taxes",
  "Administration",
  "Other",
] as const;
const EXPENSE_STATUSES = ["recorded", "reimbursable", "paid"] as const;
const EXPENSE_SOURCES = ["manual", "work_order", "imported"] as const;

type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];
type ExpenseSource = (typeof EXPENSE_SOURCES)[number];

function nowMs() {
  return Date.now();
}

function normalizeRole(req: any): "admin" | "landlord" | "other" {
  const role = String(req.user?.actorRole || req.user?.role || "")
    .trim()
    .toLowerCase();
  if (role === "admin") return "admin";
  if (role === "landlord") return "landlord";
  return "other";
}

function landlordIdFromReq(req: any): string {
  return String(req.user?.landlordId || req.user?.id || "").trim();
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseDateInputToMs(value: unknown): number | null {
  if (value == null) return null;
  const direct = parseNumber(value);
  if (direct != null) return Math.round(direct);

  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsed = Date.parse(`${raw}T00:00:00.000Z`);
    if (Number.isFinite(parsed)) return Math.round(parsed);
  }

  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return Math.round(parsed);
  return null;
}

function normalizeCategory(raw: unknown): string {
  const target = String(raw || "").trim().toLowerCase();
  const match = EXPENSE_CATEGORIES.find((cat) => cat.toLowerCase() === target);
  return match || "";
}

function normalizeStatus(raw: unknown, fallback: ExpenseStatus = "recorded"): ExpenseStatus {
  const target = String(raw || "")
    .trim()
    .toLowerCase();
  if (target === "reimbursable") return "reimbursable";
  if (target === "paid") return "paid";
  return fallback;
}

function normalizeSource(raw: unknown, fallback: ExpenseSource = "manual"): ExpenseSource {
  const target = String(raw || "")
    .trim()
    .toLowerCase();
  if (target === "work_order") return "work_order";
  if (target === "imported") return "imported";
  return fallback;
}

async function getPropertyForWrite(req: any, propertyId: string) {
  const propertyRef = db.collection("properties").doc(propertyId);
  const propertySnap = await propertyRef.get();
  if (!propertySnap.exists) return { ok: false as const, code: "PROPERTY_NOT_FOUND" as const };

  const property = propertySnap.data() as any;
  const propertyLandlordId = String(property?.landlordId || property?.ownerId || property?.owner || "").trim();
  if (!propertyLandlordId) return { ok: false as const, code: "PROPERTY_OWNER_MISSING" as const };

  const role = normalizeRole(req);
  if (role !== "admin" && propertyLandlordId !== landlordIdFromReq(req)) {
    return { ok: false as const, code: "FORBIDDEN" as const };
  }
  return { ok: true as const, propertyLandlordId, property };
}

async function validateUnitForExpense(req: any, opts: { unitId: string; propertyId: string }) {
  const unitRef = db.collection("units").doc(opts.unitId);
  const unitSnap = await unitRef.get();
  if (!unitSnap.exists) return { ok: false as const, code: "UNIT_NOT_FOUND" as const };

  const unit = unitSnap.data() as any;
  const unitPropertyId = String(unit?.propertyId || "").trim();
  if (!unitPropertyId || unitPropertyId !== opts.propertyId) {
    return { ok: false as const, code: "UNIT_PROPERTY_MISMATCH" as const };
  }

  const role = normalizeRole(req);
  if (role !== "admin") {
    const landlordId = landlordIdFromReq(req);
    const unitLandlordId = String(unit?.landlordId || "").trim();
    if (unitLandlordId && unitLandlordId !== landlordId) {
      return { ok: false as const, code: "FORBIDDEN" as const };
    }
  }

  return { ok: true as const };
}

router.post("/expenses", requireAuth, async (req: any, res) => {
  try {
    const role = normalizeRole(req);
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const propertyId = String(req.body?.propertyId || "").trim();
    const unitId = String(req.body?.unitId || "").trim() || null;
    const category = normalizeCategory(req.body?.category);
    const vendorName = String(req.body?.vendorName || req.body?.vendor || "")
      .trim()
      .slice(0, 180);
    const notes = String(req.body?.notes || "")
      .trim()
      .slice(0, 5000);
    const amountCentsRaw = parseNumber(req.body?.amountCents);
    const incurredAtMs = parseDateInputToMs(req.body?.incurredAtMs);

    if (!propertyId) return res.status(400).json({ ok: false, error: "PROPERTY_REQUIRED" });
    if (!category) return res.status(400).json({ ok: false, error: "CATEGORY_REQUIRED" });
    if (!incurredAtMs) return res.status(400).json({ ok: false, error: "INCURRED_AT_REQUIRED" });
    if (amountCentsRaw == null || amountCentsRaw <= 0) {
      return res.status(400).json({ ok: false, error: "AMOUNT_INVALID" });
    }

    const propertyCheck = await getPropertyForWrite(req, propertyId);
    if (!propertyCheck.ok) {
      if (propertyCheck.code === "PROPERTY_NOT_FOUND") {
        return res.status(404).json({ ok: false, error: "PROPERTY_NOT_FOUND" });
      }
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    if (unitId) {
      const unitCheck = await validateUnitForExpense(req, { unitId, propertyId });
      if (!unitCheck.ok) {
        if (unitCheck.code === "UNIT_NOT_FOUND") {
          return res.status(404).json({ ok: false, error: "UNIT_NOT_FOUND" });
        }
        if (unitCheck.code === "UNIT_PROPERTY_MISMATCH") {
          return res.status(400).json({ ok: false, error: "UNIT_PROPERTY_MISMATCH" });
        }
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }
    }

    const createdAtMs = nowMs();
    const payload = {
      landlordId: propertyCheck.propertyLandlordId,
      propertyId,
      unitId,
      category,
      vendorName: vendorName || "",
      amountCents: Math.round(amountCentsRaw),
      incurredAtMs,
      notes: notes || "",
      status: normalizeStatus(req.body?.status, "recorded"),
      source: normalizeSource(req.body?.source, "manual"),
      linkedWorkOrderId: String(req.body?.linkedWorkOrderId || "").trim() || null,
      receiptFileUrl: String(req.body?.receiptFileUrl || "").trim() || null,
      createdAtMs,
      updatedAtMs: createdAtMs,
    };

    const ref = await db.collection("expenses").add(payload);
    return res.json({ ok: true, item: { id: ref.id, ...payload } });
  } catch (err: any) {
    console.error("[expenses] create failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "EXPENSE_CREATE_FAILED" });
  }
});

router.get("/expenses", requireAuth, async (req: any, res) => {
  try {
    const role = normalizeRole(req);
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const landlordScope = role === "admin" ? String(req.query?.landlordId || "").trim() : landlordIdFromReq(req);
    if (role !== "admin" && !landlordScope) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const propertyId = String(req.query?.propertyId || "").trim() || null;
    const unitId = String(req.query?.unitId || "").trim() || null;
    const category = normalizeCategory(req.query?.category);
    const dateFrom = parseDateInputToMs(req.query?.dateFrom);
    const dateTo = parseDateInputToMs(req.query?.dateTo);
    const limitRaw = parseNumber(req.query?.limit);
    const limit = Math.min(500, Math.max(1, Math.round(limitRaw || 200)));

    let query = db.collection("expenses") as FirebaseFirestore.Query;
    if (landlordScope) {
      query = query.where("landlordId", "==", landlordScope);
    }

    const snap = await query.limit(limit).get();
    let items = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));

    if (propertyId) items = items.filter((row) => String((row as any).propertyId || "") === propertyId);
    if (unitId) items = items.filter((row) => String((row as any).unitId || "") === unitId);
    if (category) {
      items = items.filter((row) => normalizeCategory((row as any).category) === category);
    }
    if (dateFrom != null) items = items.filter((row) => Number((row as any).incurredAtMs || 0) >= dateFrom);
    if (dateTo != null) items = items.filter((row) => Number((row as any).incurredAtMs || 0) <= dateTo);

    items.sort((a: any, b: any) => Number(b.incurredAtMs || 0) - Number(a.incurredAtMs || 0));
    return res.json({ ok: true, items });
  } catch (err: any) {
    console.error("[expenses] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "EXPENSE_LIST_FAILED" });
  }
});

router.patch("/expenses/:expenseId", requireAuth, async (req: any, res) => {
  try {
    const role = normalizeRole(req);
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const expenseId = String(req.params?.expenseId || "").trim();
    if (!expenseId) return res.status(400).json({ ok: false, error: "MISSING_EXPENSE_ID" });

    const ref = db.collection("expenses").doc(expenseId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "EXPENSE_NOT_FOUND" });

    const current = snap.data() as any;
    const currentLandlordId = String(current?.landlordId || "").trim();
    if (role !== "admin" && currentLandlordId !== landlordIdFromReq(req)) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const nextPropertyId = String(req.body?.propertyId || current?.propertyId || "").trim();
    if (!nextPropertyId) return res.status(400).json({ ok: false, error: "PROPERTY_REQUIRED" });
    const propertyCheck = await getPropertyForWrite(req, nextPropertyId);
    if (!propertyCheck.ok) {
      if (propertyCheck.code === "PROPERTY_NOT_FOUND") {
        return res.status(404).json({ ok: false, error: "PROPERTY_NOT_FOUND" });
      }
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const nextUnitId = Object.prototype.hasOwnProperty.call(req.body || {}, "unitId")
      ? String(req.body?.unitId || "").trim() || null
      : String(current?.unitId || "").trim() || null;
    if (nextUnitId) {
      const unitCheck = await validateUnitForExpense(req, { unitId: nextUnitId, propertyId: nextPropertyId });
      if (!unitCheck.ok) {
        if (unitCheck.code === "UNIT_NOT_FOUND") {
          return res.status(404).json({ ok: false, error: "UNIT_NOT_FOUND" });
        }
        if (unitCheck.code === "UNIT_PROPERTY_MISMATCH") {
          return res.status(400).json({ ok: false, error: "UNIT_PROPERTY_MISMATCH" });
        }
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }
    }

    const patch: any = {
      propertyId: nextPropertyId,
      unitId: nextUnitId,
      landlordId: propertyCheck.propertyLandlordId,
      updatedAtMs: nowMs(),
    };

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "category")) {
      const nextCategory = normalizeCategory(req.body?.category);
      if (!nextCategory) return res.status(400).json({ ok: false, error: "CATEGORY_REQUIRED" });
      patch.category = nextCategory;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "amountCents")) {
      const nextAmount = parseNumber(req.body?.amountCents);
      if (nextAmount == null || nextAmount <= 0) {
        return res.status(400).json({ ok: false, error: "AMOUNT_INVALID" });
      }
      patch.amountCents = Math.round(nextAmount);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "incurredAtMs")) {
      const nextIncurredAtMs = parseDateInputToMs(req.body?.incurredAtMs);
      if (!nextIncurredAtMs) return res.status(400).json({ ok: false, error: "INCURRED_AT_REQUIRED" });
      patch.incurredAtMs = nextIncurredAtMs;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "vendorName")) {
      patch.vendorName = String(req.body?.vendorName || "").trim().slice(0, 180);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "notes")) {
      patch.notes = String(req.body?.notes || "").trim().slice(0, 5000);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "status")) {
      patch.status = normalizeStatus(req.body?.status, normalizeStatus(current?.status, "recorded"));
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "source")) {
      patch.source = normalizeSource(req.body?.source, normalizeSource(current?.source, "manual"));
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "linkedWorkOrderId")) {
      patch.linkedWorkOrderId = String(req.body?.linkedWorkOrderId || "").trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "receiptFileUrl")) {
      patch.receiptFileUrl = String(req.body?.receiptFileUrl || "").trim() || null;
    }

    await ref.set(patch, { merge: true });
    const updatedSnap = await ref.get();
    return res.json({ ok: true, item: { id: updatedSnap.id, ...(updatedSnap.data() as any) } });
  } catch (err: any) {
    console.error("[expenses] update failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "EXPENSE_UPDATE_FAILED" });
  }
});

export default router;

