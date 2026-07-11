import React from "react";
import { Link } from "react-router-dom";
import { evidencePackPath } from "@/api/evidencePackApi";
import {
  saveRenewalNoticeDraftSnapshot,
  type LandlordLeaseRenewalLease,
  type RenewalNoticeDraftSnapshot,
  type SaveRenewalNoticeDraftSnapshotPayload,
} from "@/api/landlordLeaseRenewalApi";
import { reviewTimelinePath } from "@/api/reviewTimelineApi";
import { formatRenewalCurrency } from "./LeaseRenewalOperatorInputsCard";

type LeaseRenewalNoticeDraftCardProps = {
  lease: LandlordLeaseRenewalLease;
  noticeWorkflowPath: string;
  onReviewInputs?: () => void;
};

type DraftReadiness = {
  ready: boolean;
  missing: string[];
  validationMessage?: string | null;
};

type SnapshotSaveState =
  | { status: "idle"; snapshot: null; error: null }
  | { status: "saving"; snapshot: null; error: null }
  | { status: "saved"; snapshot: RenewalNoticeDraftSnapshot; error: null }
  | { status: "error"; snapshot: null; error: string };

export type RenewalNoticeReviewModel = {
  tenantLabel: string;
  propertyUnitLabel: string;
  currentRentLabel: string;
  renewalRentLabel: string;
  currentLeaseEndLabel: string;
  proposedTermLabel: string;
  tenantResponseTargetDateLabel: string;
  leaseEvidencePath: string;
  leaseTimelinePath: string;
};

