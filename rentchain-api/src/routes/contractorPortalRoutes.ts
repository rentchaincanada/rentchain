import { Router } from "express";
import { requireContractor } from "../middleware/requireContractor";
import {
  createContractorPortalMessage,
  getContractorPortalProfile,
  getContractorPortalWorkOrder,
  listContractorPortalMessages,
  listContractorPortalWorkOrders,
  updateContractorPortalProfile,
  updateContractorPortalWorkOrderStatus,
} from "../services/contractorPortalService";

const router = Router();

function asString(value: unknown, max = 1000): string {
  return String(value || "").trim().slice(0, max);
}

function isAdmin(req: any) {
  return asString(req.user?.actorRole || req.user?.role, 40).toLowerCase() === "admin";
}

function contractorIdFromUser(req: any) {
  return asString(req.user?.contractorId || req.user?.id, 160);
}

function ensureSelf(req: any, res: any): string | null {
  const requested = asString(req.params?.contractorId, 160);
  const current = contractorIdFromUser(req);
  if (!requested || !current) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return null;
  }
  if (!isAdmin(req) && requested !== current) {
    res.status(403).json({ ok: false, error: "forbidden" });
    return null;
  }
  return requested;
}

router.get("/contractors/:contractorId/work-orders", requireContractor, async (req: any, res) => {
  try {
    const contractorId = ensureSelf(req, res);
    if (!contractorId) return;
    const items = await listContractorPortalWorkOrders(contractorId, asString(req.query?.status, 80));
    return res.json({ ok: true, items, data: items });
  } catch {
    return res.status(500).json({ ok: false, error: "contractor_work_orders_failed" });
  }
});

router.get("/contractors/:contractorId/work-orders/:workOrderId", requireContractor, async (req: any, res) => {
  try {
    const contractorId = ensureSelf(req, res);
    if (!contractorId) return;
    const item = await getContractorPortalWorkOrder(contractorId, asString(req.params?.workOrderId, 160));
    if (!item) return res.status(404).json({ ok: false, error: "work_order_not_found" });
    return res.json({ ok: true, item, data: item });
  } catch {
    return res.status(500).json({ ok: false, error: "contractor_work_order_failed" });
  }
});

router.patch("/contractors/:contractorId/work-orders/:workOrderId/status", requireContractor, async (req: any, res) => {
  try {
    const contractorId = ensureSelf(req, res);
    if (!contractorId) return;
    const result = await updateContractorPortalWorkOrderStatus({
      contractorId,
      actorId: asString(req.user?.id, 160) || contractorId,
      workOrderId: asString(req.params?.workOrderId, 160),
      status: asString(req.body?.status, 80),
      message: asString(req.body?.message || req.body?.note, 1000),
    });
    if (!result.ok && result.code === "not_found") return res.status(404).json({ ok: false, error: "work_order_not_found" });
    if (!result.ok && result.code === "invalid_transition") {
      return res.status(400).json({ ok: false, error: "invalid_status_transition" });
    }
    if (!result.ok) return res.status(400).json({ ok: false, error: "invalid_status" });
    return res.json({ ok: true, item: result.item, data: result.item });
  } catch {
    return res.status(500).json({ ok: false, error: "contractor_status_update_failed" });
  }
});

router.get("/contractors/:contractorId/messages", requireContractor, async (req: any, res) => {
  try {
    const contractorId = ensureSelf(req, res);
    if (!contractorId) return;
    const items = await listContractorPortalMessages(contractorId, asString(req.query?.workOrderId, 160));
    return res.json({ ok: true, items, data: items });
  } catch {
    return res.status(500).json({ ok: false, error: "contractor_messages_failed" });
  }
});

router.post("/contractors/:contractorId/messages", requireContractor, async (req: any, res) => {
  try {
    const contractorId = ensureSelf(req, res);
    if (!contractorId) return;
    const result = await createContractorPortalMessage({
      contractorId,
      actorId: asString(req.user?.id, 160) || contractorId,
      workOrderId: asString(req.body?.workOrderId, 160),
      landlordId: asString(req.body?.landlordId, 160),
      text: asString(req.body?.text, 2000),
    });
    if (!result.ok && result.code === "not_found") return res.status(404).json({ ok: false, error: "work_order_not_found" });
    if (!result.ok && result.code === "forbidden") return res.status(403).json({ ok: false, error: "forbidden" });
    if (!result.ok) return res.status(400).json({ ok: false, error: "invalid_message" });
    return res.status(201).json({ ok: true, message: result.message });
  } catch {
    return res.status(500).json({ ok: false, error: "contractor_message_create_failed" });
  }
});

router.get("/contractors/:contractorId/profile", requireContractor, async (req: any, res) => {
  try {
    const contractorId = ensureSelf(req, res);
    if (!contractorId) return;
    const profile = await getContractorPortalProfile(contractorId);
    return res.json({ ok: true, profile });
  } catch {
    return res.status(500).json({ ok: false, error: "contractor_profile_failed" });
  }
});

router.patch("/contractors/:contractorId/profile", requireContractor, async (req: any, res) => {
  try {
    const contractorId = ensureSelf(req, res);
    if (!contractorId) return;
    const profile = await updateContractorPortalProfile(contractorId, req.body || {});
    return res.json({ ok: true, profile });
  } catch {
    return res.status(500).json({ ok: false, error: "contractor_profile_update_failed" });
  }
});

export default router;
