// @ts-nocheck
// rentchain-frontend/src/pages/ApplyPage.tsx
import React, { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { TopNav } from "../components/layout/TopNav";
import {
  Application,
  SubmitApplicationPayload,
  createApplication,
  submitApplication,
} from "@/api/applicationsApi";
import {
  confirmApplicationPhoneCode,
  sendApplicationPhoneCode,
} from "@/api/applicationsApi";

interface RouteParams {
  propertyId: string;
  unit: string;
}

const propertyDefaults: Record<
  string,
  { propertyName: string; defaultRent: number }
> = {
  "p-main": { propertyName: "Main St. Apartments", defaultRent: 1450 },
  "p-downtown": { propertyName: "Downtown Lofts", defaultRent: 1650 },
  "p-springview": { propertyName: "Springview Court", defaultRent: 1800 },
};

const ApplyPage: React.FC = () => {
  const navigate = useNavigate();
  const { propertyId, unit } = useParams<RouteParams>();

  const defaults = useMemo(() => {
    if (!propertyId) {
      return {
        propertyName: "Unknown Property",
        defaultRent: 0,
      };
    }
    return (
      propertyDefaults[propertyId] || {
        propertyName: propertyId,
        defaultRent: 0,
      }
    );
  }, [propertyId]);

  // Wizard state
  const [step, setStep] = useState(1);

  // Step 1 – primary applicant + contact
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [unitApplied, setUnitApplied] = useState(unit || "");
  const [leaseStartDate, setLeaseStartDate] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [streetName, setStreetName] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const [requestedRent, setRequestedRent] = useState<string>(
    defaults.defaultRent ? String(defaults.defaultRent) : ""
  );

  // Step 2 – employment
  const [employer, setEmployer] = useState("");
  const [position, setPosition] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState("");

  // Step 3 – co-applicant + references (MVP: single co-applicant)
  const [hasCoApplicant, setHasCoApplicant] = useState(false);
  const [coFullName, setCoFullName] = useState("");
  const [coEmail, setCoEmail] = useState("");
  const [coPhone, setCoPhone] = useState("");
  const [coMonthlyIncome, setCoMonthlyIncome] = useState("");

  const [coAddress, setCoAddress] = useState("");
  const [coCity, setCoCity] = useState("");
  const [coProvinceState, setCoProvinceState] = useState("");
  const [coPostalCode, setCoPostalCode] = useState("");


  const [currentLandlordName, setCurrentLandlordName] = useState("");
  const [currentLandlordPhone, setCurrentLandlordPhone] = useState("");

  // Deeper details – household / pets / vehicles / notes
  const [otherOccupants, setOtherOccupants] = useState("");
  const [petDetails, setPetDetails] = useState("");
  const [vehicleDetails, setVehicleDetails] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  // Step 4 – consent + submit
  const [creditConsent, setCreditConsent] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedAppId, setSubmittedAppId] = useState<string | null>(null);
  const [createdApplication, setCreatedApplication] = useState<Application | null>(null);
  const [verificationRequested, setVerificationRequested] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [resendBlocked, setResendBlocked] = useState(false);

  const totalSteps = 4;

  const canGoNext = useMemo(() => {
    if (step === 1) {
      return (
        !!firstName &&
        !!lastName &&
        !!email &&
        !!phone &&
        !!unitApplied &&
        !!leaseStartDate &&
        !!dob &&
        !!streetNumber &&
        !!streetName &&
        !!city &&
        !!province &&
        !!postalCode &&
        !!requestedRent
      );
    }
    if (step === 2) {
      return true;
    }
    if (step === 3) {
      return true;
    }
    if (step === 4) {
      return creditConsent && !submitting;
    }
    return true;
  }, [
    step,
    firstName,
    lastName,
    email,
    phone,
    unitApplied,
    leaseStartDate,
    dob,
    streetNumber,
    streetName,
    city,
    province,
    postalCode,
    requestedRent,
    creditConsent,
    submitting,
  ]);

  const applicantName = useMemo(
    () => [firstName, middleName, lastName].filter(Boolean).join(" "),
    [firstName, middleName, lastName]
  );

  async function handleSubmit() {
    if (!propertyId || !unit) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const missing: string[] = [];
      if (!firstName) missing.push("firstName");
      if (!lastName) missing.push("lastName");
      if (!email) missing.push("email");
      if (!phone) missing.push("phone");
      if (!dob) missing.push("dateOfBirth");
      if (!unitApplied && !unit) missing.push("unitApplied");
      if (!leaseStartDate) missing.push("leaseStartDate");
      if (!streetNumber) missing.push("streetNumber");
      if (!streetName) missing.push("streetName");
      if (!city) missing.push("city");
      if (!province) missing.push("province");
      if (!postalCode) missing.push("postalCode");
      if (!creditConsent) missing.push("consentCreditCheck");

      if (missing.length) {
        setSubmitError(
          `Missing required fields: ${missing
            .map((f) => f)
            .join(", ")}`
        );
        setSubmitting(false);
        return;
      }

      const unitValue = unitApplied || unit;
      const rentNumber = Number(requestedRent) || 0;
      const incomeNumber = Number(monthlyIncome) || 0;
      const coIncomeNumber = Number(coMonthlyIncome) || 0;

      const payload: SubmitApplicationPayload = {
        propertyId,
        propertyName: defaults.propertyName,
        unit,
        unitApplied: unitValue,
        leaseStartDate,
        requestedRent: rentNumber,
        primaryApplicant: {
          firstName,
          middleName: middleName || undefined,
          lastName,
          email,
          phone,
          dateOfBirth: dob,
          dob,
          recentAddress: {
            streetNumber,
            streetName,
            city,
            province,
            postalCode,
          },
        },
        employment: {
          employer: employer || undefined,
          position: position || undefined,
          monthlyIncome: incomeNumber || undefined,
        },
                coApplicant: hasCoApplicant
          ? {
              fullName: coFullName || undefined,
              email: coEmail || undefined,
              phone: coPhone || undefined,
              monthlyIncome: coIncomeNumber || undefined,
              address: coAddress || undefined,
              city: coCity || undefined,
              provinceState: coProvinceState || undefined,
              postalCode: coPostalCode || undefined,
            }
          : undefined,

        references: {
          currentLandlordName: currentLandlordName || undefined,
          currentLandlordPhone: currentLandlordPhone || undefined,
        },
        household: {
          otherOccupants: otherOccupants || undefined,
          pets: petDetails || undefined,
        vehicles: vehicleDetails || undefined,
        notes: additionalNotes || undefined,
      },
        creditConsent,
      };

      let app = createdApplication;
      if (!app) {
        app = await createApplication(payload);
        setCreatedApplication(app);
      }

      if (app.phoneVerified) {
        const submitted = await submitApplication(app.id);
        setCreatedApplication(submitted);
        setSubmittedAppId(submitted.id);
        setStep(totalSteps);
        return;
      }

      await handleSendCode(app.id);
      setVerificationRequested(true);
      setSubmitError(null);
    } catch (err: any) {
      console.error("[ApplyPage] submit error:", err);
      setSubmitError(err?.message ?? "Failed to submit application.");
    } finally {
      setSubmitting(false);
    }
  }

  function goNext() {
    if (step < totalSteps) {
      setStep(step + 1);
    } else if (step === totalSteps) {
      void handleSubmit();
    }
  }

  async function handleSendCode(applicationId: string) {
    try {
      setVerificationError(null);
      const resp = await sendApplicationPhoneCode(applicationId);
      if (resp.devCode) {
        setDevCode(resp.devCode);
      }
      if (resp.application) {
        setCreatedApplication(resp.application);
      }
      setVerificationRequested(true);
      setResendBlocked(true);
      setTimeout(() => setResendBlocked(false), 15000);
    } catch (err: any) {
      setVerificationError(err?.message || "Unable to send verification code.");
    }
  }

  async function handleVerifyCode() {
    if (!createdApplication) return;
    setVerifying(true);
    setVerificationError(null);
    try {
      const updated = await confirmApplicationPhoneCode(
        createdApplication.id,
        verificationCode.trim()
      );
      setCreatedApplication(updated);
      const submitted = await submitApplication(updated.id);
      setSubmittedAppId(submitted.id);
      setCreatedApplication(submitted);
      setStep(totalSteps);
    } catch (err: any) {
      setVerificationError(err?.message || "Invalid or expired code.");
    } finally {
      setVerifying(false);
    }
  }

  function goBack() {
    if (step > 1) {
      setStep(step - 1);
    }
  }

  const progressPercent = (step / totalSteps) * 100;

  return (
    <div className="app-root">
      <TopNav />
      <div className="app-shell">
        <div
          style={{
            maxWidth: "800px",
            margin: "0 auto",
          }}
        >
          {/* Header */}
          <div
            style={{
              marginBottom: "1.2rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "0.8rem",
            }}
          >
            <div>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                Rental application
              </h1>
              <div
                style={{
                  fontSize: "0.85rem",
                  opacity: 0.8,
                  marginTop: "0.1rem",
                }}
              >
                Apply for{" "}
                <strong>
                  {defaults.propertyName} – Unit {unit}
                </strong>
                .
              </div>
            </div>
            <div
              style={{
                fontSize: "0.78rem",
                opacity: 0.8,
                textAlign: "right",
              }}
            >
              Step {step} of {totalSteps}
              <div
                style={{
                  marginTop: "0.35rem",
                  width: "140px",
                  height: "5px",
                  borderRadius: "999px",
                  backgroundColor: "rgba(30,41,59,1)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${progressPercent}%`,
                    height: "100%",
                    borderRadius: "999px",
                    background:
                      "linear-gradient(to right, rgba(59,130,246,0.9), rgba(45,212,191,0.9))",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Card */}
          <div
            style={{
              borderRadius: "1rem",
              backgroundColor: "rgba(15,23,42,0.95)",
              border: "1px solid rgba(30,64,175,0.9)",
              boxShadow: "0 18px 44px rgba(15,23,42,0.9)",
              padding: "1.1rem 1.3rem 1rem",
            }}
          >
            {submitError && (
              <div
                style={{
                  marginBottom: "0.75rem",
                  padding: "0.6rem 0.8rem",
                  borderRadius: "0.75rem",
                  backgroundColor: "rgba(127,29,29,0.3)",
                  border: "1px solid rgba(248,113,113,0.7)",
                  fontSize: "0.8rem",
                }}
              >
                {submitError}
              </div>
            )}

            {submittedAppId ? (
              <div
                style={{
                  fontSize: "0.9rem",
                }}
              >
                <div
                  style={{
                    marginBottom: "0.6rem",
                    fontSize: "1rem",
                    fontWeight: 600,
                  }}
                >
                  Application submitted 🎉
                </div>
                <p>
                  Thank you, <strong>{applicantName}</strong>. Your application for{" "}
                  <strong>
                    {defaults.propertyName} – Unit {unit}
                  </strong>{" "}
                  has been received.
                </p>
                <p
                  style={{
                    marginTop: "0.4rem",
                    opacity: 0.85,
                    fontSize: "0.85rem",
                  }}
                >
                  Reference ID: <code>{submittedAppId}</code>
                  <br />
                  A property manager may contact you if any additional
                  information is needed.
                </p>
                <div
                  style={{
                    marginTop: "0.9rem",
                    display: "flex",
                    gap: "0.6rem",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => navigate("/applications")}
                    style={{
                      padding: "0.45rem 0.9rem",
                      borderRadius: "999px",
                      border: "1px solid rgba(59,130,246,0.9)",
                      background:
                        "linear-gradient(to right, rgba(59,130,246,0.9), rgba(37,99,235,0.9))",
                      color: "#e5f0ff",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    Back to applications desk
                  </button>
                </div>
              </div>
            ) : (
              <>
                {step === 1 && (
                  <StepOne
                    firstName={firstName}
                    setFirstName={setFirstName}
                    middleName={middleName}
                    setMiddleName={setMiddleName}
                    lastName={lastName}
                    setLastName={setLastName}
                    email={email}
                    setEmail={setEmail}
                    phone={phone}
                    setPhone={setPhone}
                    dob={dob}
                    setDob={setDob}
                    unitApplied={unitApplied}
                    setUnitApplied={setUnitApplied}
                    leaseStartDate={leaseStartDate}
                    setLeaseStartDate={setLeaseStartDate}
                    streetNumber={streetNumber}
                    setStreetNumber={setStreetNumber}
                    streetName={streetName}
                    setStreetName={setStreetName}
                    city={city}
                    setCity={setCity}
                    province={province}
                    setProvince={setProvince}
                    postalCode={postalCode}
                    setPostalCode={setPostalCode}
                    requestedRent={requestedRent}
                    setRequestedRent={setRequestedRent}
                  />
                )}

                {step === 2 && (
                  <StepTwo
                    employer={employer}
                    setEmployer={setEmployer}
                    position={position}
                    setPosition={setPosition}
                    monthlyIncome={monthlyIncome}
                    setMonthlyIncome={setMonthlyIncome}
                  />
                )}

                {step === 3 && (
  <StepThree
    hasCoApplicant={hasCoApplicant}
    setHasCoApplicant={setHasCoApplicant}
    coFullName={coFullName}
    setCoFullName={setCoFullName}
    coEmail={coEmail}
    setCoEmail={setCoEmail}
    coPhone={coPhone}
    setCoPhone={setCoPhone}
    coMonthlyIncome={coMonthlyIncome}
    setCoMonthlyIncome={setCoMonthlyIncome}
    coAddress={coAddress}
    setCoAddress={setCoAddress}
    coCity={coCity}
    setCoCity={setCoCity}
    coProvinceState={coProvinceState}
    setCoProvinceState={setCoProvinceState}
    coPostalCode={coPostalCode}
    setCoPostalCode={setCoPostalCode}
    currentLandlordName={currentLandlordName}
    setCurrentLandlordName={setCurrentLandlordName}
    currentLandlordPhone={currentLandlordPhone}
    setCurrentLandlordPhone={setCurrentLandlordPhone}
    otherOccupants={otherOccupants}
    setOtherOccupants={setOtherOccupants}
    petDetails={petDetails}
    setPetDetails={setPetDetails}
    vehicleDetails={vehicleDetails}
    setVehicleDetails={setVehicleDetails}
    additionalNotes={additionalNotes}
    setAdditionalNotes={setAdditionalNotes}
  />
)}


                {step === 4 && (
                  <StepFour
                    creditConsent={creditConsent}
                    setCreditConsent={setCreditConsent}
                    submitting={submitting}
                  />
                )}

                {verificationRequested && !submittedAppId && (
                  <div
                    style={{
                      marginTop: "0.75rem",
                      padding: "0.75rem",
                      borderRadius: "0.75rem",
                      border: "1px solid rgba(59,130,246,0.6)",
                      backgroundColor: "rgba(30,41,59,0.9)",
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "0.35rem" }}>
                      We sent a verification code to your phone.
                    </div>
                    <div style={{ fontSize: "0.85rem", opacity: 0.85 }}>
                      Enter the code to submit your application. {devCode ? `(Dev code: ${devCode})` : ""}
                    </div>
                    <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <input
                        type="text"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        placeholder="6-digit code"
                        style={{
                          flex: 1,
                          padding: "0.5rem 0.6rem",
                          borderRadius: "0.55rem",
                          border: "1px solid rgba(99,102,241,0.6)",
                          backgroundColor: "rgba(15,23,42,0.95)",
                          color: "#e5e7eb",
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleVerifyCode}
                        disabled={verifying || !verificationCode.trim()}
                        style={{
                          padding: "0.45rem 0.85rem",
                          borderRadius: "0.6rem",
                          border: "1px solid rgba(59,130,246,0.9)",
                          background:
                            "linear-gradient(to right, rgba(59,130,246,0.9), rgba(37,99,235,0.9))",
                          color: "#e5f0ff",
                          cursor:
                            verifying || !verificationCode.trim()
                              ? "not-allowed"
                              : "pointer",
                          opacity: verifying || !verificationCode.trim() ? 0.6 : 1,
                        }}
                      >
                        {verifying ? "Verifying..." : "Verify"}
                      </button>
                    </div>
                    <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <button
                        type="button"
                        onClick={() =>
                          createdApplication ? handleSendCode(createdApplication.id) : undefined
                        }
                        disabled={resendBlocked || !createdApplication}
                        style={{
                          padding: "0.35rem 0.75rem",
                          borderRadius: "0.6rem",
                          border: "1px solid rgba(148,163,184,0.6)",
                          backgroundColor: "transparent",
                          color: "#e5e7eb",
                          cursor: resendBlocked ? "not-allowed" : "pointer",
                          opacity: resendBlocked ? 0.6 : 0.9,
                        }}
                      >
                        {resendBlocked ? "Resend in a moment..." : "Resend code"}
                      </button>
                      <div style={{ fontSize: "0.8rem", color: "rgba(226,232,240,0.8)" }}>
                        SMS is required to submit.
                      </div>
                    </div>
                    {verificationError && (
                      <div
                        style={{
                          marginTop: "0.45rem",
                          fontSize: "0.8rem",
                          color: "#fca5a5",
                        }}
                      >
                        {verificationError}
                      </div>
                    )}
                  </div>
                )}

                <div
                  style={{
                    marginTop: "1.1rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "0.6rem",
                  }}
                >
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={step === 1 || submitting}
                    style={{
                      padding: "0.4rem 0.8rem",
                      borderRadius: "999px",
                      border: "1px solid rgba(148,163,184,0.7)",
                      backgroundColor: "transparent",
                      color: "#e5e7eb",
                      fontSize: "0.85rem",
                      cursor:
                        step === 1 || submitting ? "not-allowed" : "pointer",
                      opacity: step === 1 ? 0.4 : 0.9,
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={step === totalSteps ? handleSubmit : goNext}
                    disabled={!canGoNext}
                    style={{
                      padding: "0.45rem 1.1rem",
                      borderRadius: "999px",
                      border: "1px solid rgba(59,130,246,0.9)",
                      background:
                        "linear-gradient(to right, rgba(59,130,246,0.9), rgba(37,99,235,0.9))",
                      color: "#e5f0ff",
                      fontSize: "0.85rem",
                      cursor: canGoNext ? "pointer" : "not-allowed",
                      opacity: canGoNext ? 1 : 0.5,
                    }}
                  >
                    {step === totalSteps
                      ? submitting
                        ? "Submitting..."
                        : "Submit application"
                      : "Next"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface StepOneProps {
  firstName: string;
  setFirstName: (v: string) => void;
  middleName: string;
  setMiddleName: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  dob: string;
  setDob: (v: string) => void;
  unitApplied: string;
  setUnitApplied: (v: string) => void;
  leaseStartDate: string;
  setLeaseStartDate: (v: string) => void;
  streetNumber: string;
  setStreetNumber: (v: string) => void;
  streetName: string;
  setStreetName: (v: string) => void;
  city: string;
  setCity: (v: string) => void;
  province: string;
  setProvince: (v: string) => void;
  postalCode: string;
  setPostalCode: (v: string) => void;
  requestedRent: string;
  setRequestedRent: (v: string) => void;
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.4rem 0.55rem",
  borderRadius: "0.5rem",
  border: "1px solid rgba(51,65,85,0.9)",
  backgroundColor: "rgba(15,23,42,0.95)",
  color: "#e5e7eb",
  fontSize: "0.85rem",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  marginBottom: "0.15rem",
};

const StepOne: React.FC<StepOneProps> = ({
  firstName,
  setFirstName,
  middleName,
  setMiddleName,
  lastName,
  setLastName,
  email,
  setEmail,
  phone,
  setPhone,
  dob,
  setDob,
  unitApplied,
  setUnitApplied,
  leaseStartDate,
  setLeaseStartDate,
  streetNumber,
  setStreetNumber,
  streetName,
  setStreetName,
  city,
  setCity,
  province,
  setProvince,
  postalCode,
  setPostalCode,
  requestedRent,
  setRequestedRent,
}) => {
  return (
    <div>
      <div
        style={{
          marginBottom: "0.75rem",
          fontSize: "0.95rem",
          fontWeight: 600,
        }}
      >
        Step 1 – Your details
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "0.75rem",
          marginBottom: "0.6rem",
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
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "0.75rem",
          marginBottom: "0.6rem",
        }}
      >
        <div>
          <div style={labelStyle}>Middle name (optional)</div>
          <input
            type="text"
            value={middleName}
            onChange={(e) => setMiddleName(e.target.value)}
            style={fieldStyle}
            autoComplete="additional-name"
          />
        </div>
        <div>
          <div style={labelStyle}>Date of birth *</div>
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            style={fieldStyle}
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "0.75rem",
          marginBottom: "0.6rem",
        }}
      >
        <div>
          <div style={labelStyle}>Email *</div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={fieldStyle}
            autoComplete="email"
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
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "0.75rem",
          marginBottom: "0.6rem",
        }}
      >
        <div>
          <div style={labelStyle}>Unit applying to *</div>
          <input
            type="text"
            value={unitApplied}
            onChange={(e) => setUnitApplied(e.target.value)}
            style={fieldStyle}
            autoComplete="off"
          />
        </div>
        <div>
          <div style={labelStyle}>Lease start date *</div>
          <input
            type="date"
            value={leaseStartDate}
            onChange={(e) => setLeaseStartDate(e.target.value)}
            style={fieldStyle}
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "0.75rem",
          marginBottom: "0.6rem",
        }}
      >
        <div>
          <div style={labelStyle}>Street number *</div>
          <input
            type="text"
            value={streetNumber}
            onChange={(e) => setStreetNumber(e.target.value)}
            style={fieldStyle}
            autoComplete="address-line1"
          />
        </div>
        <div>
          <div style={labelStyle}>Street name *</div>
          <input
            type="text"
            value={streetName}
            onChange={(e) => setStreetName(e.target.value)}
            style={fieldStyle}
            autoComplete="address-line2"
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "0.75rem",
          marginBottom: "0.6rem",
        }}
      >
        <div>
          <div style={labelStyle}>City *</div>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            style={fieldStyle}
            autoComplete="address-level2"
          />
        </div>
        <div>
          <div style={labelStyle}>Province *</div>
          <input
            type="text"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            style={fieldStyle}
            autoComplete="address-level1"
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
          <div style={labelStyle}>Postal / ZIP *</div>
          <input
            type="text"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            style={fieldStyle}
            autoComplete="postal-code"
          />
        </div>
        <div>
          <div style={labelStyle}>Requested rent (per month) *</div>
          <input
            type="number"
            min={0}
            value={requestedRent}
            onChange={(e) => setRequestedRent(e.target.value)}
            style={fieldStyle}
            inputMode="decimal"
          />
        </div>
      </div>
    </div>
  );
};
const StepTwo: React.FC<StepTwoProps> = ({
  employer,
  setEmployer,
  position,
  setPosition,
  monthlyIncome,
  setMonthlyIncome,
}) => {
  return (
    <div>
      <div
        style={{
          marginBottom: "0.75rem",
          fontSize: "0.95rem",
          fontWeight: 600,
        }}
      >
        Step 2 – Employment & income
      </div>

      <div style={{ marginBottom: "0.6rem" }}>
        <div style={labelStyle}>Employer #1</div>
        <input
          type="text"
          value={employer}
          onChange={(e) => setEmployer(e.target.value)}
          style={fieldStyle}
        />
      </div>

      <div style={{ marginBottom: "0.6rem" }}>
        <div style={labelStyle}>Position</div>
        <input
          type="text"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          style={fieldStyle}
        />
      </div>

<div style={{ marginBottom: "0.6rem" }}>
        <div style={labelStyle}>Total monthly income (before tax)</div>
        <input
          type="number"
          value={monthlyIncome}
          onChange={(e) => setMonthlyIncome(e.target.value)}
          style={fieldStyle}
        />
        </div>
 <div style={{ marginBottom: "0.6rem" }}>
        <div style={labelStyle}>Employer #2</div>
        <input
          type="text"
          value={employer}
          onChange={(e) => setEmployer(e.target.value)}
          style={fieldStyle}
        />
      </div>

      <div style={{ marginBottom: "0.6rem" }}>
        <div style={labelStyle}>Position</div>
        <input
          type="text"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          style={fieldStyle}
        />
      </div>

<div style={{ marginBottom: "0.6rem" }}>
        <div style={labelStyle}>Total monthly income (before tax)</div>
        <input
          type="number"
          value={monthlyIncome}
          onChange={(e) => setMonthlyIncome(e.target.value)}
          style={fieldStyle}
        />
</div>

       <div style={{ marginBottom: "0.6rem" }}>
        <div style={labelStyle}>Employer #3</div>
        <input
          type="text"
          value={employer}
          onChange={(e) => setEmployer(e.target.value)}
          style={fieldStyle}
        />
      </div>

      <div style={{ marginBottom: "0.6rem" }}>
        <div style={labelStyle}>Position</div>
        <input
          type="text"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          style={fieldStyle}
        />
      </div>

      <div style={{ marginBottom: "0.6rem" }}>
        <div style={labelStyle}>Total monthly income (before tax)</div>
        <input
          type="number"
          value={monthlyIncome}
          onChange={(e) => setMonthlyIncome(e.target.value)}
          style={fieldStyle}
        />
      </div>

      <div
        style={{
          marginTop: "0.3rem",
          fontSize: "0.78rem",
          opacity: 0.75,
        }}
      >
        This information is used only for rental qualification and may be
        verified with your employer or pay stubs.
      </div>
    </div>
  );
};

interface StepThreeProps {
  hasCoApplicant: boolean;
  setHasCoApplicant: (v: boolean) => void;
  coFullName: string;
  setCoFullName: (v: string) => void;
  coEmail: string;
  setCoEmail: (v: string) => void;
  coPhone: string;
  setCoPhone: (v: string) => void;
  coMonthlyIncome: string;
  setCoMonthlyIncome: (v: string) => void;
  coAddress: string;
  setCoAddress: (v: string) => void;
  coCity: string;
  setCoCity: (v: string) => void;
  coProvinceState: string;
  setCoProvinceState: (v: string) => void;
  coPostalCode: string;
  setCoPostalCode: (v: string) => void;
  currentLandlordName: string;
  setCurrentLandlordName: (v: string) => void;
  currentLandlordPhone: string;
  setCurrentLandlordPhone: (v: string) => void;
  otherOccupants: string;
  setOtherOccupants: (v: string) => void;
  petDetails: string;
  setPetDetails: (v: string) => void;
  vehicleDetails: string;
  setVehicleDetails: (v: string) => void;
  additionalNotes: string;
  setAdditionalNotes: (v: string) => void;
}


const StepThree: React.FC<StepThreeProps> = ({
  hasCoApplicant,
  setHasCoApplicant,
  coFullName,
  setCoFullName,
  coEmail,
  setCoEmail,
  coPhone,
  setCoPhone,
  coMonthlyIncome,
  setCoMonthlyIncome,
  coAddress,
  setCoAddress,
  coCity,
  setCoCity,
  coProvinceState,
  setCoProvinceState,
  coPostalCode,
  setCoPostalCode,
  currentLandlordName,
  setCurrentLandlordName,
  currentLandlordPhone,
  setCurrentLandlordPhone,
  otherOccupants,
  setOtherOccupants,
  petDetails,
  setPetDetails,
  vehicleDetails,
  setVehicleDetails,
  additionalNotes,
  setAdditionalNotes,
}) => {
  return (
    <div>
      <div
        style={{
          marginBottom: "0.75rem",
          fontSize: "0.95rem",
          fontWeight: 600,
        }}
      >
        Step 3 – Co-applicant, household & references
      </div>

      <div
        style={{
          marginBottom: "0.5rem",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
        }}
      >
        <input
          id="hasCoApplicant"
          type="checkbox"
          checked={hasCoApplicant}
          onChange={(e) => setHasCoApplicant(e.target.checked)}
        />
        <label
          htmlFor="hasCoApplicant"
          style={{
            fontSize: "0.82rem",
          }}
        >
          There will be a co-applicant on this lease.
        </label>
      </div>

      {hasCoApplicant && (
        <div
          style={{
            borderRadius: "0.6rem",
            border: "1px solid rgba(51,65,85,0.9)",
            padding: "0.6rem 0.7rem",
            marginBottom: "0.8rem",
          }}
        >
          <div
            style={{
              fontSize: "0.82rem",
              marginBottom: "0.4rem",
              fontWeight: 500,
            }}
          >
            Co-applicant
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1.4fr)",
              gap: "0.6rem",
              marginBottom: "0.5rem",
            }}
          >          <div
            style={{
              marginTop: "0.6rem",
              marginBottom: "0.4rem",
              fontSize: "0.8rem",
              fontWeight: 500,
            }}
          >
            Co-applicant address
          </div>

          <div style={{ marginBottom: "0.5rem" }}>
            <div style={labelStyle}>Street address</div>
            <input
              type="text"
              value={coAddress}
              onChange={(e) => setCoAddress(e.target.value)}
              style={fieldStyle}
              autoComplete="street-address"
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              gap: "0.6rem",
              marginBottom: "0.5rem",
            }}
          >
            <div>
              <div style={labelStyle}>City</div>
              <input
                type="text"
                value={coCity}
                onChange={(e) => setCoCity(e.target.value)}
                style={fieldStyle}
                autoComplete="address-level2"
              />
            </div>
            <div>
              <div style={labelStyle}>Province / State</div>
              <input
                type="text"
                value={coProvinceState}
                onChange={(e) => setCoProvinceState(e.target.value)}
                style={fieldStyle}
                autoComplete="address-level1"
              />
            </div>
          </div>

          <div style={{ marginBottom: "0.2rem" }}>
            <div style={labelStyle}>Postal / ZIP code</div>
            <input
              type="text"
              value={coPostalCode}
              onChange={(e) =>
                setCoPostalCode(e.target.value.toUpperCase())
              }
              style={fieldStyle}
              autoComplete="postal-code"
            />
          </div>

            <div>
              <div style={labelStyle}>Full name</div>
              <input
                type="text"
                value={coFullName}
                onChange={(e) => setCoFullName(e.target.value)}
                style={fieldStyle}
              />
            </div>
            <div>
              <div style={labelStyle}>Email</div>
              <input
                type="email"
                value={coEmail}
                onChange={(e) => setCoEmail(e.target.value)}
                style={fieldStyle}
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1.2fr)",
              gap: "0.6rem",
            }}
          >
            <div>
              <div style={labelStyle}>Phone</div>
              <input
                type="tel"
                inputMode="tel"
                pattern="[0-9+ ]*"
                value={coPhone}
                onChange={(e) =>
                  setCoPhone(e.target.value.replace(/[^0-9+ ]/g, ""))
                }
                style={fieldStyle}
              />
            </div>
            <div>
              <div style={labelStyle}>Monthly income (before tax)</div>
              <input
                type="number"
                value={coMonthlyIncome}
                onChange={(e) => setCoMonthlyIncome(e.target.value)}
                style={fieldStyle}
              />
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: "0.4rem",
          marginBottom: "0.3rem",
          fontSize: "0.85rem",
          fontWeight: 500,
        }}
      >
        Current landlord reference
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1.2fr)",
          gap: "0.75rem",
          marginBottom: "0.5rem",
        }}
      >
        <div>
          <div style={labelStyle}>Landlord / building name</div>
          <input
            type="text"
            value={currentLandlordName}
            onChange={(e) => setCurrentLandlordName(e.target.value)}
            style={fieldStyle}
          />
        </div>
        <div>
          <div style={labelStyle}>Phone</div>
          <input
            type="tel"
            inputMode="tel"
            pattern="[0-9+ ]*"
            value={currentLandlordPhone}
            onChange={(e) =>
              setCurrentLandlordPhone(
                e.target.value.replace(/[^0-9+ ]/g, "")
              )
            }
            style={fieldStyle}
          />
        </div>
      </div>

      <div
        style={{
          marginTop: "0.4rem",
          marginBottom: "0.25rem",
          fontSize: "0.85rem",
          fontWeight: 500,
        }}
      >
        Household & other details
      </div>

      <div style={{ marginBottom: "0.5rem" }}>
        <div style={labelStyle}>
          Other occupants (names and ages of anyone else who will live in the
          unit)
        </div>
        <textarea
          value={otherOccupants}
          onChange={(e) => setOtherOccupants(e.target.value)}
          style={{
            ...fieldStyle,
            minHeight: "60px",
            resize: "vertical",
          }}
        />
      </div>

      <div style={{ marginBottom: "0.5rem" }}>
        <div style={labelStyle}>
          Pets (type, size, breed, how many – or &quot;none&quot;)
        </div>
        <textarea
          value={petDetails}
          onChange={(e) => setPetDetails(e.target.value)}
          style={{
            ...fieldStyle,
            minHeight: "60px",
            resize: "vertical",
          }}
        />
      </div>

      <div style={{ marginBottom: "0.5rem" }}>
        <div style={labelStyle}>
          Vehicles (make/model, color, license plate – or &quot;none&quot;)
        </div>
        <textarea
          value={vehicleDetails}
          onChange={(e) => setVehicleDetails(e.target.value)}
          style={{
            ...fieldStyle,
            minHeight: "60px",
            resize: "vertical",
          }}
        />
      </div>

      <div style={{ marginBottom: "0.5rem" }}>
        <div style={labelStyle}>Anything else you&apos;d like us to know</div>
        <textarea
          value={additionalNotes}
          onChange={(e) => setAdditionalNotes(e.target.value)}
          style={{
            ...fieldStyle,
            minHeight: "60px",
            resize: "vertical",
          }}
        />
      </div>

      <div
        style={{
          marginTop: "0.2rem",
          fontSize: "0.78rem",
          opacity: 0.75,
        }}
      >
        Your permission to contact your current landlord is requested in the
        next step as part of the consent section.
      </div>
    </div>
  );
};

