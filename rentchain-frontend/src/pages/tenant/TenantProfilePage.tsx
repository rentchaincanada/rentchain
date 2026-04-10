import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getTenantProfile, updateTenantProfile, type TenantProfileStatus } from "../../api/tenantProfile";
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

export default function TenantProfilePage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getTenantProfile>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState({ displayName: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

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
      setSaveError(err?.payload?.error || err?.message || "Unable to save profile changes.");
    } finally {
      setSaving(false);
    }
  };

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
  const propertyAddress = [
    data?.profile?.property?.street1,
    data?.profile?.property?.street2,
    data?.profile?.property?.city,
    data?.profile?.property?.province,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <TenantSurfaceShell
      title="Tenant Profile"
      subtitle="Review your tenant-safe profile details, identity progress, and the next steps still linked to your tenancy or application."
    >
      <TenantInfoCard heading="Profile Summary" accent="#0f766e">
        <TenantKeyValueGrid
          rows={[
            { label: "Name", value: data?.profile?.displayName || "—" },
            { label: "Email", value: data?.profile?.email || "—" },
            { label: "Phone", value: data?.profile?.phone || "—" },
            { label: "Access", value: data?.profile?.authorityLabel || "Tenant" },
            { label: "Property", value: propertyAddress || "No property linked yet" },
            { label: "Lease status", value: prettyStatus(data?.profile?.lease?.status) },
          ]}
        />
      </TenantInfoCard>

      <TenantInfoCard heading="Edit profile details" accent="#0f766e">
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
            You can update a small tenant-safe set of profile fields here without changing lease, approval, or verification records.
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

        <TenantInfoCard heading="Lease & application" accent="#7c3aed">
          <TenantKeyValueGrid
            rows={[
              { label: "Application", value: prettyStatus(data?.profile?.application?.status) },
              { label: "Lease", value: prettyStatus(data?.profile?.lease?.status) },
              { label: "Rent", value: formatMoney(data?.profile?.lease?.monthlyRent) },
              { label: "Lease start", value: formatDate(data?.profile?.lease?.startDate) },
              { label: "Lease end", value: formatDate(data?.profile?.lease?.endDate) },
              {
                label: "Lease document",
                value: data?.profile?.lease?.documentUrl ? "Available" : "Not shared yet",
              },
            ]}
          />
        </TenantInfoCard>
      </div>

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

      <TenantInfoCard heading="Next steps" accent="#0891b2">
        {data?.identity?.nextSteps?.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {data.identity.nextSteps.map((step) => (
              <div key={step} style={{ color: textTokens.secondary }}>
                {step}
              </div>
            ))}
            <Link to="/tenant/attachments" style={{ fontWeight: 700 }}>
              Review documents
            </Link>
          </div>
        ) : (
          <div style={{ color: textTokens.muted }}>No pending next steps right now.</div>
        )}
      </TenantInfoCard>
    </TenantSurfaceShell>
  );
}
