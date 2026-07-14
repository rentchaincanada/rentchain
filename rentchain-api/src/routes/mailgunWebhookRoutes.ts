import type { Request, Response } from "express";
import {
  handleMailgunRenewalCommunicationWebhook,
} from "../services/renewalNoticeCommunicationDeliveryWebhookService";

function replayWindowSeconds(): number | undefined {
  const raw = String(process.env.MAILGUN_WEBHOOK_REPLAY_WINDOW_SECONDS || "").trim();
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export async function mailgunEventsWebhookHandler(req: Request, res: Response) {
  const result = await handleMailgunRenewalCommunicationWebhook({
    body: req.body,
    signingKey: process.env.MAILGUN_WEBHOOK_SIGNING_KEY || "",
    replayWindowSeconds: replayWindowSeconds(),
  });
  if (!result.ok) {
    return res.status(result.statusCode).json({ ok: false, error: result.error });
  }
  res.setHeader("x-rentchain-mailgun-webhook", "events-v1");
  return res.status(result.statusCode).json({
    ok: true,
    duplicate: result.duplicate || undefined,
    matched: result.matched || false,
    updated: result.updated || false,
    ignoredReason: result.ignoredReason || undefined,
    communicationId: result.communicationId || undefined,
    deliveryStatus: result.deliveryStatus || undefined,
    receiptId: result.receiptId,
  });
}
