import { useMemo, useState } from "react";
import { submitTenantIssue, TenantIssuePayload } from "../api/tenantPortalApi";
import { Button, Card, Input } from "../components/ui/Ui";
import { colors, radius, spacing, text } from "../styles/tokens";
import type {
  IssueSeverity,
  MaintenanceIssueType,
  PropertyActionRequest,
} from "../types/models";

const issueTypes: MaintenanceIssueType[] = [
  "no_heat",
  "no_hot_water",
  "water_leak",
  "electrical",
  "snow_ice",
  "lighting",
  "security",
  "noise",
  "other",
];

const severityOptions: IssueSeverity[] = ["low", "medium", "urgent"];
const locations: Array<TenantIssuePayload["location"]> = ["unit", "building"];

const createInitialForm = (): TenantIssuePayload => ({
  propertyId: "",
  unitId: "",
  tenantId: "",
  issueType: issueTypes[0],
  severity: "medium",
  location: "unit",
  description: "",
});

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: radius.md,
  border: `1px solid ${colors.border}`,
  background: colors.card,
  color: text.primary,
  outline: "none",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 120,
  padding: "10px 12px",
  borderRadius: radius.md,
  border: `1px solid ${colors.border}`,
  background: colors.card,
  color: text.primary,
  outline: "none",
  resize: "vertical",
};

export const TenantPortalIssuePage: React.FC = () => {
  const [form, setForm] = useState<TenantIssuePayload>(createInitialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<PropertyActionRequest | null>(null);

  const issueTypeOptions = useMemo(
    () =>
      issueTypes.map((value) => ({
        value,
        label: value.replace(/_/g, " "),
      })),
    []
  );

  const handleChange = (
    key: keyof TenantIssuePayload,
    value: string
  ): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (
      !form.propertyId ||
      !form.issueType ||
      !form.severity ||
      !form.location ||
      !form.description
    ) {
      setError("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await submitTenantIssue(form);
      setSuccess(created);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to submit issue";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: colors.bg,
        backgroundImage: colors.bgAmbient,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.xl,
      }}
    >
      <Card
        elevated
        style={{
          width: "100%",
          maxWidth: 720,
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.lg,
              background: colors.accentSoft,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              color: colors.accent,
              letterSpacing: "-0.01em",
            }}
          >
            TP
          </div>
          <div>
            <div style={{ color: text.subtle, fontSize: "0.9rem" }}>
              Tenant Portal
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: "1.6rem",
                letterSpacing: "-0.02em",
                color: text.primary,
              }}
            >
              Submit a Maintenance Issue
            </h1>
          </div>
        </div>

        <p style={{ margin: 0, color: text.muted, lineHeight: 1.5 }}>
          Dev mode requires TENANT_PORTAL_DEV=1 on API. Provide your property ID
          and details so the landlord can triage the request.
        </p>

        {success ? (
          <div
            style={{
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              background: "#ecfdf3",
              color: "#065f46",
              padding: spacing.md,
              display: "flex",
              flexDirection: "column",
              gap: spacing.sm,
            }}
          >
            <div style={{ fontWeight: 700 }}>
              Issue submitted successfully.
            </div>
            <div style={{ fontSize: "0.95rem" }}>
              Reference ID: <strong>{success.id}</strong>
            </div>
            <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
              <a
                href={`/properties?propertyId=${encodeURIComponent(
                  success.propertyId
                )}&actionRequestId=${encodeURIComponent(success.id)}`}
                style={{
                  textDecoration: "none",
                }}
              >
                <Button type="button">Open Properties</Button>
              </a>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setForm((prev) => ({
                    ...createInitialForm(),
                    propertyId: prev.propertyId,
                  }));
                  setSuccess(null);
                }}
              >
                Submit another
              </Button>
            </div>
          </div>
        ) : null}

        {error ? (
          <div
            style={{
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              background: "#fef2f2",
              color: colors.danger,
              padding: spacing.md,
            }}
          >
            {error}
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: spacing.md }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: spacing.md,
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ color: text.subtle }}>Property ID *</span>
              <Input
                value={form.propertyId}
                onChange={(e) => handleChange("propertyId", e.target.value)}
                required
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ color: text.subtle }}>Unit ID (optional)</span>
              <Input
                value={form.unitId}
                onChange={(e) => handleChange("unitId", e.target.value)}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ color: text.subtle }}>
                Tenant ID (optional, dev)
              </span>
              <Input
                value={form.tenantId}
                onChange={(e) => handleChange("tenantId", e.target.value)}
              />
            </label>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: spacing.md,
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ color: text.subtle }}>Issue type *</span>
              <select
                value={form.issueType}
                onChange={(e) =>
                  handleChange("issueType", e.target.value as MaintenanceIssueType)
                }
                style={selectStyle}
                required
              >
                {issueTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ color: text.subtle }}>Severity *</span>
              <select
                value={form.severity}
                onChange={(e) =>
                  handleChange("severity", e.target.value as IssueSeverity)
                }
                style={selectStyle}
                required
              >
                {severityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ color: text.subtle }}>Location *</span>
              <select
                value={form.location}
                onChange={(e) =>
                  handleChange(
                    "location",
                    e.target.value as TenantIssuePayload["location"]
                  )
                }
                style={selectStyle}
                required
              >
                {locations.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: text.subtle }}>Description *</span>
            <textarea
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              style={textareaStyle}
              required
            />
          </label>

          <div style={{ display: "flex", gap: spacing.sm, alignItems: "center" }}>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit issue"}
            </Button>
            <span style={{ color: text.muted, fontSize: "0.9rem" }}>
              This page does not require login while in dev mode.
            </span>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default TenantPortalIssuePage;
