import React, { useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle2, Clock3, Home, Lock, MailCheck, Receipt, Sparkles } from "lucide-react";
import { apiFetch } from "../../api/apiFetch";
import { Card, Section } from "../../components/ui/Ui";
import { clearTenantToken, getTenantToken } from "../../lib/tenantAuth";
import { colors, radius, shadows, spacing, text as textTokens } from "../../styles/tokens";

type TenantMeResponse = {
  ok: boolean;
  data: {
    tenant: {
      id: string;
      shortId: string;
      name: string | null;
      email: string | null;
      joinedAt: number | null;
      status: "Active";
    };
    landlord: { name: string | null };
    property: { name: string | null };
    unit: { label: string | null };
    lease: {
      status: "Active" | "Pending" | "Unknown";
      startDate: number | null;
      rentCents: number | null;
      currency: string | null;
    };
  };
};

type ActivityItem = {
  id: string;
  type: "invite" | "lease" | "rent" | "notice" | "system";
  title: string;
  description?: string | null;
  occurredAt: number;
};

function fmtMoney(value: number | null | undefined, currency?: string | null): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  const amount = Number(value) / 100;
  try {
    if (currency) {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(amount);
    }
  } catch {
    // fall through to dollar formatting
  }
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtDate(ts: number | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(d);
}

function valueOrDash<T>(val: T | null | undefined): T | string {
  if (val === null || val === undefined || (typeof val === "string" && val.trim() === "")) return "—";
  return val;
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: colors.bgAmbient,
  padding: spacing.xl,
  boxSizing: "border-box",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: spacing.sm,
  marginBottom: spacing.lg,
};

const pillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  background: colors.accentSoft,
  color: colors.accent,
  borderRadius: radius.pill,
  fontWeight: 700,
  fontSize: "0.9rem",
  border: `1px solid ${colors.border}`,
};

const labelStyle: React.CSSProperties = {
  color: textTokens.muted,
  fontSize: "0.85rem",
  letterSpacing: "0.02em",
  textTransform: "uppercase",
};

const valueStyle: React.CSSProperties = {
  fontSize: "1.05rem",
  fontWeight: 700,
  color: textTokens.primary,
};

const checklistItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: radius.md,
  border: `1px solid ${colors.border}`,
  background: colors.panel,
};

const InfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div style={{ display: "grid", gap: 4 }}>
    <div style={labelStyle}>{label}</div>
    <div style={valueStyle}>{value}</div>
  </div>
);

const LeaseStatusBadge: React.FC<{ status: "Active" | "Pending" | "Unknown" }> = ({ status }) => {
  const palette: Record<string, { bg: string; color: string }> = {
    Active: { bg: "rgba(34,197,94,0.12)", color: "#166534" },
    Pending: { bg: "rgba(234,179,8,0.16)", color: "#854d0e" },
    Unknown: { bg: "rgba(148,163,184,0.2)", color: "#475569" },
  };
  const tone = palette[status] || palette.Unknown;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: radius.pill,
        background: tone.bg,
        color: tone.color,
        fontWeight: 700,
        fontSize: "0.9rem",
        border: `1px solid ${colors.border}`,
      }}
    >
      {status}
    </span>
  );
};

const DashboardShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ maxWidth: 1100, margin: "0 auto" }}>{children}</div>
);

