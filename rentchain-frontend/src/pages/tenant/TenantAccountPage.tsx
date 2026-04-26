import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { tenantApiFetch } from "../../api/tenantApiFetch";
import {
  getTenantNotificationPreferences,
  updateTenantNotificationPreferences,
  type TenantNotificationPreferences,
} from "../../api/tenantNotificationPreferences";
import { Card } from "../../components/ui/Ui";
import { logoutTenant } from "../../lib/logoutTenant";
import { colors, spacing, text as textTokens } from "../../styles/tokens";
import {
  DEFAULT_NOTIFICATION_CHANNEL_PREFERENCES,
  NOTIFICATION_PREFERENCE_CATEGORIES,
  normalizeNotificationChannelPreferences,
} from "../notificationChannelRouting";

type TenantMeResponse = {
  ok: boolean;
  data?: {
    tenant?: {
      shortId?: string | null;
      email?: string | null;
    };
  };
};

function valueOrDash(value?: string | null): string {
  const trimmed = String(value || "").trim();
  return trimmed || "—";
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 700,
  color: textTokens.primary,
  marginBottom: spacing.xs,
};

export default function TenantAccountPage() {
  const [data, setData] = useState<TenantMeResponse["data"] | null>(null);
  const [preferences, setPreferences] = useState<TenantNotificationPreferences | null>(null);
  const [draftPreferences, setDraftPreferences] = useState(DEFAULT_NOTIFICATION_CHANNEL_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await tenantApiFetch<TenantMeResponse>("/tenant/me");
        if (!cancelled) setData(res?.data || null);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Unable to load account details.");
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
    const loadPreferences = async () => {
      setPreferencesLoading(true);
      setPreferencesError(null);
      try {
        const next = await getTenantNotificationPreferences();
        if (!cancelled) {
          setPreferences(next);
          setDraftPreferences(normalizeNotificationChannelPreferences(next));
        }
      } catch (err: any) {
        if (!cancelled) {
          setPreferences(null);
          setDraftPreferences(normalizeNotificationChannelPreferences(null));
          setPreferencesError(err?.message || "Unable to load notification preferences.");
        }
      } finally {
        if (!cancelled) {
          setPreferencesLoading(false);
        }
      }
    };
    void loadPreferences();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasPreferenceChanges = JSON.stringify(draftPreferences) !== JSON.stringify(normalizeNotificationChannelPreferences(preferences));

  async function savePreferences() {
    setSaveState("saving");
    setPreferencesError(null);
    try {
      const next = await updateTenantNotificationPreferences({ inApp: draftPreferences.inApp });
      setPreferences(next);
      setDraftPreferences(normalizeNotificationChannelPreferences(next));
      setSaveState("saved");
    } catch (err: any) {
      setSaveState("error");
      setPreferencesError(err?.message || "Unable to save notification preferences.");
    }
  }

  return (
    <Card elevated style={{ padding: spacing.lg, display: "grid", gap: spacing.md }}>
      <div>
        <h1 style={{ margin: 0, color: textTokens.primary, fontSize: "1.4rem" }}>Account</h1>
        <div style={{ marginTop: 6, color: textTokens.muted }}>
          Manage your tenant account and security actions.
        </div>
      </div>

      {error ? <div style={{ color: colors.danger }}>{error}</div> : null}
      {loading ? <div style={{ color: textTokens.muted }}>Loading account…</div> : null}

      {!loading ? (
        <>
          <section>
            <div style={sectionTitleStyle}>Account</div>
            <div style={{ color: textTokens.muted, marginBottom: 4 }}>Email</div>
            <div style={{ color: textTokens.primary, fontWeight: 600, marginBottom: 10 }}>
              {valueOrDash(data?.tenant?.email)}
            </div>
            <div style={{ color: textTokens.muted, marginBottom: 4 }}>Account ID</div>
            <div style={{ color: textTokens.primary, fontWeight: 600, marginBottom: 10 }}>
              {valueOrDash(data?.tenant?.shortId)}
            </div>
            <div style={{ color: textTokens.muted, marginBottom: 4 }}>Tenant Role</div>
            <div style={{ color: textTokens.primary, fontWeight: 600 }}>tenant</div>
          </section>

          <section>
            <div style={sectionTitleStyle}>Security</div>
            <Link
              to="/forgot-password"
              style={{
                display: "inline-flex",
                textDecoration: "none",
                padding: "8px 12px",
                borderRadius: 10,
                border: `1px solid ${colors.border}`,
                background: colors.panel,
                color: textTokens.primary,
                fontWeight: 600,
              }}
            >
              Change password
            </Link>
          </section>

          <section>
            <div style={sectionTitleStyle}>Session</div>
            <button
              type="button"
              onClick={() => logoutTenant("/tenant/login")}
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                background: colors.card,
                color: textTokens.primary,
                padding: "8px 12px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Logout
            </button>
          </section>

          <section>
            <div style={sectionTitleStyle}>Notification preferences</div>
            <div style={{ color: textTokens.muted, marginBottom: spacing.sm }}>
              Choose which important workflow updates should appear in your in-app notification views.
            </div>
            <div
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                padding: spacing.md,
                display: "grid",
                gap: spacing.sm,
                background: colors.panel,
              }}
            >
              <div style={{ color: textTokens.muted }}>
                Supported channels: <strong style={{ color: textTokens.primary }}>In-app notifications</strong>
              </div>
              <div style={{ color: textTokens.muted }}>
                Email updates are not enabled in this workspace yet, so this version only shows channels that currently exist.
              </div>
              {preferencesError ? <div style={{ color: colors.danger }}>{preferencesError}</div> : null}
              {preferencesLoading ? (
                <div style={{ color: textTokens.muted }}>Loading notification preferences…</div>
              ) : (
                <>
                  {NOTIFICATION_PREFERENCE_CATEGORIES.map((item) => (
                    <label
                      key={item.key}
                      style={{
                        display: "grid",
                        gap: 4,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 12,
                        padding: spacing.sm,
                        background: colors.card,
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <input
                          type="checkbox"
                          checked={draftPreferences.inApp[item.key]}
                          onChange={(event) => {
                            setDraftPreferences((current) => ({
                              inApp: {
                                ...current.inApp,
                                [item.key]: event.target.checked,
                              },
                            }));
                            setSaveState("idle");
                          }}
                        />
                        <span style={{ fontWeight: 700, color: textTokens.primary }}>{item.label}</span>
                      </span>
                      <span style={{ color: textTokens.muted, paddingLeft: 30 }}>{item.description}</span>
                    </label>
                  ))}
                  <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => void savePreferences()}
                      disabled={!hasPreferenceChanges || saveState === "saving"}
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 10,
                        background: hasPreferenceChanges ? colors.card : colors.panel,
                        color: textTokens.primary,
                        padding: "8px 12px",
                        cursor: hasPreferenceChanges && saveState !== "saving" ? "pointer" : "default",
                        fontWeight: 600,
                      }}
                    >
                      {saveState === "saving" ? "Saving…" : "Save preferences"}
                    </button>
                    {saveState === "saved" ? (
                      <div style={{ color: "#166534", fontWeight: 600 }}>Preferences saved.</div>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </section>
        </>
      ) : null}
    </Card>
  );
}
