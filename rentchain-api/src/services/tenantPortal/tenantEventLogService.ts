import { db, FieldValue } from "../../config/firebase";

export type TenantEventStatus = "recorded" | "pending" | "failed";

export type TenantEventLogInput = {
  eventType: string;
  entityType: string;
  entityId: string;
  createdBy: string;
  status?: TenantEventStatus;
  context?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
  payloadRef?: string | null;
};

function compactObject(value: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) continue;
    out[key] = entry;
  }
  return Object.keys(out).length ? out : null;
}

export async function recordTenantEvent(input: TenantEventLogInput): Promise<{ id: string }> {
  const ref = db.collection("event_log").doc();
  const payload = compactObject(input.payload);
  const context = compactObject(input.context);

  await ref.set({
    event_type: String(input.eventType || "").trim(),
    entity_type: String(input.entityType || "").trim(),
    entity_id: String(input.entityId || "").trim(),
    context,
    payload: payload && JSON.stringify(payload).length <= 1000 ? payload : null,
    payload_ref: input.payloadRef || null,
    created_at: FieldValue.serverTimestamp(),
    created_by: String(input.createdBy || "").trim(),
    status: input.status || "recorded",
  });

  return { id: ref.id };
}
