import { apiFetch } from "./apiFetch";

export type LedgerAttachmentPayload = {
  tenantId: string;
  url: string;
  title?: string | null;
  fileName?: string | null;
  purpose?: string | null;
  purposeLabel?: string | null;
};

export async function postLedgerAttachment(ledgerItemId: string, payload: LedgerAttachmentPayload) {
  if (!ledgerItemId) throw new Error("ledgerItemId required");
  return apiFetch(`/ledger/${encodeURIComponent(ledgerItemId)}/attachments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
