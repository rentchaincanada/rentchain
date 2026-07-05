import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getTenantProfile, updateTenantProfile, type TenantProfileStatus } from "../../api/tenantProfile";
import { getTenantAttachments } from "../../api/tenantAttachmentsApi";
import { getTenantWorkspace } from "../../api/tenantPortal";
import {
  TenantEmptyState,
  TenantErrorState,
  TenantInfoCard,
  TenantKeyValueGrid,
  TenantLoadingState,
  TenantSurfaceShell,
  TenantUnauthorizedState,
  formatDate,
  formatMoney,
  prettyStatus,
} from "./TenantWorkspaceShared";
import { spacing, text as textTokens } from "../../styles/tokens";
import TenantProfileCompletionCard from "./TenantProfileCompletionCard";
import { buildTenantProfileCompletion } from "./tenantProfileCompletion";
import { buildTenantDocumentVaultView } from "./tenantDocumentVault";

function statusTone(status: TenantProfileStatus): { label: string; color: string; background: string } {
  switch (status) {
    case "verified":
      return { label: "Verified", color: "#166534", background: "#dcfce7" };
    case "pending":
      return { label: "Pending", color: "#1d4ed8", background: "#dbeafe" };
    case "needs_review":
      return { label: "Needs review", color: "#9a3412", background: "#ffedd5" };
    default:
      return { label: "Missing", color: "#991b1b", background: "#fee2e2" };
  }
}

function isLikelyRawId(value: string | null): boolean {
  return Boolean(value && /^[A-Za-z0-9_-]{12,}$/.test(value));
}

function cleanProfileDisplayValue(value: string | null | undefined): string | null {
  const next = String(value || "").trim();
  if (!next || isLikelyRawId(next)) return null;
  return next;
}

