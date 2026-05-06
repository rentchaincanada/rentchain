import React from "react";
import {
  createSharingRoom,
  fetchSharingRooms,
  revokeSharingRoom,
  type InstitutionalSharingRoom as SharingRoom,
  type SharingInstitutionType,
  type SharingRoomType,
  type SharingScopeKind,
} from "@/api/sharingRoomsApi";
import { MacShell } from "@/components/layout/MacShell";
import { InstitutionalSharingRoom } from "@/components/sharingRooms/InstitutionalSharingRoom";
import { Button, Card, Section } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";

const roomTypes: SharingRoomType[] = [
  "lender_review",
  "insurer_review",
  "auditor_review",
  "regulator_review",
  "operational_partner_review",
];
const institutionTypes: SharingInstitutionType[] = ["lender", "insurer", "auditor", "regulator", "partner"];
const scopeKinds: SharingScopeKind[] = [
  "evidence_pack",
  "institution_export",
  "review_timeline",
  "audit_compliance",
  "identity_lineage",
  "operator_review",
  "workflow",
];

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Failed to load institutional sharing rooms";
}

export default function InstitutionalSharingRoomPage() {
  const { showToast } = useToast();
  const [rooms, setRooms] = React.useState<SharingRoom[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [revokingId, setRevokingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [roomType, setRoomType] = React.useState<SharingRoomType>("lender_review");
  const [institutionType, setInstitutionType] = React.useState<SharingInstitutionType>("lender");
  const [scopeKey, setScopeKey] = React.useState<SharingScopeKind>("evidence_pack");
  const [scopeId, setScopeId] = React.useState("decision-1");

  const loadRooms = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const next = await fetchSharingRooms();
      setRooms(next);
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      showToast({ message: "Failed to load institutional sharing rooms", description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  React.useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  async function createRoom() {
    if (!scopeId.trim()) return;
    try {
      setSaving(true);
      const room = await createSharingRoom({
        roomType,
        institutionType,
        redactionLevel: "strict",
        sharedScopes: [{ scopeKey, scopeId: scopeId.trim(), label: label(scopeKey) }],
      });
      setRooms((current) => [room, ...current.filter((item) => item.sharingRoomId !== room.sharingRoomId)]);
    } catch (err) {
      const message = errorMessage(err);
      showToast({ message: "Failed to create institutional sharing room", description: message, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function revokeRoom(sharingRoomId: string) {
    try {
      setRevokingId(sharingRoomId);
      const room = await revokeSharingRoom(sharingRoomId);
      setRooms((current) => current.map((item) => (item.sharingRoomId === room.sharingRoomId ? room : item)));
    } catch (err) {
      const message = errorMessage(err);
      showToast({ message: "Failed to revoke sharing room access", description: message, variant: "error" });
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <MacShell title="Institutional sharing rooms" showTopNav={false}>
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Institutional sharing rooms</h1>
            <div style={{ color: "#475569", maxWidth: 900 }}>
              Institutional sharing remains permissioned and review controlled. Sensitive data may be excluded or redacted.
              No public sharing or automated submission is enabled.
            </div>
          </div>
        </Section>

        <Section style={{ display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 900 }}>Create controlled room</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
            <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
              Room type
              <select value={roomType} onChange={(event) => setRoomType(event.target.value as SharingRoomType)} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px" }}>
                {roomTypes.map((type) => <option key={type} value={type}>{label(type)}</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
              Institution
              <select value={institutionType} onChange={(event) => setInstitutionType(event.target.value as SharingInstitutionType)} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px" }}>
                {institutionTypes.map((type) => <option key={type} value={type}>{label(type)}</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
              Scope
              <select value={scopeKey} onChange={(event) => setScopeKey(event.target.value as SharingScopeKind)} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px" }}>
                {scopeKinds.map((kind) => <option key={kind} value={kind}>{label(kind)}</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
              Scope ID
              <input value={scopeId} onChange={(event) => setScopeId(event.target.value)} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 220 }} />
            </label>
            <Button type="button" onClick={createRoom} disabled={saving || !scopeId.trim()}>
              Review access scope
            </Button>
          </div>
        </Section>

        {loading ? <Card>Loading institutional sharing rooms...</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>We couldn't load institutional sharing rooms right now.</Card> : null}
        {!loading && !error && !rooms.length ? <Card style={{ color: "#64748b" }}>No institutional sharing rooms have been created yet.</Card> : null}
        {!loading && !error && rooms.length ? (
          <div style={{ display: "grid", gap: 12 }}>
            {rooms.map((room) => (
              <InstitutionalSharingRoom
                key={room.sharingRoomId}
                room={room}
                onRevoke={revokeRoom}
                revoking={revokingId === room.sharingRoomId}
              />
            ))}
          </div>
        ) : null}
      </div>
    </MacShell>
  );
}
