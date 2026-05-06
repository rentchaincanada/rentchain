import React from "react";
import { Link } from "react-router-dom";
import type { InstitutionalSharingRoom as SharingRoom } from "@/api/sharingRoomsApi";
import { Button, Card, Section } from "@/components/ui/Ui";

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusTone(status: string) {
  if (status === "blocked" || status === "revoked" || status === "expired") {
    return { color: "#991b1b", background: "#fee2e2", border: "#fecaca" };
  }
  if (status === "review_required" || status === "pending_review") {
    return { color: "#92400e", background: "#fef3c7", border: "#fde68a" };
  }
  if (status === "active" || status === "available") return { color: "#166534", background: "#dcfce7", border: "#bbf7d0" };
  return { color: "#475569", background: "#f8fafc", border: "#e2e8f0" };
}

function Badge({ children, status }: { children: React.ReactNode; status: string }) {
  const tone = statusTone(status);
  return (
    <span
      style={{
        border: `1px solid ${tone.border}`,
        borderRadius: 999,
        background: tone.background,
        color: tone.color,
        padding: "3px 9px",
        fontSize: 12,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function InstitutionalSharingRoom({
  room,
  onRevoke,
  revoking,
}: {
  room: SharingRoom;
  onRevoke?: (sharingRoomId: string) => void;
  revoking?: boolean;
}) {
  return (
    <Card style={{ borderRadius: 8, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>View sharing room</div>
          <h2 style={{ margin: "2px 0 0", fontSize: "1.1rem" }}>{label(room.roomType)}</h2>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge status={room.status}>{label(room.status)}</Badge>
          <Badge status={room.accessControls.status}>{label(room.accessControls.status)}</Badge>
        </div>
      </div>

      <div style={{ color: "#475569", lineHeight: 1.55 }}>
        Institutional sharing remains permissioned and review controlled. Sensitive data may be excluded or redacted. No public
        sharing or automated submission is enabled.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
        <Card style={{ borderRadius: 8, padding: 10 }}>
          <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>Institution</div>
          <strong>{label(room.accessControls.institutionType)}</strong>
        </Card>
        <Card style={{ borderRadius: 8, padding: 10 }}>
          <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>Access</div>
          <strong>{label(room.accessControls.accessType)}</strong>
        </Card>
        <Card style={{ borderRadius: 8, padding: 10 }}>
          <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>Expires</div>
          <strong>{room.expiresAt ? new Date(room.expiresAt).toLocaleDateString() : "Review required"}</strong>
        </Card>
        <Card style={{ borderRadius: 8, padding: 10 }}>
          <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>Download</div>
          <strong>{room.accessControls.downloadEnabled ? "Enabled" : "Disabled"}</strong>
        </Card>
      </div>

      <Section style={{ display: "grid", gap: 8, padding: 0, boxShadow: "none", border: 0 }}>
        <div style={{ fontWeight: 900 }}>Review access scope</div>
        {room.sharedScopes.map((scope) => (
          <div key={`${scope.scopeKey}:${scope.scopeId}`} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <strong>{scope.label}</strong>
              <Badge status={scope.status}>{label(scope.status)}</Badge>
            </div>
            <div style={{ color: "#64748b", fontSize: 13 }}>{label(scope.scopeKey)}</div>
            {scope.blockedReason ? <div style={{ color: "#991b1b", fontSize: 13 }}>{scope.blockedReason}</div> : null}
            {scope.destination ? (
              <Link to={scope.destination} style={{ color: "#2563eb", fontWeight: 800, fontSize: 13 }}>
                View evidence
              </Link>
            ) : null}
          </div>
        ))}
      </Section>

      <Section style={{ display: "grid", gap: 8, padding: 0, boxShadow: "none", border: 0 }}>
        <div style={{ fontWeight: 900 }}>Review redactions</div>
        {room.redactions.map((redaction) => (
          <div key={redaction.fieldCategory} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 10 }}>
            <strong>{label(redaction.fieldCategory)}</strong>
            <div style={{ color: "#64748b", fontSize: 13 }}>{label(redaction.state)}</div>
            <div style={{ color: "#475569", fontSize: 13 }}>{redaction.reason}</div>
          </div>
        ))}
      </Section>

      <Section style={{ display: "grid", gap: 8, padding: 0, boxShadow: "none", border: 0 }}>
        <div style={{ fontWeight: 900 }}>View audit lineage</div>
        {room.auditReferences.map((event) => (
          <div key={`${event.eventType}:${event.occurredAt}`} style={{ color: "#475569", fontSize: 13 }}>
            {label(event.eventType)}
          </div>
        ))}
      </Section>

      {onRevoke && room.accessControls.status !== "revoked" ? (
        <div>
          <Button type="button" onClick={() => onRevoke(room.sharingRoomId)} disabled={revoking}>
            Revoke access
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
