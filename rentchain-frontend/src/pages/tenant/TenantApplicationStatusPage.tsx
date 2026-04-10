import React from "react";
import { Link } from "react-router-dom";
import {
  getTenantApplicationCompletion,
  type TenantApplicationCompletionItem,
  type TenantApplicationCompletionStatus,
} from "../../api/tenantApplicationCompletion";
import {
  TenantEmptyState,
  TenantErrorState,
  TenantInfoCard,
  TenantLoadingState,
  TenantSurfaceShell,
  TenantUnauthorizedState,
  formatDate,
  prettyStatus,
} from "./TenantWorkspaceShared";
import { spacing, text as textTokens } from "../../styles/tokens";

function statusTone(status: TenantApplicationCompletionStatus) {
  switch (status) {
    case "completed":
    case "verified":
      return { label: status === "verified" ? "Verified" : "Completed", color: "#166534", background: "#dcfce7" };
    case "pending":
      return { label: "Pending", color: "#1d4ed8", background: "#dbeafe" };
    case "needs_review":
      return { label: "Needs review", color: "#9a3412", background: "#ffedd5" };
    case "missing":
      return { label: "Missing", color: "#991b1b", background: "#fee2e2" };
    case "not_started":
      return { label: "Not started", color: "#475569", background: "#e2e8f0" };
    default:
      return { label: "In progress", color: "#0f766e", background: "#ccfbf1" };
  }
}

function sectionSummary(status: TenantApplicationCompletionStatus) {
  if (status === "completed" || status === "verified") return "All key items in this section are complete.";
  if (status === "needs_review") return "At least one item needs attention before your file is fully ready.";
  if (status === "pending") return "This section is moving forward, but some steps are still being processed.";
  if (status === "missing" || status === "not_started") return "You still have steps to finish in this section.";
  return "You’ve started this section, but it still needs a few more updates.";
}

const CompletionProgressCard: React.FC<{ progressPercent: number; status: TenantApplicationCompletionStatus }> = ({
  progressPercent,
  status,
}) => {
  const tone = statusTone(status);
  return (
    <TenantInfoCard heading="Completion Progress" accent="#1d4ed8">
      <div style={{ display: "grid", gap: spacing.sm }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "2.4rem", fontWeight: 900, color: textTokens.primary, lineHeight: 1 }}>
              {progressPercent}%
            </div>
            <div style={{ color: textTokens.secondary }}>Complete based on your tenant-safe application checklist.</div>
          </div>
          <div
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              fontWeight: 700,
              color: tone.color,
              background: tone.background,
            }}
          >
            {tone.label}
          </div>
        </div>
        <div
          style={{
            width: "100%",
            height: 12,
            borderRadius: 999,
            background: "rgba(15,23,42,0.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.max(0, Math.min(progressPercent, 100))}%`,
              height: "100%",
              borderRadius: 999,
              background: "linear-gradient(90deg, #1d4ed8, #0f766e)",
            }}
          />
        </div>
      </div>
    </TenantInfoCard>
  );
};

const CompletionItemRow: React.FC<{ item: TenantApplicationCompletionItem }> = ({ item }) => {
  const tone = statusTone(item.status);
  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        border: "1px solid rgba(15,23,42,0.08)",
        borderRadius: 12,
        padding: "12px 14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, color: textTokens.primary }}>{item.label}</div>
        <div
          style={{
            padding: "4px 8px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            color: tone.color,
            background: tone.background,
          }}
        >
          {tone.label}
        </div>
      </div>
      {item.nextAction ? <div style={{ color: textTokens.secondary }}>{item.nextAction}</div> : null}
      {item.actionPath ? (
        <div>
          <Link to={item.actionPath} style={{ fontWeight: 700 }}>
            Continue this step
          </Link>
        </div>
      ) : null}
    </div>
  );
};

export default function TenantApplicationStatusPage() {
  const [data, setData] = React.useState<Awaited<ReturnType<typeof getTenantApplicationCompletion>>>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getTenantApplicationCompletion());
    } catch (err: any) {
      setData(null);
      setError(err?.payload?.error || err?.message || "Unable to load application completion.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <TenantSurfaceShell
        title="Application Completion"
        subtitle="Follow the guided completion engine to see what’s done, what’s missing, and what needs review."
      >
        <TenantLoadingState label="Loading your application completion checklist..." />
      </TenantSurfaceShell>
    );
  }

  if (error) {
    const unauthorized = /unauthorized|forbidden|ambiguous/i.test(error);
    return (
      <TenantSurfaceShell
        title="Application Completion"
        subtitle="This view only uses tenant-safe application completion signals from your current tenancy or application context."
      >
        {unauthorized ? <TenantUnauthorizedState /> : <TenantErrorState message={error} retry={load} />}
      </TenantSurfaceShell>
    );
  }

  if (!data) {
    return (
      <TenantSurfaceShell
        title="Application Completion"
        subtitle="Follow the guided completion engine to see what’s done, what’s missing, and what needs review."
      >
        <TenantEmptyState
          title="No application checklist yet"
          body="We couldn’t find an active tenant-safe application completion view for this workspace yet."
        />
      </TenantSurfaceShell>
    );
  }

  return (
    <TenantSurfaceShell
      title="Application Completion"
      subtitle="Use this checklist to finish the right steps in the right order so your application moves forward with fewer delays."
      action={
        <Link
          to="/tenant/profile"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "9px 12px",
            borderRadius: 10,
            textDecoration: "none",
            fontWeight: 700,
            border: "1px solid rgba(15,23,42,0.08)",
          }}
        >
          Open profile
        </Link>
      }
    >
      <CompletionProgressCard progressPercent={data.progressPercent} status={data.status} />

      {data.nextSteps.length ? (
        <TenantInfoCard heading="Next Steps" accent="#0891b2">
          <div style={{ display: "grid", gap: 8 }}>
            {data.nextSteps.map((step) => (
              <div key={step} style={{ color: textTokens.secondary }}>
                {step}
              </div>
            ))}
          </div>
        </TenantInfoCard>
      ) : (
        <TenantInfoCard heading="Next Steps" accent="#0891b2">
          <div style={{ color: textTokens.muted }}>
            No extra actions are required right now. Keep an eye on your feed for updates.
          </div>
        </TenantInfoCard>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: spacing.md,
        }}
      >
        {data.sections.map((section) => {
          const tone = statusTone(section.status);
          return (
            <TenantInfoCard key={section.key} heading={section.label} accent={tone.color}>
              <div style={{ display: "grid", gap: spacing.sm }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ color: textTokens.secondary }}>{sectionSummary(section.status)}</div>
                  <div
                    style={{
                      padding: "4px 8px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                      color: tone.color,
                      background: tone.background,
                    }}
                  >
                    {tone.label}
                  </div>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {section.items.map((item) => (
                    <CompletionItemRow key={`${section.key}:${item.key}`} item={item} />
                  ))}
                </div>
              </div>
            </TenantInfoCard>
          );
        })}
      </div>

      <TenantInfoCard heading="Checklist Updated" accent="#7c3aed">
        <div style={{ color: textTokens.secondary }}>
          Last updated: <strong>{formatDate(data.updatedAt)}</strong>
        </div>
        <div style={{ color: textTokens.muted }}>
          Status: <strong>{prettyStatus(data.status)}</strong>
        </div>
      </TenantInfoCard>
    </TenantSurfaceShell>
  );
}
