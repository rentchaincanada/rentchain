import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getTenantAttachments,
  type TenantAttachment,
  type TenantAttachmentGuidance,
  type TenantAttachmentSummary,
} from "../../api/tenantAttachmentsApi";
import {
  TenantEmptyState,
  TenantErrorState,
  TenantInfoCard,
  TenantLoadingState,
  TenantSurfaceShell,
  TenantUnauthorizedState,
  formatDate,
} from "./TenantWorkspaceShared";
import { spacing, text as textTokens } from "../../styles/tokens";

function statusTone(status?: TenantAttachment["status"]) {
  switch (status) {
    case "verified":
      return { label: "Verified", color: "#166534", background: "#dcfce7" };
    case "pending_review":
      return { label: "Pending review", color: "#1d4ed8", background: "#dbeafe" };
    case "needs_attention":
      return { label: "Needs attention", color: "#9a3412", background: "#ffedd5" };
    case "reupload_requested":
      return { label: "Re-upload requested", color: "#991b1b", background: "#fee2e2" };
    case "missing":
      return { label: "Missing", color: "#991b1b", background: "#fee2e2" };
    default:
      return { label: "Uploaded", color: "#0f766e", background: "#ccfbf1" };
  }
}

function summaryTiles(summary?: TenantAttachmentSummary) {
  if (!summary) return [];
  return [
    { label: "Missing", value: summary.missing, accent: "#991b1b" },
    { label: "Pending review", value: summary.pendingReview, accent: "#1d4ed8" },
    { label: "Needs attention", value: summary.needsAttention, accent: "#9a3412" },
    { label: "Verified", value: summary.verified, accent: "#166534" },
  ];
}

function sortUrgent(items: TenantAttachment[]) {
  const order: Record<string, number> = {
    reupload_requested: 0,
    needs_attention: 1,
    missing: 2,
    pending_review: 3,
    uploaded: 4,
    verified: 5,
  };
  return [...items].sort((a, b) => {
    const left = order[String(a.status || "uploaded")] ?? 99;
    const right = order[String(b.status || "uploaded")] ?? 99;
    if (left !== right) return left - right;
    return Number(b.uploadedAt || b.createdAt || 0) - Number(a.uploadedAt || a.createdAt || 0);
  });
}

export default function TenantAttachmentsPage() {
  const [items, setItems] = useState<TenantAttachment[]>([]);
  const [summary, setSummary] = useState<TenantAttachmentSummary | undefined>(undefined);
  const [guidance, setGuidance] = useState<TenantAttachmentGuidance | undefined>(undefined);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getTenantAttachments();
        if (!cancelled) {
          setItems(Array.isArray(res?.data) ? sortUrgent(res.data) : []);
          setSummary(res?.summary);
          setGuidance(res?.guidance);
          setUpdatedAt(typeof res?.updatedAt === "number" ? res.updatedAt : null);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || err?.payload?.error || "Unable to load documents.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <TenantSurfaceShell
        title="Documents"
        subtitle="Track what you’ve added, what is still missing, and what may need attention for application completion."
      >
        <TenantLoadingState label="Loading your document checklist..." />
      </TenantSurfaceShell>
    );
  }

  if (error) {
    const unauthorized = /unauthorized|forbidden|ambiguous/i.test(error);
    return (
      <TenantSurfaceShell
        title="Documents"
        subtitle="This tenant-safe document workspace only shows records linked to your current application or tenancy context."
      >
        {unauthorized ? <TenantUnauthorizedState /> : <TenantErrorState message={error} />}
      </TenantSurfaceShell>
    );
  }

  const tiles = summaryTiles(summary);

  return (
    <TenantSurfaceShell
      title="Documents"
      subtitle="Use this page to understand which documents are in, which ones are still missing, and what needs attention before your application is fully complete."
      action={
        <Link
          to="/tenant/application"
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
          Back to completion
        </Link>
      }
    >
      <TenantInfoCard heading="Document Summary" accent="#1d4ed8">
        <div style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ color: textTokens.secondary }}>
            {guidance?.headline || "Your tenant-safe document record appears here as documents are requested and shared."}
          </div>
          {tiles.length ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: spacing.sm,
              }}
            >
              {tiles.map((tile) => (
                <div
                  key={tile.label}
                  style={{
                    border: "1px solid rgba(15,23,42,0.08)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    display: "grid",
                    gap: 4,
                  }}
                >
                  <div style={{ color: tile.accent, fontSize: "1.8rem", fontWeight: 900, lineHeight: 1 }}>{tile.value}</div>
                  <div style={{ color: textTokens.secondary, fontWeight: 700 }}>{tile.label}</div>
                </div>
              ))}
            </div>
          ) : null}
          <div style={{ color: textTokens.muted }}>
            Last updated: <strong>{formatDate(updatedAt)}</strong>
          </div>
        </div>
      </TenantInfoCard>

      <TenantInfoCard heading="What To Do Next" accent="#0891b2">
        {guidance?.nextSteps?.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {guidance.nextSteps.map((step) => (
              <div key={step} style={{ color: textTokens.secondary }}>
                {step}
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
              {guidance?.supportPath && guidance?.supportLabel ? (
                <Link to={guidance.supportPath} style={{ fontWeight: 700 }}>
                  {guidance.supportLabel}
                </Link>
              ) : null}
              <Link to="/tenant/profile" style={{ fontWeight: 700 }}>
                Review profile
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ color: textTokens.secondary }}>
              Nothing urgent is blocking you here right now. Keep an eye on this page if new document requests appear.
            </div>
            {guidance?.supportPath && guidance?.supportLabel ? (
              <Link to={guidance.supportPath} style={{ fontWeight: 700 }}>
                {guidance.supportLabel}
              </Link>
            ) : null}
          </div>
        )}
      </TenantInfoCard>

      {items.length === 0 ? (
        <TenantEmptyState
          title="No documents visible yet"
          body="When your application or tenancy asks for documents, they’ll show up here with clear tenant-safe statuses and next steps."
          action={
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link to="/tenant/application" style={{ fontWeight: 700 }}>
                Open completion checklist
              </Link>
              <Link to="/tenant/messages" style={{ fontWeight: 700 }}>
                Message your landlord
              </Link>
            </div>
          }
        />
      ) : (
        <div style={{ display: "grid", gap: spacing.sm }}>
          {items.map((item) => {
            const tone = statusTone(item.status);
            return (
              <TenantInfoCard key={item.id} heading={item.label || "Document"} accent={tone.color}>
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ color: textTokens.secondary }}>
                      {item.category || "Documents"}
                      {item.fileName ? ` • ${item.fileName}` : item.title ? ` • ${item.title}` : ""}
                    </div>
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

                  <div style={{ color: textTokens.secondary }}>
                    {item.nextAction || "No additional action is required right now."}
                  </div>

                  <div style={{ color: textTokens.muted }}>
                    Updated: <strong>{formatDate(item.uploadedAt || item.createdAt)}</strong>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontWeight: 700, textDecoration: "none" }}
                      >
                        Open file
                      </a>
                    ) : null}
                    {item.helpPath && item.helpLabel ? (
                      <Link to={item.helpPath} style={{ fontWeight: 700 }}>
                        {item.helpLabel}
                      </Link>
                    ) : null}
                    {item.status === "missing" || item.status === "reupload_requested" ? (
                      <span style={{ color: textTokens.muted, fontWeight: 700 }}>
                        Direct upload is not available from this page yet
                      </span>
                    ) : null}
                  </div>
                </div>
              </TenantInfoCard>
            );
          })}
        </div>
      )}
    </TenantSurfaceShell>
  );
}
