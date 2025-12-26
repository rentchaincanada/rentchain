import { Router } from "express";
import admin from "firebase-admin";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { getUsage } from "../services/billingUsage";
import { db } from "../config/firebase";

const router = Router();

const STARTER_PRICING = {
  baseMonthlyCents: 0,
  perUnitCents: 0,
  perScreeningCents: 1995,
};

function billingPreviewEnabled() {
  return String(process.env.BILLING_PREVIEW_ENABLED || "false").toLowerCase() === "true";
}

router.use(requireAuth, requireRole(["landlord", "admin"]));

router.post("/billing/invoices/draft", async (req: any, res) => {
  if (!billingPreviewEnabled()) return res.status(403).json({ ok: false, error: "Billing preview disabled" });
  const landlordId = String(req.body?.landlordId || "").trim();
  const period = String(req.body?.period || "").trim();
  if (!landlordId || !period) return res.status(400).json({ ok: false, error: "landlordId and period required" });

  const usage = await getUsage(landlordId, period);
  const items = [
    {
      key: "screening",
      label: "Screenings",
      qty: usage?.screeningsCount || 0,
      unitPriceCents: STARTER_PRICING.perScreeningCents,
    },
    {
      key: "units",
      label: "Units",
      qty: usage?.unitsCount || 0,
      unitPriceCents: STARTER_PRICING.perUnitCents,
    },
  ];

  const subtotal = items.reduce((sum, i) => sum + i.qty * i.unitPriceCents, 0);
  const invoice = {
    landlordId,
    period,
    status: "draft",
    lineItems: items.map((i) => ({ ...i, amountCents: i.qty * i.unitPriceCents })),
    subtotalCents: subtotal,
    taxCents: 0,
    totalCents: subtotal,
    notes: "Preview — no charges during Micro-Live",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const ref = await db.collection("billing_invoices").add(invoice);
  await ref.set({ invoiceId: ref.id }, { merge: true });

  return res.json({ ok: true, invoiceId: ref.id });
});

router.get("/billing/invoices/:invoiceId", async (req, res) => {
  const invoiceId = String(req.params.invoiceId || "").trim();
  if (!invoiceId) return res.status(400).json({ ok: false, error: "invoiceId required" });
  const snap = await db.collection("billing_invoices").doc(invoiceId).get();
  if (!snap.exists) return res.status(404).json({ ok: false, error: "Not found" });
  return res.json({ ok: true, invoice: snap.data() });
});

export default router;
