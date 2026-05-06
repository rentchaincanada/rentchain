import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  fetchIdentityLayerProfile,
  type IdentityLayerProfile,
  type IdentityLayerType,
} from "@/api/identityLayerApi";
import { IdentityProfilePanel } from "@/components/identity/IdentityProfilePanel";
import { MacShell } from "@/components/layout/MacShell";
import { Card, Section } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";

const IDENTITY_TYPES: IdentityLayerType[] = ["tenant", "property", "organization", "operator", "review_actor"];

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Failed to load identity layer profile";
}

function requestedType(value: string | null): IdentityLayerType {
  return IDENTITY_TYPES.includes(value as IdentityLayerType) ? (value as IdentityLayerType) : "tenant";
}

export default function IdentityLayerPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = React.useState<IdentityLayerProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const identityType = requestedType(searchParams.get("identityType"));
  const identityId = String(searchParams.get("identityId") || "").trim();

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const next = await fetchIdentityLayerProfile({ identityType, identityId: identityId || undefined });
        if (!mounted) return;
        setProfile(next);
      } catch (err) {
        if (!mounted) return;
        const message = errorMessage(err);
        setError(message);
        showToast({ message: "Failed to load identity layer profile", description: message, variant: "error" });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [identityType, identityId, showToast]);

  function updateParams(next: { identityType?: IdentityLayerType; identityId?: string }) {
    const params = new URLSearchParams(searchParams);
    if (next.identityType) params.set("identityType", next.identityType);
    if (next.identityId !== undefined) {
      if (next.identityId.trim()) params.set("identityId", next.identityId.trim());
      else params.delete("identityId");
    }
    setSearchParams(params);
  }

  return (
    <MacShell title="Identity layer" showTopNav={false}>
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Identity layer</h1>
            <div style={{ color: "#475569", maxWidth: 900 }}>
              Identity references are permissioned and operationally scoped. Manual review remains required. No public identity sharing or
              tokenization is enabled.
            </div>
          </div>
        </Section>

        <Section style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
            <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
              Identity type
              <select
                value={identityType}
                onChange={(event) => updateParams({ identityType: event.target.value as IdentityLayerType })}
                style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 180 }}
              >
                {IDENTITY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13, fontWeight: 800 }}>
              Identity reference
              <input
                value={identityId}
                onChange={(event) => updateParams({ identityId: event.target.value })}
                placeholder="Optional internal reference"
                style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 240 }}
              />
            </label>
            <Link to="/review-timeline" style={{ color: "#2563eb", fontWeight: 800, paddingBottom: 9 }}>
              View review lineage
            </Link>
            <Link
              to={`/verified-rental-history${identityId ? `?identityId=${encodeURIComponent(identityId)}` : ""}`}
              style={{ color: "#2563eb", fontWeight: 800, paddingBottom: 9 }}
            >
              View rental history
            </Link>
          </div>
        </Section>

        {loading ? <Card>Loading identity layer profile...</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>We couldn't load identity layer profile right now.</Card> : null}
        {!loading && !error && profile ? <IdentityProfilePanel profile={profile} /> : null}
      </div>
    </MacShell>
  );
}
