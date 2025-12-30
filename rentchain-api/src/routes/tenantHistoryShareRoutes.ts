import { Router } from "express";
import crypto from "crypto";
import { authenticateJwt } from "../middleware/authMiddleware";
import { db } from "../config/firebase";
import { listLedgerEventsV2 } from "../services/ledgerEventsFirestoreService";
import { computeTenantSignals } from "../services/tenantSignalsService";

const COLLECTION = "tenantHistoryShares";
const MAX_EVENTS = 200;

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function timingSafeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a, "hex");
  const bBuf = Buffer.from(b, "hex");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function buildShareUrl(shareId: string, token: string) {
  const base = (process.env.PUBLIC_APP_URL || "").replace(/\/$/, "");
  const path = `/api/public/tenant-history/${encodeURIComponent(shareId)}?token=${encodeURIComponent(token)}`;
  return base ? `${base}${path}` : path;
}

function buildSharePdfUrl(shareId: string, token: string) {
  const base = (process.env.PUBLIC_APP_URL || "").replace(/\/$/, "");
  const path = `/api/public/tenant-history/${encodeURIComponent(shareId)}.pdf?token=${encodeURIComponent(token)}`;
  return base ? `${base}${path}` : path;
}

let PDFDocument: any | null = null;
async function loadPDF() {
  if (PDFDocument) return PDFDocument;
  const mod: any = await import("pdfkit");
  PDFDocument = mod?.default ?? mod;
  return PDFDocument;
}

const protectedRouter = Router();
protectedRouter.use(authenticateJwt);

protectedRouter.post("/share", async (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const tenantId = String(req.body?.tenantId || "").trim();
  if (!tenantId) return res.status(400).json({ ok: false, error: "tenantId is required" });

  const daysRaw = Number(req.body?.expiresInDays ?? 7);
  const expiresInDays = Number.isFinite(daysRaw) ? Math.min(Math.max(daysRaw, 1), 30) : 7;
  const now = Date.now();
  const expiresAt = now + expiresInDays * 24 * 60 * 60 * 1000;

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256Hex(token);

  const ref = db.collection(COLLECTION).doc();
  await ref.set({
    id: ref.id,
    landlordId,
    tenantId,
    createdAt: now,
    expiresAt,
    tokenHash,
    revoked: false,
  });

  return res.json({
    ok: true,
    shareId: ref.id,
    url: buildShareUrl(ref.id, token),
    pdfUrl: buildSharePdfUrl(ref.id, token),
    expiresAt,
  });
});

protectedRouter.post("/share/:shareId/revoke", async (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const shareId = String(req.params?.shareId || "").trim();
  if (!shareId) return res.status(400).json({ ok: false, error: "shareId required" });

  const ref = db.collection(COLLECTION).doc(shareId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ ok: false, error: "Not found" });
  const data = snap.data() as any;
  if (data.landlordId !== landlordId) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }

  await ref.set({ revoked: true, revokedAt: Date.now() }, { merge: true });
  return res.json({ ok: true, shareId, revoked: true });
});

export const publicRouter = Router();

async function loadSharePayload(shareId: string, token: string) {
  const ref = db.collection(COLLECTION).doc(shareId);
  const snap = await ref.get();
  if (!snap.exists) return { status: 404 as const, error: "Not found" };
  const data = snap.data() as any;

  if (data.revoked) return { status: 403 as const, error: "Revoked" };
  if (typeof data.expiresAt === "number" && data.expiresAt < Date.now()) {
    return { status: 403 as const, error: "Expired" };
  }

  const storedHash = String(data.tokenHash || "");
  const incomingHash = sha256Hex(token);
  if (!storedHash || !timingSafeEqual(storedHash, incomingHash)) {
    return { status: 401 as const, error: "Unauthorized" };
  }

  const landlordId = data.landlordId;
  const tenantId = data.tenantId;

  const tenantSnap = await db.collection("tenants").doc(String(tenantId)).get();
  const tenantData = tenantSnap.exists ? tenantSnap.data() || {} : {};

  const ledgerResult = await listLedgerEventsV2({
    landlordId,
    tenantId,
    limit: MAX_EVENTS,
  });

  const events = (ledgerResult.items || []).map((ev: any) => ({
    id: ev.id,
    occurredAt: ev.occurredAt,
    createdAt: ev.createdAt,
    eventType: ev.eventType,
    title: ev.title,
    summary: ev.summary,
    amount: ev.amount,
    currency: ev.currency,
    propertyId: ev.propertyId,
    tenantId: ev.tenantId,
    leaseId: ev.leaseId,
    paymentId: ev.paymentId,
  }));

  const signals = computeTenantSignals(ledgerResult.items || [], tenantId, landlordId);

  return {
    status: 200 as const,
    data: {
      shareRef: ref,
      shareDoc: data,
      tenant: {
        id: tenantSnap.id || tenantId,
        fullName: tenantData?.fullName || null,
        email: tenantData?.email || null,
        phone: tenantData?.phone || null,
        status: tenantData?.status || null,
        propertyId: tenantData?.propertyId || null,
        unit: tenantData?.unit || null,
      },
      events,
      signals,
    },
  };
}

