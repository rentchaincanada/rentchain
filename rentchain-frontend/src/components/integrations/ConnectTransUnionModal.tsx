import React, { useEffect, useState } from "react";
import { Button, Card, Input } from "../ui/Ui";
import { colors, radius, shadows, spacing, text } from "@/styles/tokens";
import type { TransUnionCredentialsPayload, TransUnionIntegration } from "@/api/integrationsApi";

type ConnectStep = "chooser" | "credentials";

type Props = {
  open: boolean;
  submitting?: boolean;
  initialValue?: Partial<TransUnionCredentialsPayload>;
  onClose: () => void;
  onSubmit: (payload: TransUnionCredentialsPayload) => Promise<void> | void;
  onGetAccess?: () => void;
  onChooseExistingCredentials?: () => void;
  onContinue?: () => void;
  submitLabel?: string;
  integration?: TransUnionIntegration | null;
};

export function ConnectTransUnionModal({
  open,
  submitting = false,
  initialValue,
  onClose,
  onSubmit,
  onGetAccess,
  onChooseExistingCredentials,
  onContinue,
  submitLabel = "Connect Account",
  integration,
}: Props) {
  const [form, setForm] = useState<TransUnionCredentialsPayload>({
    businessName: initialValue?.businessName || integration?.businessName || "",
    contactName: initialValue?.contactName || integration?.contactName || "",
    contactEmail: initialValue?.contactEmail || integration?.contactEmail || "",
    memberCode: "",
    passcode: "",
    confirmPermissibleUse: false,
  });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState<ConnectStep>("chooser");
  const [editingBusinessDetails, setEditingBusinessDetails] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      businessName: initialValue?.businessName || integration?.businessName || "",
      contactName: initialValue?.contactName || integration?.contactName || "",
      contactEmail: initialValue?.contactEmail || integration?.contactEmail || "",
      memberCode: "",
      passcode: "",
      confirmPermissibleUse: false,
    });
    setError(null);
    setSuccess(false);
    setStep(integration?.status === "pending_credentialing" ? "credentials" : "chooser");
    setEditingBusinessDetails(false);
  }, [
    initialValue?.businessName,
    initialValue?.contactEmail,
    initialValue?.contactName,
    integration?.businessName,
    integration?.contactEmail,
    integration?.contactName,
    open,
  ]);

  if (!open) return null;

  const setField = (field: keyof TransUnionCredentialsPayload, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const showChooser = step === "chooser";
  const showCredentials = step === "credentials";
  const savedBusinessName = String(
    form.businessName || initialValue?.businessName || integration?.businessName || ""
  ).trim();
  const savedContactName = String(
    form.contactName || initialValue?.contactName || integration?.contactName || ""
  ).trim();
  const savedContactEmail = String(
    form.contactEmail || initialValue?.contactEmail || integration?.contactEmail || ""
  ).trim();
  const hasSavedBusinessDetails = Boolean(
    savedBusinessName &&
      savedContactName &&
      savedContactEmail
  );

  if (success) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="TransUnion Connected"
        style={{
          position: "fixed",
          inset: 0,
          minHeight: "100dvh",
          background: "rgba(15,23,42,0.42)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: spacing.md,
          zIndex: 1000,
        }}
      >
        <Card
          elevated
          style={{
            width: "min(620px, 100%)",
            display: "grid",
            gap: spacing.md,
            borderRadius: radius.lg,
            boxShadow: shadows.pop,
          }}
        >
          <div style={{ display: "grid", gap: spacing.sm }}>
            <h2 style={{ margin: 0, fontSize: "1.2rem" }}>TransUnion Connected</h2>
            <p style={{ margin: 0, color: text.muted, lineHeight: 1.6 }}>
              Your TransUnion membership is now connected to RentChain. You can continue screening
              applicants without leaving this workflow.
            </p>
          </div>
          <div
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: radius.md,
              padding: spacing.sm,
              background: colors.bg,
              display: "grid",
              gap: 6,
              fontSize: "0.94rem",
            }}
          >
            <div>Member code: {integration?.memberCodeMasked || "Saved securely"}</div>
            <div>Credentials are stored securely and the passcode is never shown again in RentChain.</div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: spacing.sm, flexWrap: "wrap" }}>
            <Button type="button" variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button
              type="button"
              onClick={() => {
                onContinue?.();
                onClose();
              }}
            >
              Continue to Screening
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Connect Your TransUnion Account"
      style={{
        position: "fixed",
        inset: 0,
        minHeight: "100dvh",
        background: "rgba(15,23,42,0.42)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.md,
        zIndex: 1000,
      }}
    >
      <Card
        elevated
        style={{
          width: "min(620px, 100%)",
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
          maxHeight: "min(760px, calc(100dvh - 32px))",
          overflow: "hidden",
          margin: 0,
          borderRadius: radius.lg,
          boxShadow: shadows.pop,
        }}
      >
        <div style={{ display: "grid", gap: spacing.xs }}>
          <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Connect Your TransUnion Account</h2>
          <p style={{ margin: 0, color: text.muted }}>
            Connect your TransUnion membership by entering the member code and passcode issued to
            your business. Screening requests are initiated under your TransUnion credentials within
            RentChain.
          </p>
          <p style={{ margin: 0, color: text.subtle, fontSize: "0.92rem" }}>
            If connection details are not available yet, use the access flow first. If the connection window does not open on mobile, try again or continue on desktop.
          </p>
        </div>
        <div style={{ display: "grid", gap: spacing.sm, minHeight: 0, flex: 1, overflowY: "auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: spacing.sm,
            }}
          >
            {[
              {
                key: "start",
                label: "Choose path",
                active: showChooser,
                complete: showCredentials || success,
              },
              {
                key: "connect",
                label: "Connect membership",
                active: showCredentials,
                complete: success,
              },
              {
                key: "ready",
                label: "Ready to screen",
                active: success,
                complete: success,
              },
            ].map((item) => (
              <div
                key={item.key}
                style={{
                  border: `1px solid ${item.active || item.complete ? colors.accent : colors.border}`,
                  background: item.active || item.complete ? colors.accentSoft : colors.bg,
                  borderRadius: radius.md,
                  padding: spacing.sm,
                  display: "grid",
                  gap: 4,
                }}
              >
                <div style={{ fontWeight: 700 }}>{item.label}</div>
                <div style={{ color: text.muted, fontSize: "0.85rem" }}>
                  {item.active ? "Current step" : item.complete ? "Completed" : "Upcoming"}
                </div>
              </div>
            ))}
          </div>

          {showChooser ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: spacing.sm,
              }}
            >
              <div
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.md,
                  background: colors.bg,
                  padding: spacing.sm,
                  display: "grid",
                  gap: 10,
                }}
              >
                <div style={{ fontWeight: 700 }}>Need TransUnion access?</div>
                <div style={{ color: text.muted, fontSize: "0.92rem", lineHeight: 1.5 }}>
                  Don&apos;t have TransUnion yet? We&apos;ll guide you through the external onboarding
                  path first. Once TransUnion issues your member code and passcode, come back here to
                  finish setup in RentChain.
                </div>
                <div style={{ color: text.subtle, fontSize: "0.86rem" }}>
                  Outcome: your account moves into a credentialing-in-progress state until you receive
                  the issued membership details.
                </div>
                {onGetAccess ? (
                  <div>
                    <Button type="button" variant="secondary" onClick={onGetAccess}>
                      Get TransUnion Access
                    </Button>
                  </div>
                ) : null}
              </div>
              <div
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.md,
                  background: colors.bg,
                  padding: spacing.sm,
                  display: "grid",
                  gap: 10,
                }}
              >
                <div style={{ fontWeight: 700 }}>Already credentialed?</div>
                <div style={{ color: text.muted, fontSize: "0.92rem", lineHeight: 1.5 }}>
                  Already have TransUnion-issued credentials? Enter the member code and passcode that
                  were issued to your business so you can configure screening access in RentChain.
                </div>
                <div style={{ color: text.subtle, fontSize: "0.86rem" }}>
                  Outcome: once the credentials are verified, your account is connected and ready to
                  screen.
                </div>
                <div>
                  <Button
                    type="button"
                    onClick={() => {
                      onChooseExistingCredentials?.();
                      setStep("credentials");
                    }}
                  >
                    I Already Have Credentials
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {showCredentials ? (
            <div style={{ display: "grid", gap: spacing.sm }}>
              <div
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.md,
                  background: colors.bg,
                  padding: spacing.sm,
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ fontWeight: 700 }}>Membership credentials</div>
                <div style={{ color: text.muted, fontSize: "0.92rem", lineHeight: 1.5 }}>
                  Enter the member code and passcode exactly as TransUnion provided them.
                </div>
                <div style={{ color: text.subtle, fontSize: "0.86rem" }}>
                  Next step: connect your membership now, then return to Applications to start the
                  first screening.
                </div>
              </div>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Member code</span>
                <Input
                  value={form.memberCode}
                  onChange={(event) => setField("memberCode", event.target.value)}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Passcode</span>
                <Input
                  type="password"
                  value={form.passcode}
                  onChange={(event) => setField("passcode", event.target.value)}
                />
              </label>

              <div
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.md,
                  background: "rgba(15,23,42,0.02)",
                  padding: spacing.sm,
                  display: "grid",
                  gap: spacing.sm,
                }}
              >
                <div style={{ fontWeight: 700 }}>Business details required for setup</div>
                <div style={{ color: text.muted, fontSize: "0.92rem", lineHeight: 1.5 }}>
                  RentChain also saves the business contact details tied to this TransUnion
                  connection so we can keep your setup record complete. If we already have them on
                  file, you can stay focused on the member code and passcode here.
                </div>
                {hasSavedBusinessDetails && !editingBusinessDetails ? (
                  <div
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: radius.md,
                      background: "#fff",
                      padding: spacing.sm,
                      display: "grid",
                      gap: 6,
                      fontSize: "0.92rem",
                    }}
                  >
                    <div>Business: {savedBusinessName}</div>
                    <div>Contact: {savedContactName}</div>
                    <div>Email: {savedContactEmail}</div>
                    <div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setForm((current) => ({
                            ...current,
                            businessName: savedBusinessName,
                            contactName: savedContactName,
                            contactEmail: savedContactEmail,
                          }));
                          setEditingBusinessDetails(true);
                        }}
                      >
                        Edit business details
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span>Legal business name</span>
                      <Input
                        value={form.businessName}
                        onChange={(event) => setField("businessName", event.target.value)}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span>Contact name</span>
                      <Input
                        value={form.contactName}
                        onChange={(event) => setField("contactName", event.target.value)}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span>Contact email</span>
                      <Input
                        type="email"
                        value={form.contactEmail}
                        onChange={(event) => setField("contactEmail", event.target.value)}
                      />
                    </label>
                  </>
                )}
              </div>

              <label style={{ display: "flex", gap: spacing.sm, alignItems: "flex-start" }}>
                <input
                  type="checkbox"
                  checked={form.confirmPermissibleUse}
                  onChange={(event) => setField("confirmPermissibleUse", event.target.checked)}
                />
                <span style={{ color: text.muted, lineHeight: 1.5 }}>
                  I confirm these credentials were issued by TransUnion for permissible tenant-screening
                  use.
                </span>
              </label>
              {error ? (
                <div
                  style={{
                    border: `1px solid rgba(239,68,68,0.3)`,
                    background: "rgba(239,68,68,0.08)",
                    borderRadius: radius.md,
                    padding: spacing.sm,
                    color: colors.danger,
                    fontSize: "0.92rem",
                  }}
                >
                  {error}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: spacing.sm, flexWrap: "wrap" }}>
          {showCredentials ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setError(null);
                setStep("chooser");
              }}
              disabled={submitting}
            >
              Back
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          {showCredentials ? (
            <Button
              type="button"
              onClick={async () => {
                setError(null);
                try {
                  await onSubmit(form);
                  setSuccess(true);
                } catch (submissionError: any) {
                  setError(String(submissionError?.message || "Unable to save TransUnion credentials."));
                }
              }}
              disabled={submitting}
            >
              {submitting ? "Saving..." : submitLabel}
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
