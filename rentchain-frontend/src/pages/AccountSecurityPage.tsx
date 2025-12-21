import React, { useState } from "react";
import { MacShell } from "../components/layout/MacShell";
import { useAuth } from "../context/useAuth";
import {
  startTotpSetup,
  confirmTotpSetup,
  TotpSetupResponse,
  TotpConfirmResponse,
  regenerateBackupCodes,
  trustDevice,
  disable2fa,
} from "../api/authApi";
import { QRCodeCanvas } from "qrcode.react";
import { Card, Input, Button } from "../components/ui/Ui";
import { colors, spacing, text } from "../styles/tokens";

export const AccountSecurityPage: React.FC = () => {
  const { user } = useAuth();

  const [step, setStep] = useState<"idle" | "secret-issued" | "confirmed">(
    "idle"
  );
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [regenCode, setRegenCode] = useState("");
  const [trustCode, setTrustCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [trustLoading, setTrustLoading] = useState(false);
  const [disableLoading, setDisableLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleStartSetup = async () => {
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      const resp: TotpSetupResponse = await startTotpSetup();
      setSecret(resp.secret);
      setOtpauthUrl(resp.otpauthUrl);
      setStep("secret-issued");
    } catch (err: any) {
      setError(err?.message || "Failed to start 2FA setup.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    setError(null);
    setSuccessMessage(null);
    setRegenLoading(true);
    try {
      const resp = await regenerateBackupCodes(regenCode.trim());
      setBackupCodes(resp.backupCodes);
      setStep("confirmed");
      setSuccessMessage("Backup codes regenerated. Save them now.");
      setRegenCode("");
    } catch (err: any) {
      setError(err?.message || "Failed to regenerate backup codes.");
    } finally {
      setRegenLoading(false);
    }
  };

  const handleTrustDevice = async () => {
    setError(null);
    setSuccessMessage(null);
    setTrustLoading(true);
    try {
      const resp = await trustDevice(trustCode.trim());
      localStorage.setItem("rentchain_trusted_device", resp.trustedDeviceToken);
      setSuccessMessage("Device trusted for 30 days.");
      setTrustCode("");
    } catch (err: any) {
      setError(err?.message || "Failed to trust device.");
    } finally {
      setTrustLoading(false);
    }
  };

  const handleDisable2fa = async () => {
    setError(null);
    setSuccessMessage(null);
    setDisableLoading(true);
    try {
      await disable2fa(disableCode.trim());
      localStorage.removeItem("rentchain_trusted_device");
      setStep("idle");
      setSecret(null);
      setOtpauthUrl(null);
      setBackupCodes(null);
      setDisableCode("");
      setSuccessMessage("Two-factor authentication disabled.");
    } catch (err: any) {
      setError(err?.message || "Failed to disable 2FA.");
    } finally {
      setDisableLoading(false);
    }
  };

  const handleConfirm = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      const resp: TotpConfirmResponse = await confirmTotpSetup(code.trim());
      setBackupCodes(resp.backupCodes);
      setStep("confirmed");
      setSuccessMessage(
        "Two-factor authentication is now enabled on your account."
      );
    } catch (err: any) {
      setError(err?.message || "Failed to confirm 2FA code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <MacShell title="RentChain · Account security">
      <div
        style={{
          maxWidth: 780,
          margin: `${spacing.xl} auto`,
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
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
            Account security
          </h1>
          <p
            style={{
              fontSize: "0.9rem",
              color: text.muted,
              marginBottom: 4,
            }}
          >
            Manage two-factor authentication (2FA) for your RentChain account.
          </p>
          {user && (
            <p
              style={{
                fontSize: "0.8rem",
                color: text.subtle,
              }}
            >
              Signed in as <span style={{ color: text.primary }}>{user.email}</span>
            </p>
          )}
        </Card>

        <Card>
          <h2
            style={{
              fontSize: "1rem",
              fontWeight: 600,
              marginBottom: spacing.xs,
              color: text.primary,
            }}
          >
            Build credit with your rent
          </h2>
          <p
            style={{
              fontSize: "0.9rem",
              color: text.muted,
              marginBottom: spacing.xs,
            }}
          >
            Report on-time rent payments to credit bureaus.
          </p>
          <p
            style={{
              fontSize: "0.85rem",
              color: text.subtle,
              marginBottom: spacing.sm,
            }}
          >
            Opt-in only. Positive payments only. Separate opt-in consent from screening consent.
          </p>
          <Button type="button" disabled>
            Coming soon
          </Button>
        </Card>

        {/* 2FA section */}
        <Card>
          <h2
            style={{
              fontSize: "1rem",
              fontWeight: 600,
              marginBottom: spacing.xs,
              color: text.primary,
            }}
          >
            Authenticator app (TOTP)
          </h2>
          <p
            style={{
              fontSize: "0.85rem",
              color: text.muted,
              marginBottom: spacing.md,
            }}
          >
            Use an authenticator app like Google Authenticator or Authy to
            generate a time-based 6-digit code when you sign in.
          </p>

          {error && (
            <div
              style={{
                fontSize: "0.9rem",
                color: colors.danger,
                background: "rgba(239,68,68,0.08)",
                borderRadius: spacing.xs,
                padding: "8px 10px",
                marginBottom: spacing.sm,
                border: `1px solid ${colors.danger}`,
              }}
            >
              {error}
            </div>
          )}

          {successMessage && (
            <div
              style={{
                fontSize: "0.9rem",
                color: "#15803d",
                background: "rgba(34,197,94,0.08)",
                borderRadius: spacing.xs,
                padding: "8px 10px",
                marginBottom: spacing.sm,
                border: "1px solid rgba(34,197,94,0.4)",
              }}
            >
              {successMessage}
            </div>
          )}

          {step === "idle" && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  fontSize: "0.85rem",
                  color: text.muted,
                }}
              >
                2FA with an authenticator app is currently not configured.
              </div>
              <Button
                type="button"
                onClick={handleStartSetup}
                disabled={loading}
                style={{
                  width: "auto",
                  paddingLeft: 14,
                  paddingRight: 14,
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? "wait" : "pointer",
                }}
              >
                {loading ? "Starting…" : "Enable 2FA"}
              </Button>
            </div>
          )}

          {step !== "idle" && (
            <div
              style={{
                marginTop: 8,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  Step 1 – Add to your authenticator app
                </h3>
                <p
                  style={{
                    fontSize: "0.8rem",
                    color: text.muted,
                    marginBottom: 6,
                  }}
                >
                  In your authenticator app, add a new account and use the secret
                  or the URL below.
                </p>
                {secret && (
                  <div
                    style={{
                      fontSize: "0.8rem",
                      background: "#f8fafc",
                      borderRadius: 8,
                      padding: "8px 10px",
                      border: `1px solid ${colors.border}`,
                      marginBottom: 6,
                      wordBreak: "break-all",
                    }}
                  >
                    <strong>Secret:</strong> {secret}
                  </div>
                )}
                {otpauthUrl && (
                  <div
                    style={{
                      fontSize: "0.8rem",
                      background: "#f8fafc",
                      borderRadius: 8,
                      padding: "8px 10px",
                      border: `1px solid ${colors.border}`,
                      wordBreak: "break-all",
                    }}
                  >
                    <strong>otpauth URL:</strong> {otpauthUrl}
                  </div>
                )}
                {otpauthUrl && (
                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      gap: 16,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        background: "#f8fafc",
                        border: `1px solid ${colors.border}`,
                      }}
                    >
                      <QRCodeCanvas value={otpauthUrl} size={160} />
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: text.muted,
                        maxWidth: 420,
                      }}
                    >
                      Scan this QR code in Google Authenticator/Authy. If
                      scanning fails, use the Secret field for manual entry.
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleConfirm}>
                <h3
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  Step 2 – Enter a code to confirm
                </h3>
                <p
                  style={{
                    fontSize: "0.8rem",
                    color: text.muted,
                    marginBottom: 8,
                  }}
                >
                  Enter the 6-digit code shown in your authenticator app for
                  RentChain.
                </p>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  style={{
                    width: "160px",
                    letterSpacing: "0.25em",
                    textAlign: "center",
                    marginBottom: 10,
                  }}
                />
                <div>
                  <Button
                    type="submit"
                    disabled={loading || code.trim().length < 6}
                    style={{
                      paddingLeft: 14,
                      paddingRight: 14,
                      opacity: loading || code.trim().length < 6 ? 0.7 : 1,
                      cursor:
                        loading || code.trim().length < 6
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {loading ? "Confirming…" : "Confirm 2FA"}
                  </Button>
                </div>
              </form>

              {backupCodes && backupCodes.length > 0 && (
                <div
                  style={{
                    marginTop: 8,
                  }}
                >
                  <h3
                    style={{
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    Backup codes
                  </h3>
                  <p
                    style={{
                      fontSize: "0.8rem",
                      color: text.muted,
                      marginBottom: 6,
                    }}
                  >
                    Save these backup codes in a safe place. Each code can be
                    used once if you lose access to your authenticator app.
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                      gap: 8,
                    }}
                  >
                    {backupCodes.map((c) => (
                      <div
                        key={c}
                        style={{
                          fontSize: "0.8rem",
                          borderRadius: 10,
                          padding: "6px 8px",
                          background: "#f8fafc",
                          border: `1px solid ${colors.border}`,
                        }}
                      >
                        {c}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(backupCodes?.length || step === "confirmed") && (
                <div
                  style={{
                    marginTop: 8,
                    borderTop: `1px solid ${colors.border}`,
                    paddingTop: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <h3
                    style={{
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      marginBottom: 2,
                    }}
                  >
                    Regenerate backup codes
                  </h3>
                  <p
                    style={{
                      fontSize: "0.8rem",
                      color: text.muted,
                      marginBottom: 4,
                    }}
                  >
                    Enter a current 6-digit code to generate a fresh set of
                    backup codes.
                  </p>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={regenCode}
                      onChange={(e) => setRegenCode(e.target.value)}
                      placeholder="123456"
                      style={{
                        width: "160px",
                        letterSpacing: "0.25em",
                        textAlign: "center",
                      }}
                    />
                    <Button
                      type="button"
                      onClick={handleRegenerateBackupCodes}
                      disabled={
                        regenLoading || regenCode.trim().length < 6 || loading
                      }
                      style={{
                        paddingLeft: 14,
                        paddingRight: 14,
                        opacity:
                          regenLoading || regenCode.trim().length < 6 || loading
                            ? 0.7
                            : 1,
                        cursor:
                          regenLoading || regenCode.trim().length < 6 || loading
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      {regenLoading ? "Regenerating…" : "Regenerate backup codes"}
                    </Button>
                  </div>
                </div>
              )}

              {step === "confirmed" && (
                <div
                  style={{
                    marginTop: 8,
                    borderTop: `1px solid ${colors.border}`,
                    paddingTop: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <h3
                    style={{
                      fontSize: "0.9rem",
                      fontWeight: 600,
                    }}
                  >
                    Trust this device
                  </h3>
                  <p
                    style={{
                      fontSize: "0.8rem",
                      color: text.muted,
                    }}
                  >
                    Enter a 6-digit code to trust this device for 30 days and skip 2FA here.
                  </p>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={trustCode}
                      onChange={(e) => setTrustCode(e.target.value)}
                      placeholder="123456"
                      style={{
                        width: "160px",
                        letterSpacing: "0.25em",
                        textAlign: "center",
                      }}
                    />
                    <Button
                      type="button"
                      onClick={handleTrustDevice}
                      disabled={
                        trustLoading || trustCode.trim().length < 6 || loading
                      }
                      style={{
                        paddingLeft: 14,
                        paddingRight: 14,
                        opacity:
                          trustLoading || trustCode.trim().length < 6 || loading
                            ? 0.7
                            : 1,
                        cursor:
                          trustLoading || trustCode.trim().length < 6 || loading
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      {trustLoading ? "Trusting…" : "Trust this device"}
                    </Button>
                  </div>
                </div>
              )}

              {step === "confirmed" && (
                <div
                  style={{
                    marginTop: 8,
                    borderTop: `1px solid ${colors.border}`,
                    paddingTop: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <h3
                    style={{
                      fontSize: "0.9rem",
                      fontWeight: 600,
                    }}
                  >
                    Disable 2FA
                  </h3>
                  <p
                    style={{
                      fontSize: "0.8rem",
                      color: text.muted,
                    }}
                  >
                    Enter a TOTP or backup code to turn off two-factor authentication.
                  </p>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={10}
                      value={disableCode}
                      onChange={(e) => setDisableCode(e.target.value)}
                      placeholder="123456 or backup"
                      style={{
                        width: "200px",
                        letterSpacing: "0.1em",
                      }}
                    />
                    <Button
                      type="button"
                      onClick={handleDisable2fa}
                      disabled={
                        disableLoading || disableCode.trim().length < 6 || loading
                      }
                      style={{
                        paddingLeft: 14,
                        paddingRight: 14,
                        opacity:
                          disableLoading || disableCode.trim().length < 6 || loading
                            ? 0.7
                            : 1,
                        cursor:
                          disableLoading || disableCode.trim().length < 6 || loading
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      {disableLoading ? "Disabling…" : "Disable 2FA"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </MacShell>
  );
};
