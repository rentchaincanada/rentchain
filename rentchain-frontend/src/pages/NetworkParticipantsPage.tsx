import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchNetworkParticipants,
  type NetworkParticipantProfile,
  type NetworkParticipantStatus,
  type NetworkParticipantType,
} from "@/api/networkParticipantsApi";
import { MacShell } from "@/components/layout/MacShell";
import { NetworkParticipantPanel } from "@/components/network/NetworkParticipantPanel";
import { Card, Section } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";

const participantTypes: Array<NetworkParticipantType | ""> = [
  "",
  "landlord",
  "operator",
  "lender",
  "insurer",
  "auditor",
  "regulator",
  "contractor",
  "institutional_partner",
  "review_actor",
];
const statuses: Array<NetworkParticipantStatus | ""> = ["", "verified", "partially_verified", "review_required", "blocked", "unknown"];

function label(value: string) {
  return value ? value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "All";
}

export default function NetworkParticipantsPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [participants, setParticipants] = React.useState<NetworkParticipantProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const participantType = String(searchParams.get("participantType") || "") as NetworkParticipantType | "";
  const participantId = String(searchParams.get("participantId") || "").trim();
  const status = String(searchParams.get("status") || "") as NetworkParticipantStatus | "";

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const next = await fetchNetworkParticipants({ participantType, participantId: participantId || undefined, status });
        if (mounted) setParticipants(next);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load network participants";
        if (mounted) {
          setError(message);
          showToast({ message: "Failed to load network participants", description: message, variant: "error" });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [participantType, participantId, status, showToast]);

  function updateParams(next: { participantType?: string; participantId?: string; status?: string }) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(next)) {
      if (value && value.trim()) params.set(key, value.trim());
      else params.delete(key);
    }
    setSearchParams(params);
  }

  return (
    <MacShell title="Network participants" showTopNav={false}>
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Network participants</h1>
            <div style={{ color: "#475569", maxWidth: 900 }}>
              Network participants are permissioned operational actors. No public discovery or autonomous relationship execution is enabled.
              Manual review remains required.
            </div>
          </div>
        </Section>

        <Section style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Participant type
            <select value={participantType} onChange={(event) => updateParams({ participantType: event.target.value })} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 190 }}>
              {participantTypes.map((type) => <option key={type || "all"} value={type}>{label(type)}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Participant reference
            <input value={participantId} onChange={(event) => updateParams({ participantId: event.target.value })} placeholder="Optional internal reference" style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 230 }} />
          </label>
          <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Status
            <select value={status} onChange={(event) => updateParams({ status: event.target.value })} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 180 }}>
              {statuses.map((item) => <option key={item || "all"} value={item}>{label(item)}</option>)}
            </select>
          </label>
        </Section>

        {loading ? <Card>Loading network participants...</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>We couldn't load network participants right now.</Card> : null}
        {!loading && !error && !participants.length ? <Card style={{ color: "#64748b" }}>No network participants match these filters.</Card> : null}
        {!loading && !error && participants.length ? <div style={{ display: "grid", gap: 16 }}>{participants.map((participant) => <NetworkParticipantPanel key={participant.participantId} participant={participant} />)}</div> : null}
      </div>
    </MacShell>
  );
}