function buildProfilePropertyDisplay(property: Awaited<ReturnType<typeof getTenantProfile>>["profile"]["property"], unitLabel?: string | null) {
  if (!property) return "";
  const street = cleanProfileDisplayValue(property.street1);
  const unit =
    cleanProfileDisplayValue(unitLabel) ||
    cleanProfileDisplayValue(property.unitNumber) ||
    cleanProfileDisplayValue(String(property.unitDisplayLabel || "").replace(/^unit\s+/i, ""));
  const city = cleanProfileDisplayValue(property.city);
  const province = cleanProfileDisplayValue(property.province);
  const postalCode = cleanProfileDisplayValue(property.postalCode);
  const locality = [city, [province, postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [street, unit ? `Unit ${unit}` : cleanProfileDisplayValue(property.street2), locality]
    .filter(Boolean)
    .join(" · ");
}

function firstSafeValue(...values: Array<unknown>) {
  for (const value of values) {
    const next = cleanProfileDisplayValue(String(value || ""));
    if (next) return next;
  }
  return null;
}

function hasTenantSafeDocumentUrl(lease: any) {
  const contextUrl = String(lease?.leaseDocumentContext?.documentUrl || "").trim();
  const documentUrl = String(lease?.documentUrl || "").trim();
  return Boolean(contextUrl || documentUrl);
}

function buildRentalDocumentSummary(lease: any) {
  const context = lease?.leaseDocumentContext || null;
  const contextStatus = String(context?.documentStatus || "").trim();
  const providerSigned = String(lease?.providerSigningStatus || "").trim() === "signed";
  const hasDocumentUrl = hasTenantSafeDocumentUrl(lease);
  const displayLabel = String(context?.displayLabel || lease?.leasePdfLabel || "").trim();

  if (providerSigned && !hasDocumentUrl) {
    return {
      label: "Signed copy pending",
      detail: "Signing is complete, but no tenant-safe signed lease document link is available yet.",
    };
  }

  if (contextStatus === "signed" || (providerSigned && hasDocumentUrl)) {
    return {
      label: displayLabel || "Signed document ready",
      detail: "A tenant-safe signed lease document is available in your workspace.",
    };
  }

  if (contextStatus === "generated" || hasDocumentUrl) {
    return {
      label: displayLabel || "Lease document available",
      detail: "A tenant-safe lease document is available. Signing or final execution may still be tracked separately.",
    };
  }

  if (contextStatus === "pending") {
    return {
      label: displayLabel || "Lease document pending",
      detail: "A lease document workflow is visible, but the tenant-safe document link is not ready yet.",
    };
  }

  return {
    label: displayLabel || "No lease document available yet",
    detail: "No tenant-safe lease document link is available in this profile yet.",
  };
}

function buildRentalSigningSummary(lease: any) {
  const execution = lease?.leaseExecution || null;
  const providerSigningStatus = String(lease?.providerSigningStatus || "not_started").trim();
  const providerSigned = providerSigningStatus === "signed";
  const documentSummary = buildRentalDocumentSummary(lease);

  if (providerSigned && documentSummary.label === "Signed copy pending") {
    return {
      label: "Lease signature complete",
      detail: "Provider-backed signing is complete. The signed copy is still being prepared for this tenant workspace.",
    };
  }

  if (providerSigned) {
    return {
      label: "Lease signature complete",
      detail: hasTenantSafeDocumentUrl(lease)
        ? "Provider-backed signing is complete and a tenant-safe signed copy is available."
        : "Provider-backed signing is complete.",
    };
  }

  if (execution?.executionLabel) {
    return {
      label: execution.executionLabel,
      detail: execution.executionDescription || "Lease execution status is available from your tenant-safe lease workspace.",
    };
  }

  if (lease?.signatureReadinessLabel) {
    return {
      label: lease.signatureReadinessLabel,
      detail: lease.signatureReadinessDescription || "Lease signing details are not available in this workspace yet.",
    };
  }

  return {
    label: "Lease signing not started",
    detail: "No tenant-safe signature workflow or execution evidence is available yet.",
  };
}

function buildRentalPaymentSummary(lease: any) {
  const readiness = lease?.paymentReadiness || null;
  const paymentSummary = lease?.rentPaymentSummary || null;
  const paymentRailEnabled = paymentSummary?.paymentRail?.enabled === true;
  const readinessStatus = String(readiness?.readinessStatus || "").trim();
  const checkoutAvailable = paymentRailEnabled && readinessStatus === "ready_to_configure";

  if (checkoutAvailable) {
    return {
      label: "Rent collection enabled",
      detail: "Tenant checkout is available when a rent payment is due.",
      checkout: "Checkout available",
    };
  }

  if (paymentRailEnabled) {
    return {
      label: "Rent collection enabled",
      detail: "Rent collection is enabled. Payment availability follows the current lease payment status.",
      checkout: "Checkout status depends on payment state",
    };
  }

  if (readiness) {
    return {
      label: readiness.readinessLabel || "Payment setup needs review",
      detail: readiness.readinessDescription || "Lease payment setup details still need review before checkout can start.",
      checkout: "Checkout unavailable",
    };
  }

  return {
    label: "Payment setup not ready",
    detail: "Payment readiness will appear here when your current lease exposes enough rent-term detail.",
    checkout: "Checkout unavailable",
  };
}

export default function TenantProfilePage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getTenantProfile>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState({ displayName: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Awaited<ReturnType<typeof getTenantAttachments>> | null>(null);
  const [workspace, setWorkspace] = useState<Awaited<ReturnType<typeof getTenantWorkspace>> | null>(null);
  const displayNameRef = React.useRef<HTMLInputElement | null>(null);
  const phoneRef = React.useRef<HTMLInputElement | null>(null);
  const rentalRecordRef = React.useRef<HTMLDivElement | null>(null);
  const identityStatusRef = React.useRef<HTMLDivElement | null>(null);
  const documentChecklistRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getTenantProfile();
        if (!cancelled) {
          setData(res);
          setFormValues({
            displayName: res?.profile?.displayName || "",
            phone: res?.profile?.phone || "",
          });
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Unable to load profile information.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadAttachments = async () => {
      try {
        const next = await getTenantAttachments();
        if (!cancelled) setAttachments(next);
      } catch {
        if (!cancelled) setAttachments(null);
      }
    };
    void loadAttachments();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadWorkspace = async () => {
      try {
        const next = await getTenantWorkspace();
        if (!cancelled) setWorkspace(next);
      } catch {
        if (!cancelled) setWorkspace(null);
      }
    };
    void loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange =
    (field: "displayName" | "phone") => (event: React.ChangeEvent<HTMLInputElement>) => {
      setSaveError(null);
      setSaveMessage(null);
      setFormValues((current) => ({ ...current, [field]: event.target.value }));
    };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const next = await updateTenantProfile({
        displayName: formValues.displayName,
        phone: formValues.phone,
      });
      setData(next);
      setFormValues({
        displayName: next?.profile?.displayName || "",
        phone: next?.profile?.phone || "",
      });
      setSaveMessage("Profile details updated.");
    } catch (err: any) {
      const code = String(err?.payload?.error || err?.message || "").trim().toUpperCase();
      if (code === "TENANT_PROFILE_FIELDS_REQUIRED") {
        setSaveError("Add at least one profile detail before saving.");
      } else {
        setSaveError(err?.payload?.error || err?.message || "Unable to save profile changes.");
      }
    } finally {
      setSaving(false);
    }
  };

  const completion = data ? buildTenantProfileCompletion(data) : null;
  const firstIncompleteCompletionKey =
    completion?.sections.flatMap((section) => section.items).find((item) => item.status !== "complete")?.key || null;
  const focusMissingEditableField = React.useCallback(() => {
    const focusTarget = (target: HTMLElement | null) => {
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.focus();
    };

    switch (firstIncompleteCompletionKey) {
      case "phone":
        focusTarget(phoneRef.current);
        return;
      case "display_name":
        focusTarget(displayNameRef.current);
        return;
      case "property_summary":
      case "application_or_lease":
        focusTarget(rentalRecordRef.current);
        return;
      case "identity_verification":
        focusTarget(identityStatusRef.current);
        return;
      case "document_checklist":
        focusTarget(documentChecklistRef.current);
        return;
      default:
        focusTarget(phoneRef.current || displayNameRef.current);
    }
  }, [firstIncompleteCompletionKey]);

  if (loading) {
    return (
      <TenantSurfaceShell
        title="Tenant Profile"
        subtitle="Your profile and identity checklist are shown from tenant-safe projections only."
      >
        <TenantLoadingState label="Loading your profile and identity status..." />
      </TenantSurfaceShell>
    );
  }

  if (error) {
    const unauthorized = /unauthorized|forbidden|ambiguous/i.test(error);
    return (
      <TenantSurfaceShell
        title="Tenant Profile"
        subtitle="This page reflects your tenancy context, profile basics, and document visibility."
      >
        {unauthorized ? <TenantUnauthorizedState /> : <TenantErrorState message={error} />}
      </TenantSurfaceShell>
    );
  }

  const identityTone = statusTone(data?.identity?.overallStatus || "missing");
  const verificationTone = statusTone(data?.identity?.identityVerification?.status || "missing");
  const documentEntry = data?.actions?.documentEntry;
  const propertyDisplay = buildProfilePropertyDisplay(
    data?.profile?.property || workspace?.property || null,
    data?.profile?.unit?.label || workspace?.unit?.label
  );
  const applicationSignals = [
    ...(data?.profile?.application?.missingSteps || []),
    ...(data?.profile?.application?.nextActions || []),
  ]
    .join(" ")
    .toLowerCase();
  const hasEmploymentSignal =
    /employment|employer|income|paystub|salary|proof of income/.test(applicationSignals);
  const documentVault = buildTenantDocumentVaultView({
    items: attachments?.data || [],
    summary: attachments?.summary,
    guidance: attachments?.guidance,
    updatedAt: attachments?.updatedAt,
    access: null,
  });
  const profileLease = (data?.profile?.lease || null) as any;
  const workspaceLease = (workspace?.lease || null) as any;
  const rentalLease = workspaceLease ? { ...(profileLease || {}), ...workspaceLease } : profileLease;
  const rentalDocumentSummary = buildRentalDocumentSummary(rentalLease);
  const rentalSigningSummary = buildRentalSigningSummary(rentalLease);
  const rentalPaymentSummary = buildRentalPaymentSummary(rentalLease);
  const leaseTermStart = formatDate(rentalLease?.startDate);
  const leaseTermEnd = formatDate(rentalLease?.endDate);
  const leaseTerm =
    leaseTermStart !== "—" || leaseTermEnd !== "—" ? `${leaseTermStart} to ${leaseTermEnd}` : "Lease dates not provided";
  const rentalPropertySummary = propertyDisplay || firstSafeValue(workspace?.unit?.label ? `Unit ${workspace.unit.label}` : null) || "No property linked yet";

  return (
    <TenantSurfaceShell
      title="Tenant Profile"
      subtitle="This is your organized rental profile space. Review what is already connected, what is still missing, and what you can update right now."
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: spacing.md,
        }}
      >
        <TenantInfoCard heading="Your profile" accent="#0f766e">
          <TenantKeyValueGrid
            rows={[
              { label: "Name", value: data?.profile?.displayName || "—" },
              { label: "Email", value: data?.profile?.email || "—" },
              { label: "Phone", value: data?.profile?.phone || "—" },
              { label: "Access", value: data?.profile?.authorityLabel || "Tenant" },
              { label: "Property", value: propertyDisplay || "No property linked yet" },
              { label: "Lease status", value: prettyStatus(data?.profile?.lease?.status) },
            ]}
          />
        </TenantInfoCard>
        {completion ? (
          <TenantProfileCompletionCard
            completion={completion}
            actionLabel="Update missing details"
            actionPath={null}
            onAction={focusMissingEditableField}
          />
        ) : null}
      </div>

      <TenantInfoCard heading="Contact details" accent="#0f766e">
        <form onSubmit={handleSave} style={{ display: "grid", gap: spacing.sm }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: spacing.sm,
            }}
          >
            <label style={{ display: "grid", gap: 6, color: textTokens.secondary }}>
              <span style={{ fontWeight: 700, color: textTokens.primary }}>Display name</span>
              <input
                name="displayName"
                value={formValues.displayName}
                onChange={handleChange("displayName")}
                maxLength={120}
                ref={displayNameRef}
                style={{
                  border: "1px solid rgba(15,23,42,0.12)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  font: "inherit",
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 6, color: textTokens.secondary }}>
              <span style={{ fontWeight: 700, color: textTokens.primary }}>Phone</span>
              <input
                name="phone"
                value={formValues.phone}
                onChange={handleChange("phone")}
                maxLength={40}
                ref={phoneRef}
                style={{
                  border: "1px solid rgba(15,23,42,0.12)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  font: "inherit",
                }}
              />
            </label>
          </div>

          <div style={{ color: textTokens.muted }}>
            Keep your rental profile organized by keeping your contact details current. Updating these fields will not change lease, approval, or verification records.
          </div>

          {saveError ? <div style={{ color: "#b91c1c", fontWeight: 600 }}>{saveError}</div> : null}
          {saveMessage ? <div style={{ color: "#166534", fontWeight: 600 }}>{saveMessage}</div> : null}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.12)",
                background: "#0f766e",
                color: "#fff",
                fontWeight: 700,
                cursor: saving ? "wait" : "pointer",
              }}
            >
              {saving ? "Saving..." : "Save profile changes"}
            </button>
            {documentEntry?.available && documentEntry?.path ? (
              <Link
                to={documentEntry.path}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "10px 14px",
                  borderRadius: 10,
                  textDecoration: "none",
                  fontWeight: 700,
                  border: "1px solid rgba(15,23,42,0.12)",
                  color: textTokens.primary,
                }}
              >
                {documentEntry.label}
              </Link>
            ) : null}
          </div>
        </form>
      </TenantInfoCard>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: spacing.md,
        }}
      >
        <div ref={rentalRecordRef} tabIndex={-1} style={{ outline: "none" }}>
        <TenantInfoCard heading="Rental record" accent="#7c3aed">
          <div style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: "1.05rem", fontWeight: 800, color: textTokens.primary }}>
                Current rental record
              </div>
              <div style={{ color: textTokens.secondary, lineHeight: 1.6 }}>
                This profile reflects tenant-safe lease, document, signing, and rent setup details from your current workspace.
              </div>
            </div>

          <TenantKeyValueGrid
            rows={[
              { label: "Application", value: prettyStatus(data?.profile?.application?.status) },
              { label: "Lease", value: prettyStatus(rentalLease?.status) },
              { label: "Property / unit", value: rentalPropertySummary },
              { label: "Rent", value: formatMoney(rentalLease?.monthlyRent) },
              { label: "Lease term", value: leaseTerm },
            ]}
          />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                gap: spacing.sm,
              }}
            >
              {[
                {
                  title: "Lease document",
                  label: rentalDocumentSummary.label,
                  detail: rentalDocumentSummary.detail,
                },
                {
                  title: "Signing / execution",
                  label: rentalSigningSummary.label,
                  detail: rentalSigningSummary.detail,
                },
                {
                  title: "Rent payments",
                  label: rentalPaymentSummary.label,
                  detail: `${rentalPaymentSummary.detail} ${rentalPaymentSummary.checkout}.`,
                },
              ].map((item) => (
                <div
                  key={item.title}
                  style={{
                    border: "1px solid rgba(15,23,42,0.08)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    display: "grid",
                    gap: 6,
                    minWidth: 0,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800, color: textTokens.muted, textTransform: "uppercase" }}>
                    {item.title}
                  </div>
                  <div style={{ fontWeight: 800, color: textTokens.primary }}>{item.label}</div>
                  <div style={{ color: textTokens.secondary, lineHeight: 1.5 }}>{item.detail}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link to="/tenant/lease" style={{ fontWeight: 700 }}>
                Open lease details
              </Link>
              <Link to="/tenant/payments" style={{ fontWeight: 700 }}>
                Review payments
              </Link>
              <Link to="/tenant/attachments" style={{ fontWeight: 700 }}>
                Open documents
              </Link>
            </div>

            <div style={{ color: textTokens.muted }}>
              Longer rental history can be added over time as more tenant-safe records are linked.
            </div>
          </div>
        </TenantInfoCard>
        </div>

        <div ref={identityStatusRef} tabIndex={-1} style={{ outline: "none" }}>
        <TenantInfoCard heading="Identity status" accent="#1d4ed8">
          <div style={{ display: "grid", gap: spacing.sm }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "fit-content",
                padding: "6px 10px",
                borderRadius: 999,
                fontWeight: 700,
                color: identityTone.color,
                background: identityTone.background,
              }}
            >
              {identityTone.label}
            </div>
            <div style={{ color: textTokens.secondary }}>
              Verification: <strong>{verificationTone.label}</strong>
            </div>
            <div style={{ color: textTokens.secondary }}>
              {data?.identity?.identityVerification?.note || "Open next steps below if anything is still pending."}
            </div>
            <div style={{ color: textTokens.muted }}>
              Updated: {formatDate(data?.identity?.identityVerification?.updatedAt)}
            </div>
          </div>
        </TenantInfoCard>
        </div>

        <TenantInfoCard heading="Employment and income" accent="#0891b2">
          <div style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ color: textTokens.secondary }}>
              {hasEmploymentSignal
                ? "Your current application checklist still points to employment or income details that need attention."
                : "Employment and income details are not surfaced in this tenant-safe profile summary yet."}
            </div>
            <div style={{ color: textTokens.muted }}>
              {hasEmploymentSignal
                ? "Use your application checklist to see the next supported step."
                : "When employment or income details are linked to your tenant-safe application flow, they will appear here in a clearer profile summary."}
            </div>
            <div>
              <Link to="/tenant/application" style={{ fontWeight: 700 }}>
                {hasEmploymentSignal ? "Open application checklist" : "View application progress"}
              </Link>
            </div>
          </div>
        </TenantInfoCard>
      </div>

      <TenantInfoCard heading="Document Vault" accent="#b45309">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: spacing.sm,
          }}
        >
          {documentVault.metrics.slice(0, 3).map((metric) => (
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
              <div style={{ fontSize: "1.4rem", fontWeight: 900, color: metric.accent }}>{metric.value}</div>
              <div style={{ color: textTokens.secondary, fontWeight: 700 }}>{metric.label}</div>
            </div>
          ))}
        </div>
        <div style={{ color: textTokens.secondary }}>
          {attachments?.guidance?.headline || "Add documents to your profile and keep them organized here."}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link to="/tenant/attachments" style={{ fontWeight: 700 }}>
            Open document vault
          </Link>
          <Link to="/tenant/access" style={{ fontWeight: 700 }}>
            Review sharing
          </Link>
        </div>
      </TenantInfoCard>

      <div ref={documentChecklistRef} tabIndex={-1} style={{ outline: "none" }}>
      <TenantInfoCard heading="Document checklist" accent="#b45309">
        {documentEntry?.note ? <div style={{ color: textTokens.secondary }}>{documentEntry.note}</div> : null}
        {data?.identity?.documentChecklist?.length ? (
          <div style={{ display: "grid", gap: spacing.sm }}>
            {data.identity.documentChecklist.map((item) => {
              const tone = statusTone(item.status);
              return (
                <div
                  key={item.code}
                  style={{
                    display: "grid",
                    gap: 6,
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
                  {item.nextStep ? <div style={{ color: textTokens.secondary }}>{item.nextStep}</div> : null}
                  {documentEntry?.available && documentEntry?.path ? (
                    <div>
                      <Link to={documentEntry.path} style={{ fontWeight: 700 }}>
                        {documentEntry.label}
                      </Link>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <TenantEmptyState
            title="No document checklist yet"
            body="When documents or identity steps are linked to your application or lease, they will appear here in a tenant-safe format."
          />
        )}
      </TenantInfoCard>
      </div>

      <TenantInfoCard heading="Next steps" accent="#0891b2">
        {data?.identity?.nextSteps?.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {data.identity.nextSteps.map((step) => (
              <div key={step} style={{ color: textTokens.secondary }}>
                {step}
              </div>
            ))}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link to="/tenant/attachments" style={{ fontWeight: 700 }}>
                Review documents
              </Link>
              <Link to="/tenant/application" style={{ fontWeight: 700 }}>
                Open application checklist
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ color: textTokens.muted }}>No pending next steps right now. Keep your profile organized and check back here when new steps appear.</div>
        )}
      </TenantInfoCard>
    </TenantSurfaceShell>
  );
}
