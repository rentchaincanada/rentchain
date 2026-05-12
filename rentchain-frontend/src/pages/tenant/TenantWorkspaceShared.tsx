import React from "react";
import { Link } from "react-router-dom";
import { Card } from "../../components/ui/Ui";
import { colors, radius, spacing, text as textTokens } from "../../styles/tokens";

export function formatDate(value?: string | number | null) {
  if (!value) return "—";
  if (typeof value === "string") {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (dateOnly) {
      const [, year, month, day] = dateOnly;
      return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatMoney(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function prettyStatus(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Unknown";
  return normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function prettyAuthority(value?: string | null) {
  switch (value) {
    case "applicant":
      return "Applicant access";
    case "active_tenant":
      return "Active tenancy";
    case "invite":
      return "Invite-linked access";
    default:
      return "Tenant access";
  }
}

export const TenantSurfaceShell: React.FC<{
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, action, children }) => (
  <div
    style={{
      display: "grid",
      gap: spacing.md,
      maxWidth: 1080,
      margin: "0 auto",
    }}
  >
    <Card elevated style={{ padding: spacing.lg, background: colors.card }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: spacing.md,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: "1.55rem", fontWeight: 800, color: textTokens.primary }}>{title}</div>
          <div style={{ color: textTokens.muted, maxWidth: 620 }}>{subtitle}</div>
        </div>
        {action ? <div>{action}</div> : null}
      </div>
    </Card>
    {children}
  </div>
);

export const TenantStateCard: React.FC<{
  title: string;
  body: string;
  action?: React.ReactNode;
}> = ({ title, body, action }) => (
  <Card elevated style={{ padding: spacing.lg, display: "grid", gap: spacing.sm }}>
    <div style={{ fontSize: "1.1rem", fontWeight: 800, color: textTokens.primary }}>{title}</div>
    <div style={{ color: textTokens.muted, lineHeight: 1.5 }}>{body}</div>
    {action ? <div style={{ marginTop: 4 }}>{action}</div> : null}
  </Card>
);

export const TenantLoadingState: React.FC<{ label?: string }> = ({ label = "Loading your workspace..." }) => (
  <TenantStateCard title="Loading" body={label} />
);

export const TenantErrorState: React.FC<{ message: string; retry?: () => void }> = ({ message, retry }) => (
  <TenantStateCard
    title="We couldn't load this view"
    body={message}
    action={
      retry ? (
        <button
          type="button"
          onClick={retry}
          style={{
            padding: "9px 12px",
            borderRadius: radius.md,
            border: `1px solid ${colors.border}`,
            background: colors.panel,
            color: textTokens.primary,
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Try again
        </button>
      ) : undefined
    }
  />
);

export const TenantUnauthorizedState: React.FC = () => (
  <TenantStateCard
    title="Access unavailable"
    body="Your tenant session does not currently have access to this workspace. Sign in again or contact your landlord if you think this is unexpected."
    action={
      <Link
        to="/tenant/login"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "9px 12px",
          borderRadius: radius.md,
          border: `1px solid ${colors.border}`,
          background: colors.panel,
          color: textTokens.primary,
          textDecoration: "none",
          fontWeight: 700,
        }}
      >
        Tenant login
      </Link>
    }
  />
);

export const TenantEmptyState: React.FC<{
  title: string;
  body: string;
  action?: React.ReactNode;
}> = ({ title, body, action }) => <TenantStateCard title={title} body={body} action={action} />;

export const TenantInfoCard: React.FC<{
  heading: string;
  children: React.ReactNode;
  accent?: string;
}> = ({ heading, children, accent = colors.border }) => (
  <Card
    elevated
    style={{
      padding: spacing.lg,
      display: "grid",
      gap: spacing.sm,
      borderTop: `4px solid ${accent}`,
    }}
  >
    <div style={{ fontSize: "1rem", fontWeight: 800, color: textTokens.primary }}>{heading}</div>
    {children}
  </Card>
);

export const TenantKeyValueGrid: React.FC<{
  rows: Array<{ label: string; value: React.ReactNode }>;
}> = ({ rows }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      gap: spacing.sm,
    }}
  >
    {rows.map((row) => (
      <div
        key={row.label}
        style={{
          border: `1px solid ${colors.border}`,
          borderRadius: radius.md,
          padding: "12px 14px",
          background: colors.panel,
          display: "grid",
          gap: 4,
        }}
      >
        <div style={{ fontSize: "0.8rem", color: textTokens.muted, textTransform: "uppercase", letterSpacing: "0.03em" }}>
          {row.label}
        </div>
        <div style={{ color: textTokens.primary, fontWeight: 700 }}>{row.value}</div>
      </div>
    ))}
  </div>
);
