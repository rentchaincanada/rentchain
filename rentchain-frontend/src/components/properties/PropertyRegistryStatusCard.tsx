import React, { useEffect, useState } from "react";
import { Button, Card, Pill } from "../ui/Ui";
import {
  fetchPropertyRegistryStatus,
  type Property,
  type PropertyRegistryReadiness,
  type PropertyRegistryStatus,
} from "../../api/propertiesApi";

function formatDate(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function statusLabel(status: PropertyRegistryStatus["registryStatus"]) {
  switch (status) {
    case "verified":
      return "Verified";
    case "pending_review":
      return "Pending municipal review";
    case "possible_mismatch":
      return "Possible mismatch detected";
    case "manual_review":
      return "Manual review in progress";
    case "not_found":
    default:
      return "No public match found";
  }
}

function readinessLabel(status: PropertyRegistryReadiness["readinessStatus"]) {
  switch (status) {
    case "verified":
      return "Verified";
    case "registry_ready":
      return "Registry-ready";
    case "manual_review_in_progress":
      return "Manual review";
    case "possible_mismatch":
      return "Possible mismatch";
    case "no_public_match":
      return "No public match";
    case "unsupported_jurisdiction":
      return "Unsupported";
    case "incomplete":
    default:
      return "Incomplete";
  }
}

function readinessTone(status: PropertyRegistryReadiness["readinessStatus"]) {
  if (status === "verified" || status === "registry_ready" || status === "possible_mismatch" || status === "manual_review_in_progress") {
    return "accent";
  }
  return "muted";
}

function nextActionLabel(readiness: PropertyRegistryReadiness) {
  switch (readiness.nextRecommendedAction) {
    case "view_verified_details":
      return "View verified details";
    case "export_ready_draft":
      return readiness.mode === "registry_ready_fallback" ? "Export registry-ready draft" : "Export ready draft";
    case "complete_missing_fields":
      return readiness.mode === "registry_ready_fallback" ? "Complete registry-ready profile" : "Complete missing data";
    case "review_possible_match":
      return "Review discrepancy";
    case "resolve_mismatch":
      return "Review match";
    case "add_pid":
      return "Add PID";
    case "prepare_registry_submission":
      return readiness.assistant.ctaLabel;
    case "no_action_needed":
    default:
      return "No action needed";
  }
}

function readinessSummary(readiness: PropertyRegistryReadiness) {
  switch (readiness.readinessStatus) {
    case "verified":
      return "Verified against public registry data.";
    case "registry_ready":
      return "Registry-ready draft prepared and ready for export.";
    case "manual_review_in_progress":
      return "Manual review is in progress before the registry state can be confirmed.";
    case "possible_mismatch":
      return "A possible mismatch was detected and should be reviewed before relying on registry status.";
    case "no_public_match":
      return "No public match was found yet. You can still prepare this property for registry or compliance readiness.";
    case "unsupported_jurisdiction":
      return "This jurisdiction is not yet connected to a public registry workflow.";
    case "incomplete":
    default:
      return "Required data is still missing before this property is registry-ready.";
  }
}

function compactSupportingLine(readiness: PropertyRegistryReadiness) {
  switch (readiness.readinessStatus) {
    case "verified":
      return "Verified against public registry data.";
    case "registry_ready":
      return "Registry-ready draft is prepared.";
    case "manual_review_in_progress":
      return "Manual review is in progress.";
    case "possible_mismatch":
      return "Possible match requires manual review.";
    case "no_public_match":
      return "No public match found in available registry data.";
    case "unsupported_jurisdiction":
      return "No connected public registry workflow for this jurisdiction.";
    case "incomplete":
    default:
      return "Missing required data for a registry-ready draft.";
  }
}

function shouldShowCompactAssistantCta(readiness: PropertyRegistryReadiness) {
  return (
    readiness.nextRecommendedAction === "prepare_registry_submission" ||
    readiness.nextRecommendedAction === "complete_missing_fields" ||
    readiness.nextRecommendedAction === "export_ready_draft"
  );
}

type Props = {
  property: Property | null;
  onOpenSubmissionAssistant?: () => void;
};

export const PropertyRegistryStatusCard: React.FC<Props> = ({ property, onOpenSubmissionAssistant }) => {
  const [data, setData] = useState<{
    status: PropertyRegistryStatus | null;
    source: { sourceLabel: string };
    coverage: { available: boolean; message: string | null };
    pidPrompt: {
      propertyPid: string | null;
      propertyPidMissing: boolean;
      registryPid: string | null;
      registryPidAvailable: boolean;
      pidPromptEligible: boolean;
      pidPromptMessage: string | null;
      sourceLabel: string;
      actionable: boolean;
    };
    readiness: PropertyRegistryReadiness;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [detailsOpen, setDetailsOpen] = useState(false);
  useEffect(() => {
    let active = true;
    const propertyId = property?.id;
    if (!propertyId) {
      setData(null);
      return;
    }
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchPropertyRegistryStatus(propertyId);
        if (!active) return;
        setData(result);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || "Failed to load registry status");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [property?.id]);

  const handleCopyPid = async () => {
    const pid = data?.pidPrompt.registryPid;
    if (!pid) return;
    try {
      await navigator.clipboard.writeText(pid);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("failed");
    }
  };

  const canOpenAdminReview =
    typeof window !== "undefined" && window.location.pathname.startsWith("/admin") && Boolean(property?.id);

  return (
    <Card style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 }}>
            Compliance / Registry
          </div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Compliance / Registry Readiness</div>
        </div>
        {data?.readiness ? <Pill tone={readinessTone(data.readiness.readinessStatus)}>{readinessLabel(data.readiness.readinessStatus)}</Pill> : null}
      </div>
      {loading ? <div style={{ color: "#475569" }}>Checking registry and readiness…</div> : null}
      {!loading && error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}
      {!loading && data?.readiness ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ color: "#475569", lineHeight: 1.5 }}>{compactSupportingLine(data.readiness)}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Pill tone="muted">{data.readiness.schemaLabel}</Pill>
            {data.readiness.readinessStatus !== "verified" ? (
              <Pill tone="muted">{data.readiness.completionPercent}% complete</Pill>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button type="button" variant="secondary" onClick={() => setDetailsOpen(true)}>
              View details
            </Button>
            {onOpenSubmissionAssistant && shouldShowCompactAssistantCta(data.readiness) ? (
              <Button type="button" onClick={onOpenSubmissionAssistant}>
                {data.readiness.assistant.ctaLabel}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {detailsOpen && data ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Compliance and registry details"
          onMouseDown={() => setDetailsOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.46)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 1300,
          }}
        >
          <div
            onMouseDown={(event) => event.stopPropagation()}
            style={{
              width: "min(820px, 100%)",
              maxHeight: "88vh",
              overflow: "auto",
              background: "#fff",
              borderRadius: 18,
              padding: 18,
              display: "grid",
              gap: 16,
              boxShadow: "0 22px 70px rgba(15,23,42,0.22)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 }}>
                  Compliance / Registry
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>Readiness details</div>
                <div style={{ color: "#475569", lineHeight: 1.5 }}>{readinessSummary(data.readiness)}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Pill tone={readinessTone(data.readiness.readinessStatus)}>{readinessLabel(data.readiness.readinessStatus)}</Pill>
                <Button type="button" variant="secondary" onClick={() => setDetailsOpen(false)}>
                  Close
                </Button>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: 10,
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid rgba(15,23,42,0.08)",
                background: "rgba(15,23,42,0.03)",
              }}
            >
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Pill tone="muted">{data.readiness.schemaLabel}</Pill>
                <Pill tone="muted">{data.readiness.completionPercent}% complete</Pill>
                <Pill tone="muted">Score {data.readiness.readinessScore}</Pill>
              </div>
              <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                <div>
                  <strong>Jurisdiction:</strong>{" "}
                  {[
                    data.readiness.jurisdiction.municipality,
                    data.readiness.jurisdiction.province,
                    data.readiness.jurisdiction.country,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </div>
                <div>
                  <strong>Registry state:</strong> {data.readiness.currentRegistryState.summary}
                </div>
                <div>
                  <strong>Next action:</strong> {nextActionLabel(data.readiness)}
                </div>
              </div>
              {data.readiness.topMissingItems.length ? (
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>Top missing items</div>
                  {data.readiness.topMissingItems.slice(0, 5).map((item) => (
                    <div key={`${item.category}-${item.headline}`} style={{ color: "#475569", fontSize: 14 }}>
                      • {item.headline}
                      {item.count > 1 ? ` (${item.count})` : ""}
                    </div>
                  ))}
                </div>
              ) : null}
              {data.readiness.warnings.length ? (
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>Warnings</div>
                  {data.readiness.warnings.map((warning, index) => (
                    <div key={`${warning}-${index}`} style={{ color: "#475569", fontSize: 14 }}>
                      • {warning}
                    </div>
                  ))}
                </div>
              ) : null}
              {data.readiness.registryAvailabilityNote ? (
                <div style={{ color: "#475569", fontSize: 13 }}>{data.readiness.registryAvailabilityNote}</div>
              ) : null}
            </div>

            {data.pidPrompt.pidPromptEligible ? (
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(37,99,235,0.18)",
                  background: "rgba(37,99,235,0.06)",
                }}
              >
                <div style={{ fontWeight: 700, color: "#0f172a" }}>Property PID missing</div>
                <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.5 }}>
                  {data.pidPrompt.pidPromptMessage}
                </div>
                <div style={{ color: "#334155", fontSize: 13 }}>
                  Registry PID available from {data.pidPrompt.sourceLabel}: <strong>{data.pidPrompt.registryPid}</strong>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      void handleCopyPid();
                    }}
                  >
                    {copyState === "copied" ? "PID copied" : "Copy PID"}
                  </Button>
                  {canOpenAdminReview ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        window.location.assign(`/admin/registry/properties/${encodeURIComponent(String(property?.id || ""))}`);
                      }}
                    >
                      Open registry review
                    </Button>
                  ) : null}
                </div>
                {copyState === "failed" ? (
                  <div style={{ color: "#b91c1c", fontSize: 13 }}>
                    Could not copy automatically. You can still copy the PID manually.
                  </div>
                ) : null}
              </div>
            ) : null}

            {data.status ? (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontWeight: 700, color: "#0f172a" }}>Registry details</div>
                <div style={{ color: "#475569" }}>{data.status.summary}</div>
                <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                  <div>
                    <strong>Property PID:</strong> {data.pidPrompt.propertyPid || "--"}
                  </div>
                  <div>
                    <strong>Registry PID:</strong> {data.status.pid || "--"}
                  </div>
                  <div>
                    <strong>Source:</strong> {data.source.sourceLabel}
                  </div>
                  <div>
                    <strong>Last checked:</strong> {formatDate(data.status.lastEvaluatedAt)}
                  </div>
                  <div>
                    <strong>Registration number:</strong> {data.status.registrationNumber || "--"}
                  </div>
                  <div>
                    <strong>Recommended action:</strong> {data.status.recommendedAction}
                  </div>
                </div>
              </div>
            ) : null}

            {onOpenSubmissionAssistant ? (
              <div
                style={{
                  borderRadius: 12,
                  border: "1px solid rgba(15,23,42,0.08)",
                  background: "rgba(15,23,42,0.03)",
                  padding: "12px 14px",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ fontWeight: 700, color: "#0f172a" }}>{data.readiness.assistant.title}</div>
                <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.5 }}>
                  {data.readiness.assistant.description}
                </div>
                <div>
                  <Button
                    type="button"
                    onClick={() => {
                      setDetailsOpen(false);
                      onOpenSubmissionAssistant();
                    }}
                  >
                    {data.readiness.assistant.ctaLabel}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </Card>
  );
};
