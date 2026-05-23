import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getTenantAttachments,
  type TenantAttachment,
} from "../../api/tenantAttachmentsApi";
import { getTenantAccess, type TenantAccessWorkspace } from "../../api/tenantAccess";
import { getTenantLeaseWorkspace } from "../../api/tenantPortal";
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
import { buildTenantDocumentVaultView } from "./tenantDocumentVault";
import { mergeTenantAttachments, tenantLeaseWorkspaceAttachments } from "./tenantLeaseDocumentAttachments";

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
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getTenantAttachments>>["summary"]>(undefined);
  const [guidance, setGuidance] = useState<Awaited<ReturnType<typeof getTenantAttachments>>["guidance"]>(undefined);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [access, setAccess] = useState<TenantAccessWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [attachmentsResult, accessResult, leaseWorkspaceResult] = await Promise.allSettled([
          getTenantAttachments(),
          getTenantAccess(),
          getTenantLeaseWorkspace(),
        ]);
        if (attachmentsResult.status !== "fulfilled") {
          throw attachmentsResult.reason;
        }
        const res = attachmentsResult.value;
        if (!cancelled) {
          const leaseWorkspaceItems =
            leaseWorkspaceResult.status === "fulfilled" ? tenantLeaseWorkspaceAttachments(leaseWorkspaceResult.value) : [];
          setItems(sortUrgent(mergeTenantAttachments(Array.isArray(res?.data) ? res.data : [], leaseWorkspaceItems)));
          setSummary(res?.summary);
          setGuidance(res?.guidance);
          setUpdatedAt(typeof res?.updatedAt === "number" ? res.updatedAt : null);
          setAccess(accessResult.status === "fulfilled" ? accessResult.value : null);
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

  const vault = buildTenantDocumentVaultView({
    items,
    summary,
    guidance,
    updatedAt,
    access,
  });

  return (
    <TenantSurfaceShell
      title="Documents"
      subtitle="Keep your documents organized and ready to share. Review what is in your profile, what still needs attention, and what is shared with your permission."
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
      <TenantInfoCard heading="Document Vault Summary" accent="#1d4ed8">
        <div style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ color: textTokens.secondary }}>
            {guidance?.headline || "Add documents to your profile and keep them organized for supported sharing later."}
          </div>
          {vault.metrics.length ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: spacing.sm,
              }}
            >
              {vault.metrics.map((tile) => (
                <div
                  key={tile.label}
                  style={{
                    border: "1px solid rgba(15,23,42,0.08)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <div style={{ color: tile.accent, fontSize: "1.8rem", fontWeight: 900, lineHeight: 1 }}>{tile.value}</div>
                  <div style={{ color: textTokens.secondary, fontWeight: 700 }}>{tile.label}</div>
                  <div style={{ color: textTokens.muted, fontSize: 12 }}>{tile.hint}</div>
                </div>
              ))}
            </div>
          ) : null}
          <div style={{ color: textTokens.muted }}>
            Last updated: <strong>{formatDate(vault.updatedAt)}</strong>
          </div>
        </div>
      </TenantInfoCard>

      <TenantInfoCard heading="Ready To Share" accent="#166534">
        {vault.readyItems.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ color: textTokens.secondary }}>
              {vault.readyItems.length} document{vault.readyItems.length === 1 ? "" : "s"} already live in your profile and available when a supported sharing flow uses them.
            </div>
            {vault.readyItems.slice(0, 3).map((item) => (
              <div key={item.id} style={{ color: textTokens.muted }}>
                <strong>{item.label}</strong>
                {item.fileName ? ` • ${item.fileName}` : ""}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ color: textTokens.secondary }}>
              No documents are marked ready to share yet. Add documents to your profile or finish any follow-up steps below.
            </div>
            <div style={{ color: textTokens.muted }}>
              This vault stays honest about readiness and will only show supported sharing states.
            </div>
          </div>
        )}
      </TenantInfoCard>

      <TenantInfoCard heading="Missing Or Recommended" accent="#b45309">
        {vault.missingItems.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {vault.missingItems.slice(0, 4).map((item) => (
              <div key={item.id} style={{ color: textTokens.secondary }}>
                <strong>{item.label}</strong>
                {item.nextAction ? ` — ${item.nextAction}` : ""}
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
              <Link to="/tenant/application" style={{ fontWeight: 700 }}>
                Open completion checklist
              </Link>
              {guidance?.supportPath && guidance?.supportLabel ? (
                <Link to={guidance.supportPath} style={{ fontWeight: 700 }}>
                  {guidance.supportLabel}
                </Link>
              ) : null}
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ color: textTokens.secondary }}>
              Nothing urgent is missing right now. Keep your profile organized and check back if new document prompts appear.
            </div>
            <div style={{ color: textTokens.muted }}>
              We only surface missing or follow-up items when they are linked to your current tenant-safe workspace.
            </div>
          </div>
        )}
      </TenantInfoCard>

      <TenantInfoCard heading="Sharing Visibility" accent="#0891b2">
        <div style={{ display: "grid", gap: spacing.sm }}>
          {vault.shareInsights.map((item) => {
            const tone =
              item.status === "shared"
                ? { color: "#166534", background: "#dcfce7", label: "Shared" }
                : item.status === "limited"
                ? { color: "#9a3412", background: "#ffedd5", label: "Read-first" }
                : { color: "#475569", background: "#e2e8f0", label: "Unshared" };
            return (
              <div
                key={item.id}
                style={{
                  border: "1px solid rgba(15,23,42,0.08)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 800, color: textTokens.primary }}>{item.label}</div>
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
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link to="/tenant/access" style={{ fontWeight: 700 }}>
              Review sharing
            </Link>
            <div style={{ color: textTokens.muted }}>
              Document-specific share and revoke controls are not supported from this vault yet.
            </div>
          </div>
        </div>
      </TenantInfoCard>

      {items.length === 0 ? (
        <TenantEmptyState
          title="No documents in your vault yet"
          body="When documents are linked to your tenant profile, they will show up here with clear readiness and sharing visibility."
          action={
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link to="/tenant/application" style={{ fontWeight: 700 }}>
                Add documents to your profile
              </Link>
              <Link to="/tenant/messages" style={{ fontWeight: 700 }}>
                Message your landlord
              </Link>
            </div>
          }
        />
      ) : (
        <div style={{ display: "grid", gap: spacing.sm }}>
          {vault.recentItems.length ? (
            <TenantInfoCard heading="Recently Updated" accent="#7c3aed">
              <div style={{ display: "grid", gap: 8 }}>
                {vault.recentItems.map((item) => (
                  <div key={item.id} style={{ color: textTokens.secondary }}>
                    <strong>{item.label}</strong> updated {formatDate(item.uploadedAt || item.createdAt)}
                  </div>
                ))}
              </div>
            </TenantInfoCard>
          ) : null}

          {vault.groupedItems.map((group) => (
            <TenantInfoCard key={group.category} heading={group.category} accent="#0f766e">
              <div style={{ display: "grid", gap: spacing.sm }}>
                {group.items.map((item) => {
                  const tone = statusTone(item.status);
                  return (
                    <div
                      key={item.id}
                      style={{
                        border: "1px solid rgba(15,23,42,0.08)",
                        borderRadius: 12,
                        padding: "12px 14px",
                        display: "grid",
                        gap: 10,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ color: textTokens.secondary }}>
                          <strong style={{ color: textTokens.primary }}>{item.label || "Document"}</strong>
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
                  );
                })}
              </div>
            </TenantInfoCard>
          ))}
        </div>
      )}
    </TenantSurfaceShell>
  );
}
