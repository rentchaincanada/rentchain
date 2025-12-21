import React, { useState } from "react";
import { trackUpgradeIntent } from "../../api/upgradeIntentApi";

export function NotifyMeModal({
  open,
  onClose,
  desiredPlan,
  context,
  defaultEmail,
}: {
  open: boolean;
  onClose: () => void;
  desiredPlan: "core" | "pro" | "elite";
  context: string;
  defaultEmail?: string;
}) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const submit = async () => {
    setSaving(true);
    setErr(null);
    try {
      await trackUpgradeIntent({
        desiredPlan,
        context,
        email: email.trim() || undefined,
      });
      setDone(true);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.45)", zIndex: 120 }}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(520px, 92vw)",
          background: "white",
          borderRadius: 20,
          zIndex: 121,
          boxShadow: "0 30px 80px rgba(2,6,23,0.45)",
        }}
      >
        <div style={{ padding: 24 }}>
          <div style={{ fontWeight: 950, fontSize: 18 }}>
            Get early access to {desiredPlan.toUpperCase()}
          </div>
          <div style={{ marginTop: 8, fontSize: 14, opacity: 0.85 }}>
            We’ll notify you when it’s available — and you’ll get priority onboarding.
          </div>

          {done ? (
            <div
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 14,
                border: "1px solid rgba(59,130,246,0.45)",
                background: "rgba(59,130,246,0.10)",
                color: "#2563eb",
                fontWeight: 850,
              }}
            >
              You’re on the list. We’ll reach out soon.
            </div>
          ) : (
            <>
              <div style={{ marginTop: 16, fontWeight: 900, fontSize: 13 }}>
                Email (optional)
              </div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                style={{
                  marginTop: 6,
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(148,163,184,0.35)",
                  outline: "none",
                  fontWeight: 650,
                }}
              />

              {err ? (
                <div style={{ marginTop: 10, fontSize: 12, color: "#dc2626", fontWeight: 800 }}>
                  {err}
                </div>
              ) : null}

              <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", gap: 10 }}>
                <button
                  onClick={onClose}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(148,163,184,0.35)",
                    background: "transparent",
                    cursor: "pointer",
                    fontWeight: 850,
                  }}
                >
                  Close
                </button>

                <button
                  onClick={submit}
                  disabled={saving}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 12,
                    border: "1px solid rgba(59,130,246,0.45)",
                    background: "rgba(59,130,246,0.12)",
                    color: "#2563eb",
                    cursor: saving ? "not-allowed" : "pointer",
                    fontWeight: 950,
                    opacity: saving ? 0.75 : 1,
                  }}
                >
                  {saving ? "Saving…" : "Notify me"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
