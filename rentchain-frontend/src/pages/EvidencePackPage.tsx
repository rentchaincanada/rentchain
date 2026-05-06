import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchEvidencePackPreview,
  type EvidencePack,
  type EvidencePackScope,
} from "@/api/evidencePackApi";
import { EvidencePackPanel } from "@/components/evidence/EvidencePackPanel";
import { MacShell } from "@/components/layout/MacShell";
import { Card, Section } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";

const scopeOptions: EvidencePackScope[] = [
  "decision",
  "workflow",
  "delinquency",
  "institution_export",
  "audit_compliance",
  "lease",
  "property",
  "tenant",
  "maintenance",
  "admin_review",
];

function isScope(value: string | null): value is EvidencePackScope {
  return Boolean(value && scopeOptions.includes(value as EvidencePackScope));
}

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Failed to load evidence pack preview";
}

export default function EvidencePackPage() {
  const [params, setParams] = useSearchParams();
  const { showToast } = useToast();
  const initialScope = params.get("scope");
  const [scope, setScope] = React.useState<EvidencePackScope>(isScope(initialScope) ? initialScope : "decision");
  const [scopeId, setScopeId] = React.useState(params.get("scopeId") || "");
  const [data, setData] = React.useState<EvidencePack | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadPreview = React.useCallback(async () => {
    if (!scopeId.trim()) {
      setError("Scope ID is required for evidence preview.");
      setData(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const evidencePack = await fetchEvidencePackPreview({ scope, scopeId: scopeId.trim() });
      setData(evidencePack);
      setParams({ scope, scopeId: scopeId.trim() });
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      showToast({ message: "Failed to load evidence pack preview", description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [scope, scopeId, setParams, showToast]);

  React.useEffect(() => {
    if (params.get("scopeId")) void loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <MacShell title="Evidence pack preview" showTopNav={false}>
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Evidence pack preview</h1>
            <div style={{ color: "#475569", maxWidth: 900 }}>
              Preview only. Evidence is not shared externally. Manual review is required before relying on or sharing this
              evidence. Sensitive data may be excluded or redacted.
            </div>
          </div>
        </Section>

        <Section style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
          <label style={{ display: "grid", gap: 5, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Scope
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value as EvidencePackScope)}
              style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 200 }}
            >
              {scopeOptions.map((option) => (
                <option key={option} value={option}>
                  {label(option)}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 5, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Scope ID
            <input
              value={scopeId}
              onChange={(event) => setScopeId(event.target.value)}
              style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minWidth: 260 }}
            />
          </label>
          <button
            type="button"
            onClick={loadPreview}
            disabled={loading || !scopeId.trim()}
            style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 12px", fontWeight: 900, background: "#fff" }}
          >
            Preview evidence
          </button>
        </Section>

        {loading ? <Card>Loading evidence pack preview...</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>{error}</Card> : null}
        {!loading && !error && data ? <EvidencePackPanel evidencePack={data} /> : null}
      </div>
    </MacShell>
  );
}
