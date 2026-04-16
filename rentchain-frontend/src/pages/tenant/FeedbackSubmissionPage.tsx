import React from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input } from "../../components/ui/Ui";
import { submitTenantFeedback } from "../../api/tenantFeedbackApi";
import { colors, radius, spacing, text as textTokens } from "../../styles/tokens";
import { TenantSurfaceShell } from "./TenantWorkspaceShared";

const TYPE_OPTIONS = [
  { value: "application_experience", label: "Application experience" },
  { value: "screening_experience", label: "Screening experience" },
  { value: "maintenance_experience", label: "Maintenance experience" },
  { value: "communication_experience", label: "Communication experience" },
] as const;

const SENTIMENT_OPTIONS = [
  { value: "positive", label: "Positive" },
  { value: "neutral", label: "Neutral" },
  { value: "negative", label: "Negative" },
] as const;

export default function FeedbackSubmissionPage() {
  const navigate = useNavigate();
  const [type, setType] = React.useState<(typeof TYPE_OPTIONS)[number]["value"]>("maintenance_experience");
  const [resourceType, setResourceType] = React.useState("maintenance");
  const [resourceId, setResourceId] = React.useState("");
  const [sentiment, setSentiment] = React.useState<(typeof SENTIMENT_OPTIONS)[number]["value"]>("neutral");
  const [tags, setTags] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);

  const submit = async () => {
    if (!resourceType.trim() || !resourceId.trim()) {
      setError("Resource type and resource ID are required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await submitTenantFeedback({
        type,
        resourceType: resourceType.trim(),
        resourceId: resourceId.trim(),
        sentiment,
        tags: tags
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        notes: notes.trim(),
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || "Unable to submit feedback.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TenantSurfaceShell
      title="Share feedback"
      subtitle="Help improve future portfolio health guidance by sharing a short summary of your recent experience."
    >
      <div style={{ display: "grid", gap: spacing.md }}>
        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            background: colors.panel,
            padding: "12px 14px",
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 800, color: textTokens.primary }}>How feedback is used</div>
          <div style={{ color: textTokens.secondary }}>
            Feedback is stored as a structured signal and only used in anonymized, aggregated summaries.
          </div>
        </div>

        {submitted ? (
          <div
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: radius.md,
              background: "#ecfdf5",
              color: "#166534",
              padding: "12px 14px",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 700 }}>Feedback submitted</div>
            <div>Thank you for sharing your experience.</div>
          </div>
        ) : null}

        {error ? (
          <div
            style={{
              border: `1px solid ${colors.borderStrong}`,
              borderRadius: radius.md,
              background: "#fff7ed",
              color: "#9a3412",
              padding: "10px 12px",
            }}
          >
            {error}
          </div>
        ) : null}

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ color: textTokens.muted }}>Feedback type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            style={{
              padding: "9px 10px",
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              background: colors.panel,
            }}
          >
            {TYPE_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "grid", gap: spacing.sm, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: textTokens.muted }}>Resource type</span>
            <Input value={resourceType} onChange={(e) => setResourceType(e.target.value)} placeholder="maintenance" />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: textTokens.muted }}>Resource ID</span>
            <Input value={resourceId} onChange={(e) => setResourceId(e.target.value)} placeholder="maint-123" />
          </label>
        </div>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ color: textTokens.muted }}>How did it feel overall?</span>
          <select
            value={sentiment}
            onChange={(e) => setSentiment(e.target.value as typeof sentiment)}
            style={{
              padding: "9px 10px",
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              background: colors.panel,
            }}
          >
            {SENTIMENT_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ color: textTokens.muted }}>Optional tags</span>
          <Input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="slow_response, clear_process"
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ color: textTokens.muted }}>Optional notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Share a short summary of your experience."
            style={{
              padding: "10px",
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              background: colors.panel,
              color: textTokens.primary,
              resize: "vertical",
            }}
          />
        </label>

        <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
          <Button onClick={() => void submit()} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit feedback"}
          </Button>
          <Button variant="secondary" onClick={() => navigate("/tenant/activity")}>
            Back to activity
          </Button>
        </div>
      </div>
    </TenantSurfaceShell>
  );
}