export default function TenantDashboardPage() {
  const [data, setData] = useState<TenantMeResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);
  const [hasToken, setHasToken] = useState<boolean>(() =>
    typeof window === "undefined" ? true : !!getTenantToken()
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = getTenantToken();
    if (!token) {
      setHasToken(false);
      const next = encodeURIComponent(window.location.pathname + (window.location.search || ""));
      window.location.replace(`/tenant/login?next=${next}`);
      return;
    }
    setHasToken(true);

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setActivityLoading(true);
      setActivityError(null);
      try {
        const [meRes, activityRes] = await Promise.allSettled([
          apiFetch<TenantMeResponse>("/tenant/me"),
          apiFetch<{ ok: boolean; data: ActivityItem[] }>("/tenant/activity"),
        ]);

        if (!cancelled) {
          if (meRes.status === "fulfilled") {
            setData(meRes.value.data);
          } else {
            const message =
              (meRes.reason as any)?.message ||
              (meRes.reason as any)?.payload?.error ||
              "Unable to load your RentChain account";
            setError(String(message));
          }

          if (activityRes.status === "fulfilled") {
            setActivity(Array.isArray(activityRes.value?.data) ? activityRes.value.data : []);
          } else {
            const message =
              (activityRes.reason as any)?.message ||
              (activityRes.reason as any)?.payload?.error ||
              "Unable to load activity";
            setActivityError(String(message));
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          const message =
            e?.message || e?.payload?.error || "Unable to load your RentChain account";
          setError(String(message));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setActivityLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const profile = data?.tenant;
  const lease = data?.lease;
  const landlord = data?.landlord;
  const property = data?.property;
  const unit = data?.unit;

  const checklist = useMemo(
    () => [
      { label: "Tenant identity (name & email)", status: "tracked" as const },
      { label: "Lease basics (property, unit, rent)", status: "tracked" as const },
      { label: "Ledger timeline", status: "coming" as const },
      { label: "Documents & receipts", status: "coming" as const },
    ],
    []
  );

  if (!hasToken) {
    return null;
  }

  return (
    <div style={pageStyle}>
      <DashboardShell>
        <Section style={{ marginBottom: spacing.md, boxShadow: shadows.soft }}>
          <div style={headerStyle}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: textTokens.primary }}>
                Tenant Dashboard
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: textTokens.muted,
                  fontSize: "0.95rem",
                  flexWrap: "wrap",
                }}
              >
                <span style={pillStyle}>
                  <Lock size={16} /> Read-only
                </span>
                <span>This information is managed by your landlord.</span>
              </div>
            </div>
            {profile?.shortId ? (
              <div style={{ ...labelStyle, textTransform: "none", textAlign: "right" }}>
                Tenant ID • {profile.shortId}
              </div>
            ) : null}
          </div>
        </Section>

        {error ? (
          <Card
            elevated
            style={{
              borderColor: colors.borderStrong,
              background: "#fff7ed",
              color: "#9a3412",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Unable to load your RentChain account</div>
            <div style={{ fontSize: "0.95rem" }}>{error}</div>
            <div style={{ marginTop: spacing.sm }}>
              <button
                type="button"
                onClick={() => {
                  clearTenantToken();
                  if (typeof window !== "undefined") {
                    window.location.href = "/tenant/login";
                  }
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: radius.md,
                  border: `1px solid ${colors.borderStrong}`,
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Return to login
              </button>
            </div>
          </Card>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: spacing.md,
          }}
        >
          <Card elevated>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: spacing.sm }}>
              <div>
                <div style={labelStyle}>Tenant Profile</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 800, color: textTokens.primary }}>
                  {loading ? "Loading..." : valueOrDash(profile?.name)}
                </div>
              </div>
              {!loading && profile ? <LeaseStatusBadge status="Active" /> : null}
            </div>
            <div style={{ display: "grid", gap: spacing.sm }}>
              <InfoRow label="Email" value={loading ? "Loading..." : valueOrDash(profile?.email)} />
              <InfoRow label="Joined" value={loading ? "Loading..." : fmtDate(profile?.joinedAt)} />
              <InfoRow label="Landlord" value={loading ? "Loading..." : valueOrDash(landlord?.name)} />
            </div>
          </Card>

          <Card elevated>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: spacing.sm }}>
              <div>
                <div style={labelStyle}>Lease Snapshot</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 800, color: textTokens.primary }}>
                  {loading ? "Loading lease..." : valueOrDash(property?.name)}
                </div>
              </div>
              {lease && !loading ? <LeaseStatusBadge status={lease.status} /> : null}
            </div>
            <div style={{ display: "grid", gap: spacing.sm }}>
              <InfoRow label="Unit" value={loading ? "Loading..." : valueOrDash(unit?.label)} />
              <InfoRow label="Lease start" value={loading ? "Loading..." : fmtDate(lease?.startDate)} />
              <InfoRow
                label="Monthly rent"
                value={loading ? "Loading..." : fmtMoney(lease?.rentCents, lease?.currency)}
              />
            </div>
          </Card>

          <Card elevated>
            <div style={{ marginBottom: spacing.sm }}>
              <div style={labelStyle}>What RentChain Tracks</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: textTokens.primary }}>
                Secure, read-only records
              </div>
            </div>
            <div style={{ display: "grid", gap: spacing.xs }}>
              {checklist.map((item) => {
                const isTracked = item.status === "tracked";
                return (
                  <div key={item.label} style={checklistItemStyle}>
                    {isTracked ? (
                      <CheckCircle2 size={18} color="#16a34a" />
                    ) : (
                      <Clock3 size={18} color="#ca8a04" />
                    )}
                    <div style={{ display: "grid", gap: 2 }}>
                      <div style={{ fontWeight: 700, color: textTokens.primary }}>{item.label}</div>
                      <div style={{ fontSize: "0.9rem", color: textTokens.muted }}>
                        {isTracked ? "Live and visible in your dashboard." : "Coming later."}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card elevated style={{ gridColumn: "1 / -1" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: spacing.sm }}>
              <div>
                <div style={labelStyle}>Activity Timeline</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 800, color: textTokens.primary }}>
                  Recent account events
                </div>
              </div>
            </div>
            {activityError ? (
              <div style={{ color: colors.danger }}>{activityError}</div>
            ) : activityLoading ? (
              <div style={{ display: "grid", gap: 10 }}>
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                      opacity: 0.8,
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        background: colors.accentSoft,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 10, background: colors.accentSoft, borderRadius: 6, width: "40%" }} />
                      <div
                        style={{
                          height: 8,
                          background: colors.accentSoft,
                          borderRadius: 6,
                          width: "25%",
                          marginTop: 6,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : activity.length === 0 ? (
              <div style={{ color: textTokens.muted }}>No activity yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {activity.map((item) => (
                  <div key={item.id} style={{ display: "flex", gap: 12 }}>
                    <ActivityIcon type={item.type} />
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ fontWeight: 700, color: textTokens.primary }}>{item.title}</div>
                      <div style={{ fontSize: "0.95rem", color: textTokens.muted }}>{fmtDate(item.occurredAt)}</div>
                      {item.description ? (
                        <div style={{ fontSize: "0.95rem", color: textTokens.secondary }}>{item.description}</div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </DashboardShell>
    </div>
  );
}

function ActivityIcon({ type }: { type: ActivityItem["type"] }) {
  const baseStyle: React.CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: 10,
    display: "grid",
    placeItems: "center",
    background: colors.accentSoft,
    color: colors.accent,
  };
  switch (type) {
    case "invite":
      return (
        <span style={baseStyle}>
          <MailCheck size={16} />
        </span>
      );
    case "lease":
      return (
        <span style={baseStyle}>
          <Home size={16} />
        </span>
      );
    case "rent":
      return (
        <span style={baseStyle}>
          <Receipt size={16} />
        </span>
      );
    case "notice":
      return (
        <span style={baseStyle}>
          <Bell size={16} />
        </span>
      );
    case "system":
    default:
      return (
        <span style={baseStyle}>
          <Sparkles size={16} />
        </span>
      );
  }
}