interface StepFourProps {
  creditConsent: boolean;
  setCreditConsent: (v: boolean) => void;
  submitting: boolean;
}

const StepFour: React.FC<StepFourProps> = ({
  creditConsent,
  setCreditConsent,
  submitting,
}) => {
  return (
    <div>
      <div
        style={{
          marginBottom: "0.75rem",
          fontSize: "0.95rem",
          fontWeight: 600,
        }}
      >
        Step 4 – Consent & submit
      </div>

      <p
        style={{
          fontSize: "0.8rem",
          opacity: 0.9,
          marginBottom: "0.7rem",
        }}
      >
        By submitting this application you confirm that all information provided
        is true and complete to the best of your knowledge. You understand that
        providing false or incomplete information may result in your application
        being declined or your tenancy being terminated.
      </p>

      <p
        style={{
          fontSize: "0.8rem",
          opacity: 0.9,
          marginBottom: "0.7rem",
        }}
      >
        You authorize the landlord or property manager to obtain a consumer
        credit report, to contact your current and previous landlords, and to
        verify your employment and income for the purpose of assessing this
        rental application.
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.45rem",
          marginBottom: "0.4rem",
        }}
      >
        <input
          id="creditConsent"
          type="checkbox"
          checked={creditConsent}
          onChange={(e) => setCreditConsent(e.target.checked)}
          disabled={submitting}
        />
        <label
          htmlFor="creditConsent"
          style={{
            fontSize: "0.82rem",
          }}
        >
          I agree to the above and authorize a credit and reference check.
        </label>
      </div>

      <div
        style={{
          fontSize: "0.78rem",
          opacity: 0.75,
        }}
      >
        You may withdraw your consent at any time before a lease is signed by
        contacting the landlord or property manager.
      </div>
    </div>
  );
};

export default ApplyPage;
