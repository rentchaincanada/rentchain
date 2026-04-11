import React from "react";
import { Link } from "react-router-dom";
import {
  getTenantApplicationCompletion,
  type TenantApplicationCompletionItem,
  type TenantApplicationCompletionStatus,
} from "../../api/tenantApplicationCompletion";
import { getTenantAccess } from "../../api/tenantAccess";
import { getTenantAttachments } from "../../api/tenantAttachmentsApi";
import { getTenantProfile } from "../../api/tenantProfile";
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
import { buildTenantApplicationReuseView } from "./tenantApplicationReuse";

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
            {item.actionLabel || "Continue this step"}
          </Link>
        </div>
      ) : null}
    </div>
  );
};

export default function TenantApplicationStatusPage() {
  const [data, setData] = React.useState<Awaited<ReturnType<typeof getTenantApplicationCompletion>>>(null);
  const [profile, setProfile] = React.useState<Awaited<ReturnType<typeof getTenantProfile>> | null>(null);
  const [attachments, setAttachments] = React.useState<Awaited<ReturnType<typeof getTenantAttachments>> | null>(null);
  const [access, setAccess] = React.useState<Awaited<ReturnType<typeof getTenantAccess>> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [completionResult, profileResult, attachmentsResult, accessResult] = await Promise.allSettled([
        getTenantApplicationCompletion(),
        getTenantProfile(),
        getTenantAttachments(),
        getTenantAccess(),
      ]);
      if (completionResult.status !== "fulfilled") {
        throw completionResult.reason;
      }
      setData(completionResult.value);
      setProfile(profileResult.status === "fulfilled" ? profileResult.value : null);
      setAttachments(attachmentsResult.status === "fulfilled" ? attachmentsResult.value : null);
      setAccess(accessResult.status === "fulfilled" ? accessResult.value : null);
    } catch (err: any) {
      setData(null);
      setProfile(null);
      setAttachments(null);
      setAccess(null);
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

  const reuse = buildTenantApplicationReuseView({
    completion: data,
    profile,
    attachments,
    access,
  });

  return (
    <TenantSurfaceShell
      title="Application Readiness"
      subtitle="Use your saved profile to prepare this application. Review what’s ready to share and add any missing details before you continue."
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
          Review your profile
        </Link>
      }
    >
      <CompletionProgressCard progressPercent={data.progressPercent} status={data.status} />

      <TenantInfoCard heading="Application Readiness Summary" accent="#0f766e">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: spacing.sm,
          }}
        >
          {reuse.metrics.map((metric) => (
            <div
              key={metric.label}
              style={{
                border: "1px solid rgba(15,23,42,0.08)",
                borderRadius: 12,
                padding: "12px 14px",
                display: "grid",
                gap: 4,
              }}
            >
              <div style={{ fontSize: "1.6rem", fontWeight: 900, color: metric.accent }}>{metric.value}</div>
              <div style={{ color: textTokens.secondary, fontWeight: 700 }}>{metric.label}</div>
              <div style={{ color: textTokens.muted, fontSize: 12 }}>{metric.hint}</div>
            </div>
          ))}
        </div>
      </TenantInfoCard>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: spacing.md,
        }}
      >
        <TenantInfoCard heading="Use Your Saved Profile" accent="#1d4ed8">
          <div style={{ display: "grid", gap: spacing.sm }}>
            {reuse.reusableProfileItems.map((item) => {
              const tone =
                item.status === "ready"
                  ? { color: "#166534", background: "#dcfce7", label: "Ready" }
                  : item.status === "info"
                  ? { color: "#1d4ed8", background: "#dbeafe", label: "In review" }
                  : { color: "#9a3412", background: "#ffedd5", label: "Needs attention" };
              return (
                <div
                  key={item.label}
                  style={{
                    border: "1px solid rgba(15,23,42,0.08)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
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
                  <div style={{ color: textTokens.secondary }}>{item.detail}</div>
                  {item.actionPath ? (
                    <Link to={item.actionPath} style={{ fontWeight: 700 }}>
                      {item.actionLabel || "Review"}
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
        </TenantInfoCard>

        <TenantInfoCard heading="Document Readiness" accent="#166534">
          <div style={{ display: "grid", gap: spacing.sm }}>
            {reuse.documentItems.map((item) => {
              const tone =
                item.status === "ready"
                  ? { color: "#166534", background: "#dcfce7", label: "Ready" }
                  : { color: "#9a3412", background: "#ffedd5", label: "Needs attention" };
              return (
                <div
                  key={item.label}
                  style={{
                    border: "1px solid rgba(15,23,42,0.08)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
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
                  <div style={{ color: textTokens.secondary }}>{item.detail}</div>
                  {item.actionPath ? (
                    <Link to={item.actionPath} style={{ fontWeight: 700 }}>
                      {item.actionLabel || "Open documents"}
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
        </TenantInfoCard>
      </div>

      <TenantInfoCard heading="Missing Details" accent="#b45309">
        {reuse.missingItems.length ? (
          <div style={{ display: "grid", gap: spacing.sm }}>
            {reuse.missingItems.slice(0, 8).map((item, index) => (
              <div
                key={`${item.label}-${index}`}
                style={{
                  border: "1px solid rgba(15,23,42,0.08)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ fontWeight: 700, color: textTokens.primary }}>{item.label}</div>
                <div style={{ color: textTokens.secondary }}>{item.detail}</div>
                {item.actionPath ? (
                  <Link to={item.actionPath} style={{ fontWeight: 700 }}>
                    {item.actionLabel || "Review this step"}
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: textTokens.secondary }}>
            No major missing details are surfaced right now. Review the sections below before you continue.
          </div>
        )}
      </TenantInfoCard>

      <TenantInfoCard heading="Review Before Sharing" accent="#0891b2">
        <div style={{ display: "grid", gap: spacing.sm }}>
          {reuse.shareInsights.map((item) => (
            <div key={item.label} style={{ color: textTokens.secondary }}>
              <strong style={{ color: textTokens.primary }}>{item.label}:</strong> {item.detail}
            </div>
          ))}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link to="/tenant/profile" style={{ fontWeight: 700 }}>
              Review your profile
            </Link>
            <Link to="/tenant/attachments" style={{ fontWeight: 700 }}>
              Open documents
            </Link>
            <Link to="/tenant/access" style={{ fontWeight: 700 }}>
              Review access
            </Link>
          </div>
          <div style={{ color: textTokens.muted }}>
            This v1 view does not invent autofill or document-level sharing controls that are not already supported elsewhere in the tenant workspace.
          </div>
        </div>
      </TenantInfoCard>

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
        <div style={{ color: textTokens.muted }}>
          Review what’s ready before continuing so this application feels like a guided reuse flow, not a blank restart.
        </div>
      </TenantInfoCard>
    </TenantSurfaceShell>
  );
}
