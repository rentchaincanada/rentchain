import { createHash } from "node:crypto";
import type { EmailMessage, EmailSendResult } from "./emailService";

export const PREVIEW_QA_FAKE_EMAIL_PROVIDER = "preview_qa_fake";
export const PREVIEW_QA_FAKE_FAILURE_DESTINATION = "notice-fail@qa.invalid";

function recipient(message: EmailMessage): string {
  if (Array.isArray(message.to)) {
    if (message.to.length !== 1) throw new Error("preview_qa_fake_requires_one_recipient");
    return String(message.to[0] || "").trim().toLowerCase();
  }
  return String(message.to || "").trim().toLowerCase();
}

export async function sendViaPreviewQaFake(message: EmailMessage): Promise<EmailSendResult> {
  const to = recipient(message);
  if (!to.endsWith(".invalid")) throw new Error("preview_qa_fake_invalid_destination");
  if (message.cc || message.bcc) throw new Error("preview_qa_fake_private_delivery_required");
  if (!String(message.subject || "").trim()) throw new Error("preview_qa_fake_subject_required");
  if (!String(message.text || message.html || "").trim()) throw new Error("preview_qa_fake_body_required");
  if (to === PREVIEW_QA_FAKE_FAILURE_DESTINATION) throw new Error("preview_qa_fake_provider_rejected");

  const deliveryId = String(message.metadata?.deliveryId || "").trim();
  if (!deliveryId) throw new Error("preview_qa_fake_delivery_id_required");
  const providerMessageId = `fake_${createHash("sha256").update(`${deliveryId}:${to}`).digest("hex")}`;
  return {
    provider: "preview_qa_fake",
    providerMessageId,
    providerResponseId: providerMessageId,
  };
}
