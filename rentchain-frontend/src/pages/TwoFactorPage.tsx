// @ts-nocheck
import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { trustDevice, verifyTwoFactorCode } from "../api/authApi";
import { MacShell } from "../components/layout/MacShell";
import { colors, spacing, text } from "../styles/tokens";
import { Card, Input, Button } from "../components/ui/Ui";

export const TwoFactorPage: React.FC = () => {
  const {
    twoFactorPendingToken,
    twoFactorMethods,
    completeTwoFactor,
    resetTwoFactor,
  } = useAuth();
  const navigate = useNavigate();

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trustChecked, setTrustChecked] = useState(true);

  if (!twoFactorPendingToken) {
    return <Navigate to="/login" replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const method = twoFactorMethods[0] ?? "totp";
      const response = await verifyTwoFactorCode(
        twoFactorPendingToken,
        method,
        code.trim()
      );

      completeTwoFactor(response.token, response.user);

      if (trustChecked) {
        try {
          const trustResp = await trustDevice(code.trim());
          localStorage.setItem(
            "rentchain_trusted_device",
            trustResp.trustedDeviceToken
          );
        } catch (err: any) {
          setError(err?.message || "Verified, but failed to trust this device.");
          setSubmitting(false);
          return;
        }
      }

      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(err?.message || "Verification failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    resetTwoFactor();
    navigate("/login", { replace: true });
  };

  return (
    <MacShell title="RentChain · Two-factor verification">
      <div
        style={{
          maxWidth: 480,
          margin: "40px auto",
        }}
      >
        <Card elevated>
          <h1
            style={{
              fontSize: "1.3rem",
              fontWeight: 600,
              marginBottom: spacing.xs,
              color: text.primary,
            }}
          >
            Two-factor authentication
          </h1>
          <p
            style={{
              fontSize: "0.95rem",
              color: text.muted,
              marginBottom: spacing.md,
            }}
          >
            Enter the 6-digit code from your authenticator app to finish signing in.
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                marginBottom: 4,
                color: text.muted,
              }}
            >
              6-digit code
            </label>
            <Input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{
                letterSpacing: "0.18em",
                textAlign: "center",
                fontSize: "1.1rem",
              }}
            />

            {error && (
              <div
                style={{
                  fontSize: "0.9rem",
                  color: colors.danger,
                  background: "rgba(239,68,68,0.08)",
                  borderRadius: radius.md,
                  padding: spacing.xs,
                  border: `1px solid ${colors.danger}`,
                }}
              >
                {error}
              </div>
            )}

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: spacing.xs,
                fontSize: "0.95rem",
                color: text.primary,
              }}
            >
              <input
                type="checkbox"
                checked={trustChecked}
                onChange={(e) => setTrustChecked(e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              Trust this device for 30 days
            </label>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: spacing.sm,
                marginTop: spacing.xs,
              }}
            >
              <Button
                type="button"
                variant="ghost"
                onClick={handleCancel}
                style={{ flex: 1, justifyContent: "center" }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || code.trim().length < 6}
                style={{
                  flex: 1,
                  justifyContent: "center",
                  opacity: submitting || code.trim().length < 6 ? 0.7 : 1,
                  cursor:
                    submitting || code.trim().length < 6
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {submitting ? "Verifying…" : "Verify"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </MacShell>
  );
};
