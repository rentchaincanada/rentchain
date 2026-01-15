import React from "react";
import type { LedgerEventStored } from "@/api/ledgerApi";
import { IntegrityBadge } from "./IntegrityBadge";
import { AttachDocumentLinkModal } from "./AttachDocumentLinkModal";
import { useToast } from "../ui/ToastProvider";

type Props = {
  items: LedgerEventStored[];
  compact?: boolean;
};

function formatTs(ts: number) {
  if (!ts) return "Unknown";
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toISOString();
  }
}

function payloadPreview(ev: LedgerEventStored): string {
  const p: any = ev.payload ?? {};
  if (typeof p.amountCents === "number") {
    const amt = (p.amountCents / 100).toLocaleString("en-CA", {
      style: "currency",
      currency: "CAD",
    });
    const period = p.period ? ` (${p.period})` : "";
    return `${amt}${period}`;
  }
  if (p.title) return String(p.title);
  try {
    const s = JSON.stringify(p);
    return s.length > 120 ? `${s.slice(0, 120)}…` : s;
  } catch {
    return String(p);
  }
}

export function LedgerTimeline({ items, compact }: Props) {
  if (!items || items.length === 0) {
    return <div style={{ color: "#6b7280", fontSize: 14 }}>No ledger events yet.</div>;
  }

  const { showToast } = useToast();
  const [attachFor, setAttachFor] = React.useState<LedgerEventStored | null>(null);

  const sorted = [...items].sort((a, b) => (Number(b?.ts || 0) as any) - (Number(a?.ts || 0) as any));
  const toRender = compact ? sorted.slice(0, 6) : sorted;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {toRender.map((ev) => {
        const [open, setOpen] = React.useState(false);
        const preview = payloadPreview(ev);
        const status = ev.integrity?.status ?? "unverified";
        return (
          <div
            key={ev.id}
            style={{
              border: "1px solid rgba(148,163,184,0.35)",
              borderRadius: 10,
              padding: 12,
              background: "rgba(255,255,255,0.8)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{ev.type || "Event"}</div>
                <div style={{ color: "#6b7280", fontSize: 12 }}>{formatTs(ev.ts)}</div>
                <div style={{ color: "#111827", fontSize: 13 }}>{preview}</div>
              </div>
              <IntegrityBadge status={status as any} />
            </div>

            <div style={{ marginTop: 8, display: "flex", gap: 12, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setOpen(!open)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#2563eb",
                  cursor: "pointer",
                  fontSize: 12,
                  padding: 0,
                }}
              >
                {open ? "Hide details" : "Show details"}
              </button>
              {ev.tenantId ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!ev.id || !ev.tenantId) {
                      showToast({ message: "Missing tenant or event id", variant: "error" });
                      return;
                    }
                    setAttachFor(ev);
                  }}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#2563eb",
                    cursor: "pointer",
                    fontSize: 12,
                    padding: 0,
                  }}
                >
                  Attach document
                </button>
              ) : null}
            </div>

            {open ? (
              <div
                style={{
                  marginTop: 8,
                  padding: 10,
                  background: "rgba(148,163,184,0.08)",
                  borderRadius: 8,
                  fontFamily: "monospace",
                  fontSize: 12,
                  color: "#0f172a",
                }}
              >
                <div>seq: {ev.seq}</div>
                {ev.tenantId ? <div>tenantId: {ev.tenantId}</div> : null}
                {ev.propertyId ? <div>propertyId: {ev.propertyId}</div> : null}
                <div>hash: {ev.hash}</div>
                <div>prevHash: {ev.prevHash ?? "null"}</div>
                <div>payloadHash: {ev.payloadHash}</div>
              </div>
            ) : null}
          </div>
        );
      })}

      {attachFor ? (
        <AttachDocumentLinkModal
          open={!!attachFor}
          onClose={() => setAttachFor(null)}
          tenantId={attachFor.tenantId || ""}
          ledgerItemId={attachFor.id}
          defaultTitle={(attachFor.payload as any)?.title || attachFor.type}
          defaultPurpose={(attachFor.payload as any)?.purpose || undefined}
          defaultPurposeLabel={(attachFor.payload as any)?.purposeLabel || (attachFor.payload as any)?.period || undefined}
        />
      ) : null}
    </div>
  );
}
