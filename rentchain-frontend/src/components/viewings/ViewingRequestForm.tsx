import React, { useState } from "react";
import { createViewingRequest } from "@/api/viewingsApi";
import { Button, Card, Input } from "../ui/Ui";
import { colors, radius, spacing, text } from "@/styles/tokens";

type Props = {
  propertyId?: string | null;
  unitId?: string | null;
  applicationId?: string | null;
};

export function ViewingRequestForm({ propertyId, unitId, applicationId }: Props) {
  const [applicantName, setApplicantName] = useState("");
  const [applicantEmail, setApplicantEmail] = useState("");
  const [applicantPhone, setApplicantPhone] = useState("");
  const [requestedMessage, setRequestedMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = applicantName.trim() && applicantEmail.trim() && (propertyId || unitId);

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError("Name, email, and a valid property context are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createViewingRequest({
        propertyId: propertyId || null,
        unitId: unitId || null,
        applicationId: applicationId || null,
        applicantName: applicantName.trim(),
        applicantEmail: applicantEmail.trim(),
        applicantPhone: applicantPhone.trim() || null,
        requestedMessage: requestedMessage.trim() || null,
      });
      setSubmitted(true);
      setApplicantName("");
      setApplicantEmail("");
      setApplicantPhone("");
      setRequestedMessage("");
    } catch (err: any) {
      setError(err?.message || "Unable to send viewing request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card elevated data-testid="viewing-request-form" style={{ display: "grid", gap: spacing.md }}>
      <div style={{ display: "grid", gap: spacing.xs }}>
        <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>Request Viewing</div>
        <div style={{ color: text.muted, lineHeight: 1.6 }}>
          Request a tour before completing the full application if you would like to see the unit first.
        </div>
      </div>

      {submitted ? (
        <div
          style={{
            border: `1px solid ${colors.border}`,
            background: colors.bg,
            borderRadius: radius.md,
            padding: spacing.md,
            color: text.secondary,
          }}
        >
          Your viewing request has been sent. The landlord or property manager will share available times.
        </div>
      ) : (
        <div style={{ display: "grid", gap: spacing.sm }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Name</span>
            <Input value={applicantName} onChange={(e) => setApplicantName(e.target.value)} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Email</span>
            <Input type="email" value={applicantEmail} onChange={(e) => setApplicantEmail(e.target.value)} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Phone</span>
            <Input value={applicantPhone} onChange={(e) => setApplicantPhone(e.target.value)} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Message</span>
            <textarea
              value={requestedMessage}
              onChange={(e) => setRequestedMessage(e.target.value)}
              style={{
                minHeight: 88,
                padding: "10px 12px",
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                fontFamily: "inherit",
              }}
            />
          </label>
          {error ? (
            <div style={{ color: "#b91c1c", fontSize: 13 }}>{error}</div>
          ) : null}
          <div>
            <Button type="button" onClick={() => void handleSubmit()} disabled={submitting || !canSubmit}>
              {submitting ? "Sending..." : "Request Viewing"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
