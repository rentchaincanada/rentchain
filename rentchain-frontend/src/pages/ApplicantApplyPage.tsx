// rentchain-frontend/src/pages/ApplicantApplyPage.tsx
import React, { useState } from "react";
import { createApplication, submitApplication } from "@/api/applicationsApi";
import {
  sendApplicationPhoneCode,
  confirmApplicationPhoneCode,
} from "@/api/applicationsApi";

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.65rem",
  borderRadius: "0.65rem",
  border: "1px solid rgba(51,65,85,0.9)",
  backgroundColor: "rgba(15,23,42,0.95)",
  color: "#e5e7eb",
  fontSize: "0.9rem",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  marginBottom: "0.3rem",
  color: "#cbd5e1",
};

const ApplicantApplyPage: React.FC = () => {
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [streetName, setStreetName] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [unitApplied, setUnitApplied] = useState("");
  const [leaseStartDate, setLeaseStartDate] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [consentCreditCheck, setConsentCreditCheck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpStage, setOtpStage] = useState<"idle" | "sent" | "verifying" | "verified">("idle");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [devCode, setDevCode] = useState<string | undefined>(undefined);

  const missingRequired = [
    { key: "first name", value: firstName },
    { key: "last name", value: lastName },
    { key: "email", value: email },
    { key: "phone", value: phone },
    { key: "date of birth", value: dateOfBirth },
    { key: "street number", value: streetNumber },
    { key: "street name", value: streetName },
    { key: "city", value: city },
    { key: "province", value: province },
    { key: "postal code", value: postalCode },
    { key: "unit applied", value: unitApplied },
    { key: "lease start date", value: leaseStartDate },
    { key: "credit consent", value: consentCreditCheck ? "yes" : "" },
  ]
    .filter((item) => !String(item.value ?? "").trim())
    .map((item) => item.key);

  const canSubmit = missingRequired.length === 0;

  function startResendCooldown(seconds: number) {
    setResendCooldown(seconds);
    const interval = window.setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    if (!canSubmit) {
      setError(`Please complete: ${missingRequired.join(", ")}`);
      return;
    }

    setSubmitting(true);
    setError(null);
    setOtpError(null);

    try {
      let appId = applicationId;
      if (!appId) {
        const payload = {
          propertyId: "public-apply",
          propertyName: propertyName.trim() || "Tenant Application",
          unit: unitApplied.trim(),
          unitApplied: unitApplied.trim(),
          leaseStartDate,
          requestedRent: 0,
          primaryApplicant: {
            firstName: firstName.trim(),
            middleName: middleName.trim() || undefined,
            lastName: lastName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            dateOfBirth,
            recentAddress: {
              streetNumber: streetNumber.trim(),
              streetName: streetName.trim(),
              city: city.trim(),
              province: province.trim(),
              postalCode: postalCode.trim(),
            },
          },
          creditConsent: consentCreditCheck,
        } as const;

        const created = await createApplication(payload);
        appId = created.id;
        setApplicationId(appId);
      }

      if (!appId) {
        throw new Error("Failed to create application.");
      }

      const sendResult = await sendApplicationPhoneCode(appId);
      setOtpStage("sent");
      setDevCode(sendResult.devCode);
      startResendCooldown(30);
    } catch (err: any) {
      setError(err?.message ?? "Failed to start verification.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyCode() {
    if (!applicationId || !otpCode.trim()) {
      setOtpError("Enter the 6-digit code to verify.");
      return;
    }
    setOtpError(null);
    setOtpStage("verifying");
    try {
      await confirmApplicationPhoneCode(applicationId, otpCode.trim());
      setOtpStage("verified");
      const submitted = await submitApplication(applicationId);
      setSubmittedId(submitted.id);
    } catch (err: any) {
      setOtpError(err?.message ?? "Invalid or expired code.");
      setOtpStage("sent");
    }
  }

  async function handleResend() {
    if (!applicationId || resendCooldown > 0) return;
    try {
      const sendResult = await sendApplicationPhoneCode(applicationId);
      setOtpStage("sent");
      setDevCode(sendResult.devCode);
      startResendCooldown(30);
    } catch (err: any) {
      setOtpError(err?.message ?? "Unable to resend code.");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 20% 20%, rgba(59,130,246,0.12), #0b1224 45%, #0b1224 100%)",
        color: "#e5e7eb",
        padding: "2.5rem 1rem",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: "560px",
          margin: "0 auto",
          backgroundColor: "rgba(15,23,42,0.95)",
          borderRadius: "1rem",
          border: "1px solid rgba(59,130,246,0.5)",
          boxShadow: "0 18px 44px rgba(15,23,42,0.9)",
          padding: "1.6rem 1.5rem 1.4rem",
        }}
      >
        <div style={{ marginBottom: "1rem" }}>
          <div
            style={{
              fontSize: "0.8rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(148,163,184,0.85)",
              marginBottom: "0.3rem",
            }}
          >
            Apply
          </div>
          <h1 style={{ margin: 0, fontSize: "1.55rem", fontWeight: 700 }}>
            Tenant Application
          </h1>
          <p
            style={{
              marginTop: "0.35rem",
              marginBottom: 0,
              color: "rgba(203,213,225,0.9)",
              fontSize: "0.95rem",
            }}
          >
            Start your rental application with the essentials needed for
            screening. We keep it lean and use your details to create your
            application record.
          </p>
        </div>

        {error && (
          <div
            style={{
              marginBottom: "0.8rem",
              padding: "0.7rem 0.85rem",
              borderRadius: "0.85rem",
              backgroundColor: "rgba(127,29,29,0.25)",
              border: "1px solid rgba(248,113,113,0.7)",
              fontSize: "0.85rem",
            }}
          >
            {error}
          </div>
        )}

        {submittedId ? (
          <div
            style={{
              padding: "0.9rem 0.9rem 0.8rem",
              borderRadius: "0.9rem",
              border: "1px solid rgba(59,130,246,0.7)",
              backgroundColor: "rgba(30,41,59,0.9)",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: "0.4rem" }}>
              Application received
            </div>
            <div style={{ fontSize: "0.95rem", marginBottom: "0.35rem" }}>
              Thanks {firstName} — your application has been created.
            </div>
            <div style={{ fontSize: "0.85rem", color: "rgba(203,213,225,0.9)" }}>
              Application ID: <code>{submittedId}</code>
            </div>
            <div
              style={{
                marginTop: "0.5rem",
                fontSize: "0.8rem",
                color: "rgba(226,232,240,0.8)",
              }}
            >
              Keep this reference for follow-ups. A property manager may contact
              you if more details are needed.
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.85rem" }}>
            <div>
              <div style={labelStyle}>Property name (optional)</div>
              <input
                type="text"
                value={propertyName}
                onChange={(e) => setPropertyName(e.target.value)}
                style={fieldStyle}
                placeholder="Eg. Main Street Apartments"
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: "0.75rem",
              }}
            >
              <div>
                <div style={labelStyle}>First name *</div>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  style={fieldStyle}
                  autoComplete="given-name"
                  required
                />
              </div>
              <div>
                <div style={labelStyle}>Middle name</div>
                <input
                  type="text"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  style={fieldStyle}
                  autoComplete="additional-name"
                  placeholder="Optional"
                />
              </div>
              <div>
                <div style={labelStyle}>Last name *</div>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  style={fieldStyle}
                  autoComplete="family-name"
                  required
                />
              </div>
            </div>

            <div>
              <div style={labelStyle}>Email *</div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={fieldStyle}
                autoComplete="email"
                required
              />
            </div>

            <div>
              <div style={labelStyle}>Phone *</div>
              <input
                type="tel"
                inputMode="tel"
                pattern="[0-9+ ]*"
                value={phone}
                onChange={(e) =>
                  setPhone(e.target.value.replace(/[^0-9+ ]/g, ""))
                }
                style={fieldStyle}
                autoComplete="tel"
                required
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "0.75rem",
              }}
            >
              <div>
                <div style={labelStyle}>Unit applying for *</div>
                <input
                  type="text"
                  value={unitApplied}
                  onChange={(e) => setUnitApplied(e.target.value)}
                  style={fieldStyle}
                  placeholder="Eg. 12B"
                  required
                />
              </div>
              <div>
                <div style={labelStyle}>Lease start date *</div>
                <input
                  type="date"
                  value={leaseStartDate}
                  onChange={(e) => setLeaseStartDate(e.target.value)}
                  style={fieldStyle}
                  required
                />
              </div>
            </div>

            <div>
              <div style={labelStyle}>Date of birth *</div>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                style={fieldStyle}
                required
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "0.75rem",
              }}
            >
              <div>
                <div style={labelStyle}>Street number *</div>
                <input
                  type="text"
                  value={streetNumber}
                  onChange={(e) => setStreetNumber(e.target.value)}
                  style={fieldStyle}
                  required
                />
              </div>
              <div>
                <div style={labelStyle}>Street name *</div>
                <input
                  type="text"
                  value={streetName}
                  onChange={(e) => setStreetName(e.target.value)}
                  style={fieldStyle}
                  required
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "0.75rem",
              }}
            >
              <div>
                <div style={labelStyle}>City *</div>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  style={fieldStyle}
                  required
                />
              </div>
              <div>
                <div style={labelStyle}>Province *</div>
                <input
                  type="text"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  style={fieldStyle}
                  required
                  placeholder="Eg. ON"
                />
              </div>
            </div>

            <div>
              <div style={labelStyle}>Postal code *</div>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                style={fieldStyle}
                required
              />
            </div>

            <div
              style={{
                fontSize: "0.8rem",
                color: "rgba(226,232,240,0.8)",
                lineHeight: 1.5,
              }}
            >
              By submitting, you agree to a credit and reference check for
              screening purposes. Please ensure your contact details are
              accurate.
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                fontSize: "0.9rem",
                color: "#e5e7eb",
              }}
            >
              <input
                type="checkbox"
                checked={consentCreditCheck}
                onChange={(e) => setConsentCreditCheck(e.target.checked)}
                style={{ width: 18, height: 18 }}
                required
              />
              I consent to a credit check for tenant screening purposes.
            </label>

            {applicationId && !submittedId && (
              <div
                style={{
                  marginTop: "0.4rem",
                  borderRadius: "0.85rem",
                  border: "1px solid rgba(59,130,246,0.4)",
                  backgroundColor: "rgba(15,23,42,0.85)",
                  padding: "0.75rem 0.85rem",
                  display: "grid",
                  gap: "0.5rem",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                  Phone verification required
                </div>
                <div style={{ fontSize: "0.9rem", color: "rgba(226,232,240,0.85)" }}>
                  We sent a verification code to your phone. Enter it below to
                  submit your application.
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto",
                    gap: "0.5rem",
                    alignItems: "center",
                  }}
                >
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                    style={{ ...fieldStyle, margin: 0 }}
                    placeholder="6-digit code"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyCode}
                    disabled={otpStage === "verifying"}
                    style={{
                      padding: "0.5rem 0.9rem",
                      borderRadius: "0.85rem",
                      border: "1px solid rgba(59,130,246,0.9)",
                      background:
                        "linear-gradient(to right, rgba(59,130,246,0.9), rgba(37,99,235,0.9))",
                      color: "#e5f0ff",
                      fontWeight: 700,
                      cursor: otpStage === "verifying" ? "not-allowed" : "pointer",
                      opacity: otpStage === "verifying" ? 0.6 : 1,
                    }}
                  >
                    {otpStage === "verifying" ? "Verifying…" : "Verify"}
                  </button>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0}
                    style={{
                      padding: "0.5rem 0.85rem",
                      borderRadius: "0.85rem",
                      border: "1px solid rgba(148,163,184,0.5)",
                      backgroundColor: "rgba(30,41,59,0.9)",
                      color: "#e5e7eb",
                      cursor: resendCooldown > 0 ? "not-allowed" : "pointer",
                      opacity: resendCooldown > 0 ? 0.6 : 1,
                    }}
                  >
                    {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : "Resend"}
                  </button>
                </div>
                {import.meta.env.DEV && devCode && (
                  <div style={{ fontSize: "0.8rem", color: "rgba(148,163,184,0.9)" }}>
                    Dev code: {devCode}
                  </div>
                )}
                {otpError && (
                  <div
                    style={{
                      fontSize: "0.85rem",
                      color: "rgba(248,113,113,0.9)",
                      backgroundColor: "rgba(127,29,29,0.18)",
                      border: "1px solid rgba(248,113,113,0.6)",
                      borderRadius: "0.75rem",
                      padding: "0.5rem 0.65rem",
                    }}
                  >
                    {otpError}
                  </div>
                )}
              </div>
            )}

            {missingRequired.length > 0 && (
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "rgba(248,113,113,0.9)",
                  backgroundColor: "rgba(127,29,29,0.18)",
                  border: "1px solid rgba(248,113,113,0.6)",
                  borderRadius: "0.75rem",
                  padding: "0.6rem 0.75rem",
                }}
              >
                Required: {missingRequired.join(", ")}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit || submitting}
              style={{
                padding: "0.6rem 1rem",
                borderRadius: "0.85rem",
                border: "1px solid rgba(59,130,246,0.9)",
                background:
                  "linear-gradient(to right, rgba(59,130,246,0.9), rgba(37,99,235,0.9))",
                color: "#e5f0ff",
                fontSize: "0.95rem",
                fontWeight: 700,
                cursor: !canSubmit || submitting ? "not-allowed" : "pointer",
                opacity: !canSubmit || submitting ? 0.6 : 1,
              }}
            >
              {submitting ? "Submitting…" : "Submit application"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ApplicantApplyPage;
