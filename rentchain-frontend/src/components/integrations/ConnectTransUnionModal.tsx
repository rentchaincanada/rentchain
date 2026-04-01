import React, { useEffect, useState } from "react";
import { Button, Card, Input } from "../ui/Ui";
import { colors, radius, shadows, spacing, text } from "@/styles/tokens";
import type { TransUnionCredentialsPayload, TransUnionIntegration } from "@/api/integrationsApi";

type Props = {
  open: boolean;
  submitting?: boolean;
  initialValue?: Partial<TransUnionCredentialsPayload>;
  onClose: () => void;
  onSubmit: (payload: TransUnionCredentialsPayload) => Promise<void> | void;
  onGetAccess?: () => void;
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

  if (success) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="TransUnion Connected"
        style={{
          position: "fixed",
          inset: 0,
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
        <div style={{ display: "grid", gap: spacing.xs }}>
          <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Connect Your TransUnion Account</h2>
          <p style={{ margin: 0, color: text.muted }}>
            Keep screening inside RentChain by saving your TransUnion member code and passcode
            here. Your credentials are encrypted and never displayed back after save.
          </p>
        </div>

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
              gap: 6,
            }}
          >
            <div style={{ fontWeight: 700 }}>Need TransUnion access?</div>
            <div style={{ color: text.muted, fontSize: "0.92rem", lineHeight: 1.5 }}>
              If you are not credentialed yet, start with the access steps first. Once TransUnion
              issues your membership details, return here to finish setup.
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
              gap: 6,
            }}
          >
            <div style={{ fontWeight: 700 }}>Already credentialed?</div>
            <div style={{ color: text.muted, fontSize: "0.92rem", lineHeight: 1.5 }}>
              Enter the member code and passcode that TransUnion provided to your business.
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: spacing.sm }}>
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

        <div style={{ display: "flex", justifyContent: "flex-end", gap: spacing.sm, flexWrap: "wrap" }}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
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
        </div>
      </Card>
    </div>
  );
}
