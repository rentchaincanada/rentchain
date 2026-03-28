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
  title?: string;
  submitLabel?: string;
  integration?: TransUnionIntegration | null;
};

export function ConnectTransUnionModal({
  open,
  submitting = false,
  initialValue,
  onClose,
  onSubmit,
  title = "Connect TransUnion",
  submitLabel = "Connect",
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
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
          <h2 style={{ margin: 0, fontSize: "1.2rem" }}>{title}</h2>
          <p style={{ margin: 0, color: text.muted }}>
            Your credentials are encrypted and only used for your screening workflow.
          </p>
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