publicRouter.get("/tenant-history/:shareId", async (req, res) => {
  const shareId = String(req.params?.shareId || "").trim();
  const token = String(req.query?.token || "").trim();
  if (!shareId || !token) {
    return res.status(400).json({ ok: false, error: "Invalid token or shareId" });
  }

  const result = await loadSharePayload(shareId, token);
  if (result.status !== 200) {
    return res.status(result.status).json({ ok: false, error: result.error });
  }

  // best-effort last access update
  result.data.shareRef.set({ lastAccessedAt: Date.now() }, { merge: true }).catch(() => {});

  return res.json({
    ok: true,
    tenant: result.data.tenant,
    events: result.data.events,
    generatedAt: Date.now(),
    expiresAt: result.data.shareDoc.expiresAt || null,
    signals: result.data.signals,
  });
});

publicRouter.get("/tenant-history/:shareId.pdf", async (req, res) => {
  const shareId = String(req.params?.shareId || "").trim();
  const token = String(req.query?.token || "").trim();
  if (!shareId || !token) {
    return res.status(400).json({ ok: false, error: "Invalid token or shareId" });
  }

  const result = await loadSharePayload(shareId, token);
  if (result.status !== 200) {
    return res.status(result.status).json({ ok: false, error: result.error });
  }

  const { tenant, events, shareDoc } = result.data;
  let PDF: any;
  try {
    PDF = await loadPDF();
  } catch (err: any) {
    return res
      .status(501)
      .json({ ok: false, code: "PDFKIT_MISSING", error: "PDF generation unavailable" });
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename=\"tenant-history-${tenant.id || shareId}.pdf\"`
  );

  const doc = new PDF({ margin: 48, size: "LETTER" });
  doc.pipe(res);

  const title = "Tenant History Report";
  doc.fontSize(18).text("RentChain", { continued: false });
  doc.fontSize(14).text(title);
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor("#555");
  doc.text(`Generated: ${new Date().toISOString()}`);
  if (shareDoc?.expiresAt) {
    doc.text(`Expires: ${new Date(shareDoc.expiresAt).toISOString()}`);
  }
  doc.moveDown(1);
  doc.fillColor("#000");

  doc.fontSize(12).text("Tenant", { underline: true });
  doc.fontSize(10).moveDown(0.25);
  doc.text(`Name: ${tenant.fullName || "Unknown"}`);
  if (tenant.email) doc.text(`Email: ${tenant.email}`);
  if (tenant.phone) doc.text(`Phone: ${tenant.phone}`);
  if (tenant.status) doc.text(`Status: ${tenant.status}`);
  if (tenant.propertyId || tenant.unit) {
    doc.text(
      `Property/Unit: ${tenant.propertyId || "-"} ${tenant.unit ? `• Unit ${tenant.unit}` : ""}`
    );
  }
  doc.moveDown(1);

  if (result.data.signals) {
    const s = result.data.signals;
    doc.fontSize(12).fillColor("#000").text("Signals", { underline: true });
    doc.fontSize(10).moveDown(0.3);
    doc.text(`Risk Level: ${s.riskLevel}`);
    doc.text(
      `Late: ${s.latePaymentsCount} | NSF: ${s.nsfCount} | Missed: ${s.missedPaymentsCount} | Notices: ${s.evictionNoticeCount} | Positive: ${s.positiveNotesCount}`
    );
    doc.moveDown(1);
  }

  doc.fontSize(12).text("Timeline", { underline: true });
  doc.moveDown(0.3);

  const lineHeight = 0.2;
  events
    .sort((a: any, b: any) => (a.occurredAt > b.occurredAt ? -1 : 1))
    .forEach((ev: any) => {
      if (doc.y > doc.page.height - 100) {
        doc.addPage();
      }
      doc.fontSize(10).fillColor("#111");
      const dateStr = ev.occurredAt ? new Date(ev.occurredAt).toISOString().slice(0, 10) : "-";
      doc.text(`${dateStr}  •  ${ev.eventType}`, { continued: false });
      doc.fontSize(11).text(ev.title || "(no title)");
      if (ev.summary) {
        doc.fontSize(10).fillColor("#444").text(ev.summary);
      }
      if (typeof ev.amount === "number") {
        doc.fontSize(10).fillColor("#111").text(`Amount: ${ev.currency || "CAD"} ${ev.amount}`);
      }
      doc.moveDown(lineHeight);
    });

  doc.moveDown(1);
  doc.fontSize(9).fillColor("#555").text("Share link expires on above date.");
  doc.end();
});

export default protectedRouter;