function formatDateOnly(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "Not set";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString("en-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

function isValidDateValue(value: string | number | null | undefined) {
  if (value == null || value === "") return false;
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  const raw = String(value || "").trim();
  if (!raw) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return true;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed);
}

function formatTargetDate(value: string | number | null | undefined) {
  if (!value) return "Not set";
  if (typeof value === "string") return formatDateOnly(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatSavedAt(value: string | number | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "Saved time unavailable";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function dateOnlySortValue(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
}

function formatTermType(value: LandlordLeaseRenewalLease["renewalNewTermType"]) {
  switch (value) {
    case "fixed_term":
      return "Fixed term";
    case "year_to_year":
      return "Year to year";
    case "month_to_month":
      return "Month to month";
    default:
      return "Not set";
  }
}

function formatEvidenceTermLabel(lease: LandlordLeaseRenewalLease) {
  return `${formatTermType(lease.renewalNewTermType)} · ${formatDateOnly(lease.renewalNewLeaseStartDate)} to ${formatDateOnly(
    lease.renewalNewLeaseEndDate
  )}`;
}

function cleanDisplayLabel(value: string | null | undefined) {
  return String(value || "").trim();
}

function looksLikeRawIdentifier(value: string) {
  const raw = value.trim();
  if (raw.length < 12 || /\s/.test(raw)) return false;
  return /^[A-Za-z0-9_-]+$/.test(raw) && /[A-Za-z]/.test(raw) && /\d/.test(raw);
}

function usableDisplayLabel(value: string | null | undefined, genericPattern?: RegExp) {
  const label = cleanDisplayLabel(value);
  if (!label) return null;
  if (genericPattern?.test(label)) return null;
  if (looksLikeRawIdentifier(label)) return null;
  return label;
}

function tenantDisplayName(lease: LandlordLeaseRenewalLease) {
  return usableDisplayLabel(lease.tenantName, /^tenant$/i);
}

function tenantMetadataLabel(lease: LandlordLeaseRenewalLease) {
  return tenantDisplayName(lease) || "Tenant name unavailable";
}

function unitDisplayLabel(lease: LandlordLeaseRenewalLease) {
  const unit = usableDisplayLabel(lease.unitLabel, /^unit$/i);
  if (!unit) return null;
  return /^unit\b/i.test(unit) ? unit : `Unit ${unit}`;
}

function propertyUnitLabel(lease: LandlordLeaseRenewalLease) {
  const property =
    usableDisplayLabel(lease.propertyAddress, /^property$/i) ||
    usableDisplayLabel(lease.propertyLabel, /^property$/i);
  const unit = unitDisplayLabel(lease);
  if (property && unit) return `${property} · ${unit}`;
  if (property) return property;
  if (unit) return unit;
  return "Property/unit unavailable";
}

function proposedRentRequired(lease: LandlordLeaseRenewalLease) {
  return lease.renewalRentChangeMode === "increase" || lease.renewalRentChangeMode === "decrease";
}

export function buildRenewalNoticeReviewModel(lease: LandlordLeaseRenewalLease): RenewalNoticeReviewModel {
  const currentRentLabel = formatRenewalCurrency(lease.currentRent, lease.currency) || "Current rent unavailable";
  const renewalRentLabel = proposedRentRequired(lease)
    ? formatRenewalCurrency(lease.renewalOfferedRent, lease.currency) || "Proposed rent not set"
    : "No rent change currently proposed";

  return {
    tenantLabel: tenantMetadataLabel(lease),
    propertyUnitLabel: propertyUnitLabel(lease),
    currentRentLabel,
    renewalRentLabel,
    currentLeaseEndLabel: formatDateOnly(lease.leaseEndDate),
    proposedTermLabel: formatEvidenceTermLabel(lease),
    tenantResponseTargetDateLabel: formatTargetDate(lease.renewalDecisionDeadlineAt),
    leaseEvidencePath: evidencePackPath({ scope: "lease", scopeId: lease.id }),
    leaseTimelinePath: reviewTimelinePath({ scope: "lease", scopeId: lease.id }),
  };
}

export function buildRenewalNoticeDraftSnapshotPayload(
  draftText: string,
  reviewModel: RenewalNoticeReviewModel
): SaveRenewalNoticeDraftSnapshotPayload {
  return {
    draftText,
    generatedAt: new Date().toISOString(),
    sourceValues: {
      tenantLabel: reviewModel.tenantLabel,
      propertyUnitLabel: reviewModel.propertyUnitLabel,
      currentRentLabel: reviewModel.currentRentLabel,
      renewalRentLabel: reviewModel.renewalRentLabel,
      currentLeaseEndLabel: reviewModel.currentLeaseEndLabel,
      proposedTermLabel: reviewModel.proposedTermLabel,
      tenantResponseTargetDateLabel: reviewModel.tenantResponseTargetDateLabel,
    },
    noDeliveryFlags: {
      emailSent: false,
      noticeServed: false,
      tenantNotified: false,
    },
  };
}

export function getRenewalNoticeDraftReadiness(lease: LandlordLeaseRenewalLease): DraftReadiness {
  const missing: string[] = [];
  let validationMessage: string | null = null;
  if (!lease.renewalRentChangeMode || lease.renewalRentChangeMode === "undecided") {
    missing.push("rent change mode");
  }
  if (proposedRentRequired(lease) && typeof lease.renewalOfferedRent !== "number") {
    missing.push("proposed rent");
  }
  if (!lease.renewalNewTermType) {
    missing.push("new term type");
  }
  if (!lease.renewalNewLeaseStartDate) {
    missing.push("new lease start date");
  }
  if (!lease.renewalNewLeaseEndDate) {
    missing.push("new lease end date");
  }
  if (!isValidDateValue(lease.renewalDecisionDeadlineAt)) {
    missing.push("tenant response target date");
  }
  const startValue = dateOnlySortValue(lease.renewalNewLeaseStartDate);
  const endValue = dateOnlySortValue(lease.renewalNewLeaseEndDate);
  if (startValue != null && endValue != null && startValue > endValue) {
    validationMessage =
      "Review renewal term dates before preparing a tenant notice draft. The new lease start date must be on or before the new lease end date.";
  }
  return { ready: missing.length === 0 && !validationMessage, missing, validationMessage };
}

export function buildRenewalNoticeDraftText(lease: LandlordLeaseRenewalLease) {
  const tenantName = tenantDisplayName(lease);
  const currentRent = formatRenewalCurrency(lease.currentRent, lease.currency) || "not available";
  const renewalRent = typeof lease.renewalOfferedRent === "number" ? formatRenewalCurrency(lease.renewalOfferedRent, lease.currency) : null;
  const startDate = formatDateOnly(lease.renewalNewLeaseStartDate);
  const endDate = formatDateOnly(lease.renewalNewLeaseEndDate);
  const targetDate = formatTargetDate(lease.renewalDecisionDeadlineAt);
  const greeting = tenantName ? `Hello ${tenantName},` : "Hello,";
  const termSentence =
    lease.renewalNewTermType === "fixed_term"
      ? `The new fixed term would begin on ${startDate} and end on ${endDate}.`
      : `The renewal term details would begin on ${startDate} and end on ${endDate}.`;
  const rentSentence = renewalRent ? ` The rent for the unit you occupy would be ${renewalRent}.` : "";

  return [
    greeting,
    "",
    `We are preparing renewal details for ${propertyUnitLabel(lease)}. The current rent on file is ${currentRent}. ${termSentence}${rentSentence}`,
    "",
    `Please review these renewal details. The tenant response target date recorded for internal follow-up is ${targetDate}.`,
    "",
    "This message is for renewal planning and review. Please refer to the official lease documents and current provincial requirements before relying on any notice or timing requirement.",
    "",
    "Thank you.",
  ].join("\n");
}

export function LeaseRenewalNoticeDraftCard({
  lease,
  noticeWorkflowPath,
  onReviewInputs,
}: LeaseRenewalNoticeDraftCardProps) {
  const [copyStatus, setCopyStatus] = React.useState<"idle" | "success" | "error">("idle");
  const readiness = getRenewalNoticeDraftReadiness(lease);
  const draftText = React.useMemo(() => buildRenewalNoticeDraftText(lease), [lease]);
  const reviewModel = React.useMemo(() => buildRenewalNoticeReviewModel(lease), [lease]);

  async function copyDraft() {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(draftText);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = draftText;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!copied) throw new Error("copy_failed");
      }
      setCopyStatus("success");
    } catch {
      setCopyStatus("error");
    }
  }

  function downloadDraft() {
    const blob = new Blob([draftText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `renewal-notice-draft-${lease.id}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  if (!readiness.ready) {
    return (
      <div style={cardStyle} aria-label="Tenant renewal notice draft">
        <div style={headerStyle}>
          <div>
            <h3 style={headingStyle}>Tenant renewal notice draft</h3>
            <div style={mutedStyle}>Prepare tenant-facing draft copy after the saved renewal inputs are complete.</div>
          </div>
          <span style={badgeStyle}>Inputs needed</span>
        </div>
        <div style={warningStyle}>
          {readiness.validationMessage || "Save renewal operator inputs before preparing a tenant notice draft."}
        </div>
        {readiness.missing.length > 0 ? <div style={mutedStyle}>Missing: {readiness.missing.join(", ")}.</div> : null}
        <button type="button" onClick={onReviewInputs} style={secondaryButtonStyle}>
          Review renewal operator inputs
        </button>
      </div>
    );
  }

  return (
    <div style={cardStyle} aria-label="Tenant renewal notice draft">
      <div style={headerStyle}>
        <div>
          <h3 style={headingStyle}>Tenant renewal notice draft</h3>
          <div style={mutedStyle}>Review conservative draft copy before using any tenant communication workflow.</div>
        </div>
        <span style={readyBadgeStyle}>Draft ready</span>
      </div>

      <dl style={factsGridStyle}>
        <Fact label="Tenant" value={reviewModel.tenantLabel} />
        <Fact label="Unit/property" value={reviewModel.propertyUnitLabel} />
        <Fact label="Current rent" value={reviewModel.currentRentLabel} />
        <Fact label="Proposed rent" value={reviewModel.renewalRentLabel} />
        <Fact label="Current lease end" value={reviewModel.currentLeaseEndLabel} />
        <Fact label="Proposed term" value={reviewModel.proposedTermLabel} />
        <Fact label="Tenant response target date" value={reviewModel.tenantResponseTargetDateLabel} />
      </dl>

      <label style={{ display: "grid", gap: 6 }}>
        <span style={termStyle}>Draft message preview</span>
        <textarea readOnly value={draftText} rows={9} style={draftPreviewStyle} />
      </label>

      <div style={noticeStyle}>
        Email delivery is not enabled from this workflow yet. Use this draft for review; notice drafting, delivery, and
        evidence tracking should be completed in the dedicated communication workflow when available.
      </div>

      <section style={evidenceReadinessStyle} aria-label="Evidence readiness">
        <div style={evidenceReadinessHeaderStyle}>
          <div>
            <h4 style={subheadingStyle}>Evidence readiness</h4>
            <div style={mutedStyle}>Draft prepared from saved renewal inputs. Review values before tenant communication.</div>
          </div>
          <span style={evidenceBadgeStyle}>Operational record only</span>
        </div>

        <dl style={factsGridStyle}>
          <Fact label="Tenant" value={reviewModel.tenantLabel} />
          <Fact label="Property/unit" value={reviewModel.propertyUnitLabel} />
          <Fact label="Current rent" value={reviewModel.currentRentLabel} />
          <Fact label="Renewal rent" value={reviewModel.renewalRentLabel} />
          <Fact label="Current lease end" value={reviewModel.currentLeaseEndLabel} />
          <Fact label="Proposed term" value={reviewModel.proposedTermLabel} />
          <Fact label="Tenant response target date" value={reviewModel.tenantResponseTargetDateLabel} />
        </dl>

        <div style={statusListStyle}>
          <StatusItem label="Draft prepared from saved renewal inputs" tone="ready" />
          <StatusItem label="Copy/download actions are available for review" tone="ready" />
          <StatusItem label="Email delivery not enabled" tone="deferred" />
          <StatusItem label="Notice not sent" tone="deferred" />
          <StatusItem label="Tenant not notified" tone="deferred" />
        </div>

        <RenewalNoticeDraftSnapshotCapture lease={lease} draftText={draftText} reviewModel={reviewModel} />

      </section>

      <div style={actionsStyle}>
        <button type="button" onClick={() => void copyDraft()} style={primaryButtonStyle}>
          Copy draft text
        </button>
        <button type="button" onClick={downloadDraft} style={secondaryButtonStyle}>
          Download draft
        </button>
        <Link to={noticeWorkflowPath} style={linkButtonStyle}>
          Open notice review workflow
        </Link>
      </div>

      {copyStatus === "success" ? <div style={successStyle}>Draft text copied.</div> : null}
      {copyStatus === "error" ? <div style={warningStyle}>Draft text could not be copied. Select the preview text manually.</div> : null}
    </div>
  );
}

export function RenewalNoticeDraftSnapshotCapture({
  lease,
  draftText,
  reviewModel,
  onSnapshotSaved,
}: {
  lease: LandlordLeaseRenewalLease;
  draftText: string;
  reviewModel: RenewalNoticeReviewModel;
  onSnapshotSaved?: (snapshot: RenewalNoticeDraftSnapshot) => void;
}) {
  const [saveState, setSaveState] = React.useState<SnapshotSaveState>({ status: "idle", snapshot: null, error: null });

  async function saveSnapshot() {
    setSaveState({ status: "saving", snapshot: null, error: null });
    try {
      const response = await saveRenewalNoticeDraftSnapshot(
        lease.id,
        buildRenewalNoticeDraftSnapshotPayload(draftText, reviewModel)
      );
      setSaveState({ status: "saved", snapshot: response.snapshot, error: null });
      onSnapshotSaved?.(response.snapshot);
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "Draft snapshot could not be saved.";
      setSaveState({ status: "error", snapshot: null, error: message });
    }
  }

  const saved = saveState.status === "saved" ? saveState.snapshot : null;
  const actor = saved?.actor?.email || saved?.actor?.id || null;

  return (
    <div style={snapshotPanelStyle} aria-label="Draft snapshot persistence">
      <div style={evidenceReadinessHeaderStyle}>
        <div>
          <h4 style={subheadingStyle}>Draft snapshot</h4>
          <div style={mutedStyle}>
            Save this generated draft and source-value snapshot for audit review. This does not send email, serve notice, or notify the tenant.
          </div>
        </div>
        <span style={saved ? readyBadgeStyle : evidenceBadgeStyle}>{saved ? "Draft snapshot saved" : "Not saved yet"}</span>
      </div>

      {saved ? (
        <dl style={factsGridStyle}>
          <Fact label="Saved" value={formatSavedAt(saved.savedAt)} />
          <Fact label="Captured by" value={actor || "Actor unavailable"} />
          <Fact label="Audit event" value={saved.auditEventId ? "Audit event recorded" : "Audit capture deferred"} />
          <Fact label="Delivery state" value="Not sent · Not served · Tenant not notified" />
        </dl>
      ) : (
        <div style={noticeStyle}>
          Draft snapshot not saved yet. Save when the current draft and source values are ready for review capture.
        </div>
      )}

      <div style={actionsStyle}>
        <button
          type="button"
          onClick={() => void saveSnapshot()}
          disabled={saveState.status === "saving"}
          style={saveState.status === "saving" ? disabledButtonStyle : primaryButtonStyle}
        >
          {saveState.status === "saving" ? "Saving draft snapshot…" : "Save draft snapshot"}
        </button>
        <Link to={reviewModel.leaseTimelinePath} style={linkButtonStyle}>
          Open lease review timeline
        </Link>
        <Link to={reviewModel.leaseEvidencePath} style={linkButtonStyle}>
          Open lease evidence preview
        </Link>
      </div>

      {saved?.auditEventId ? <div style={successStyle}>Audit event recorded.</div> : null}
      {saved ? (
        <div style={mutedStyle}>Evidence preview can include the saved draft snapshot as read-only audit context; no tenant communication was created.</div>
      ) : null}
      {saveState.status === "error" ? <div style={warningStyle}>{saveState.error}</div> : null}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <dt style={termStyle}>{label}</dt>
      <dd style={valueStyle}>{value}</dd>
    </div>
  );
}

function StatusItem({ label, tone }: { label: string; tone: "ready" | "deferred" }) {
  const markerStyle = tone === "ready" ? readyMarkerStyle : deferredMarkerStyle;
  return (
    <div style={statusItemStyle}>
      <span aria-hidden="true" style={markerStyle} />
      <span>{label}</span>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  padding: 14,
  border: "1px solid rgba(91, 70, 48, 0.18)",
  borderRadius: 12,
  background: "#fffaf1",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const headingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  color: "#211c17",
  letterSpacing: 0,
};

const subheadingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 15,
  color: "#211c17",
  letterSpacing: 0,
};

const mutedStyle: React.CSSProperties = {
  color: "#63594d",
  lineHeight: 1.55,
};

const badgeStyle: React.CSSProperties = {
  border: "1px solid rgba(245, 158, 11, 0.35)",
  borderRadius: 999,
  background: "rgba(245, 158, 11, 0.14)",
  color: "#92400e",
  fontSize: 12,
  fontWeight: 800,
  padding: "5px 10px",
  whiteSpace: "nowrap",
};

const readyBadgeStyle: React.CSSProperties = {
  ...badgeStyle,
  border: "1px solid rgba(22, 101, 52, 0.28)",
  background: "rgba(22, 101, 52, 0.10)",
  color: "#166534",
};

const evidenceBadgeStyle: React.CSSProperties = {
  ...badgeStyle,
  border: "1px solid rgba(91, 70, 48, 0.24)",
  background: "rgba(255, 246, 232, 0.95)",
  color: "#5b4630",
};

const factsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 12,
  margin: 0,
};

const termStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#7a6b5c",
  textTransform: "uppercase",
  letterSpacing: 0,
};

const valueStyle: React.CSSProperties = {
  margin: 0,
  color: "#211c17",
  fontWeight: 700,
  lineHeight: 1.35,
};

const draftPreviewStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid rgba(91, 70, 48, 0.22)",
  borderRadius: 10,
  background: "#fff",
  color: "#211c17",
  font: "inherit",
  lineHeight: 1.5,
  padding: 12,
  resize: "vertical",
};

const noticeStyle: React.CSSProperties = {
  color: "#63594d",
  lineHeight: 1.55,
  border: "1px dashed rgba(91, 70, 48, 0.3)",
  borderRadius: 10,
  background: "rgba(255, 246, 232, 0.72)",
  padding: 10,
};

const evidenceReadinessStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  border: "1px solid rgba(91, 70, 48, 0.18)",
  borderRadius: 10,
  background: "rgba(255, 246, 232, 0.62)",
  padding: 12,
};

const snapshotPanelStyle: React.CSSProperties = {
  ...evidenceReadinessStyle,
  background: "#fffaf1",
};

const evidenceReadinessHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const statusListStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 8,
};

const statusItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#211c17",
  fontWeight: 700,
  lineHeight: 1.4,
};

const statusMarkerBaseStyle: React.CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: 999,
  flexShrink: 0,
};

const readyMarkerStyle: React.CSSProperties = {
  ...statusMarkerBaseStyle,
  background: "#166534",
};

const deferredMarkerStyle: React.CSSProperties = {
  ...statusMarkerBaseStyle,
  background: "#b45309",
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const baseButtonStyle: React.CSSProperties = {
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 800,
  padding: "8px 10px",
};

const primaryButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  border: "1px solid #245842",
  background: "#245842",
  color: "#fff",
};

const secondaryButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  border: "1px solid rgba(91, 70, 48, 0.3)",
  background: "#fffaf1",
  color: "#245842",
};

const disabledButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  border: "1px solid rgba(91, 70, 48, 0.18)",
  background: "rgba(91, 70, 48, 0.12)",
  color: "#7a6b5c",
  cursor: "wait",
};

const linkButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  display: "inline-flex",
  alignItems: "center",
  textDecoration: "none",
};

const successStyle: React.CSSProperties = {
  color: "#166534",
  fontWeight: 700,
};

const warningStyle: React.CSSProperties = {
  color: "#92400e",
  fontWeight: 700,
};
