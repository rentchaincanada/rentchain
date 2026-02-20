import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  fetchPublicApplicationLink,
  submitPublicApplication,
  type RentalApplicationPayload,
} from "@/api/publicApplications";

type ApplyParams = {
  token?: string;
};

type HistoryEntry = RentalApplicationPayload["residentialHistory"][number];
type ResidentEntry = { name: string; relationship: string; age: number | null };
type LoanEntry = NonNullable<RentalApplicationPayload["loans"]>[number];
type VehicleEntry = NonNullable<RentalApplicationPayload["vehicles"]>[number];

const steps = ["Personal info", "Residential history", "Employment", "References + assets", "Consent"];

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
  background: "#fff",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontWeight: 600,
};

function emptyHistory(): HistoryEntry {
  return {
    address: "",
    durationMonths: null,
    rentAmountCents: null,
    landlordName: null,
    landlordPhone: null,
    reasonForLeaving: null,
  };
}

function parseCents(value: string): number | null {
  const clean = value.replace(/[^0-9.]/g, "");
  if (!clean) return null;
  const num = Number(clean);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function decimalOnly(value: string) {
  const clean = value.replace(/[^0-9.]/g, "");
  const firstDot = clean.indexOf(".");
  if (firstDot === -1) return clean;
  return `${clean.slice(0, firstDot + 1)}${clean.slice(firstDot + 1).replace(/\./g, "")}`;
}

function isValidDob(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default function PublicApplyPage() {
  const { token } = useParams<ApplyParams>();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [context, setContext] = useState<{ propertyName?: string | null; unitLabel?: string | null }>({});
  const [linkData, setLinkData] = useState<{ propertyId?: string | null; unitId?: string | null; expiresAt?: number | null }>({});

  const [applicant, setApplicant] = useState<Partial<RentalApplicationPayload["applicant"]>>({
    firstName: "",
    middleInitial: null,
    lastName: "",
    email: "",
    phoneHome: null,
    phoneWork: null,
    dob: "",
    maritalStatus: null,
  });
  const [coApplicantEnabled, setCoApplicantEnabled] = useState(false);
  const [coApplicant, setCoApplicant] = useState<Partial<NonNullable<RentalApplicationPayload["coApplicant"]>>>({
    firstName: "",
    middleInitial: null,
    lastName: "",
    email: "",
    phoneHome: null,
    phoneWork: null,
    dob: "",
    maritalStatus: null,
  });
  const [otherResidents, setOtherResidents] = useState<ResidentEntry[]>([{ name: "", relationship: "", age: null }]);
  const [residentialHistory, setResidentialHistory] = useState<HistoryEntry[]>([
    emptyHistory(),
    emptyHistory(),
    emptyHistory(),
  ]);
  const [profileAddress, setProfileAddress] = useState({
    line1: "",
    line2: "",
    city: "",
    provinceState: "",
    postalCode: "",
    country: "CA",
  });
  const [timeAtAddressMonths, setTimeAtAddressMonths] = useState("");
  const [currentRentAmount, setCurrentRentAmount] = useState("");
  const [employment, setEmployment] = useState<RentalApplicationPayload["employment"]>({
    applicant: {
      status: null,
      jobTitle: "",
      employer: "",
      employerAddress: "",
      supervisor: "",
      phone: "",
      monthlyIncomeCents: null,
      incomeType: null,
      lengthMonths: null,
    },
    coApplicant: {
      status: null,
      jobTitle: "",
      employer: "",
      employerAddress: "",
      supervisor: "",
      phone: "",
      monthlyIncomeCents: null,
      incomeType: null,
      lengthMonths: null,
    },
  });
  const [references, setReferences] = useState<RentalApplicationPayload["references"]>({
    bank: { name: "", address: "" },
    applicantPersonal: { name: "", relationship: "", phone: "", address: "" },
    coApplicantPersonal: { name: "", relationship: "", phone: "", address: "" },
  });
  const [workReferenceName, setWorkReferenceName] = useState("");
  const [workReferencePhone, setWorkReferencePhone] = useState("");
  const [loans, setLoans] = useState<LoanEntry[]>([
    { institution: "", address: "", monthlyPaymentCents: null, balanceCents: null },
  ]);
  const [vehicles, setVehicles] = useState<VehicleEntry[]>([
    { makeModel: "", year: "", color: "", plate: "", province: "" },
  ]);
  const [nextOfKin, setNextOfKin] = useState<RentalApplicationPayload["nextOfKin"]>({
    name: "",
    relationship: "",
    phone: "",
    address: "",
  });
  const [coNextOfKin, setCoNextOfKin] = useState<RentalApplicationPayload["coNextOfKin"]>({
    name: "",
    relationship: "",
    phone: "",
    address: "",
  });
  const [consent, setConsent] = useState<RentalApplicationPayload["consent"]>({
    creditConsent: false,
    referenceConsent: false,
    dataSharingConsent: false,
    acceptedAt: null,
    applicantNameTyped: "",
    coApplicantNameTyped: "",
  });
  const [signatureTypedName, setSignatureTypedName] = useState("");
  const [signatureTypedAck, setSignatureTypedAck] = useState(false);
  const [applicationConsentAccepted, setApplicationConsentAccepted] = useState(false);
  const [applicantNotes, setApplicantNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const updateApplicant = (value: Partial<RentalApplicationPayload["applicant"]>) => {
    setApplicant((prev) => {
      const next = { ...(prev || {}), ...value };
      return {
        ...next,
        firstName: (next.firstName ?? "").trim(),
        lastName: (next.lastName ?? "").trim(),
        email: (next.email ?? "").trim(),
        dob: (next.dob ?? "").trim(),
      };
    });
  };

  const updateCoApplicant = (value: Partial<NonNullable<RentalApplicationPayload["coApplicant"]>>) => {
    setCoApplicant((prev) => {
      const next = { ...(prev || {}), ...value };
      return {
        ...next,
        firstName: (next.firstName ?? "").trim(),
        lastName: (next.lastName ?? "").trim(),
        email: (next.email ?? "").trim(),
        dob: (next.dob ?? "").trim(),
      };
    });
  };
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!token) {
        setError("Missing application link token.");
        setLoading(false);
        return;
      }
      setError(null);
      try {
        const res = await fetchPublicApplicationLink(token);
        if (!alive) return;
        setContext(res.context || {});
        setLinkData(res.data || {});
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "This application link is invalid or expired.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [token]);

  const header = (
    <div style={{ marginBottom: 16 }}>
      <h1 style={{ margin: 0, fontSize: "1.6rem" }}>Rental application</h1>
      <div style={{ opacity: 0.8, fontSize: "0.95rem" }}>
        {context.propertyName || "Property"} {context.unitLabel ? `- Unit ${context.unitLabel}` : ""}
      </div>
    </div>
  );

  const expiryNote = useMemo(() => {
    if (!linkData?.expiresAt) return null;
    const d = new Date(linkData.expiresAt);
    if (Number.isNaN(d.getTime())) return null;
    return `Link expires ${d.toLocaleDateString()}`;
  }, [linkData?.expiresAt]);

  const updateHistory = (index: number, patch: Partial<HistoryEntry>) => {
    setResidentialHistory((prev) => prev.map((h, i) => (i === index ? { ...h, ...patch } : h)));
  };

  const updateResident = (index: number, patch: Partial<ResidentEntry>) => {
    setOtherResidents((prev) => prev.map((h, i) => (i === index ? { ...h, ...patch } : h)));
  };

  const updateLoan = (index: number, patch: Partial<LoanEntry>) => {
    setLoans((prev) => prev.map((h, i) => (i === index ? { ...h, ...patch } : h)));
  };

  const updateVehicle = (index: number, patch: Partial<VehicleEntry>) => {
    setVehicles((prev) => prev.map((h, i) => (i === index ? { ...h, ...patch } : h)));
  };

  const canContinue = () => {
    if (step === 0) {
      const dobValue = (applicant.dob ?? "").trim();
      return (
        (applicant.firstName ?? "").trim() &&
        (applicant.lastName ?? "").trim() &&
        (applicant.email ?? "").trim() &&
        dobValue &&
        isValidDob(dobValue)
      );
    }
    if (step === 1) {
      return (
        profileAddress.line1.trim() &&
        profileAddress.city.trim() &&
        profileAddress.provinceState.trim() &&
        profileAddress.postalCode.trim() &&
        timeAtAddressMonths.trim() &&
        currentRentAmount.trim()
      );
    }
    if (step === 2) {
      return (
        (employment.applicant.employer || "").trim() &&
        (employment.applicant.jobTitle || "").trim() &&
        Number(employment.applicant.monthlyIncomeCents || 0) > 0 &&
        employment.applicant.lengthMonths != null
      );
    }
    if (step === 4) {
      const hasApplicantSig = (consent.applicantNameTyped || "").trim();
      const hasCoSig = !coApplicantEnabled || (consent.coApplicantNameTyped || "").trim();
      return (
        consent.creditConsent &&
        consent.referenceConsent &&
        consent.dataSharingConsent &&
        hasApplicantSig &&
        hasCoSig &&
        signatureTypedName.trim() &&
        signatureTypedAck &&
        applicationConsentAccepted
      );
    }
    return true;
  };

  async function handleSubmit() {
    if (!token) {
      setError("Missing application link token.");
      return;
    }
    if (!profileAddress.line1.trim() || !profileAddress.city.trim() || !profileAddress.provinceState.trim() || !profileAddress.postalCode.trim()) {
      setError("Current address is required for screening.");
      setStep(1);
      return;
    }
    if (!timeAtAddressMonths.trim() || !currentRentAmount.trim()) {
      setError("Time at current address and current rent are required.");
      setStep(1);
      return;
    }
    if (!(employment.applicant.employer || "").trim() || !(employment.applicant.jobTitle || "").trim()) {
      setError("Employment details are required.");
      setStep(2);
      return;
    }
    if (!employment.applicant.monthlyIncomeCents || employment.applicant.monthlyIncomeCents <= 0) {
      setError("Income amount is required.");
      setStep(2);
      return;
    }
    if (employment.applicant.lengthMonths == null) {
      setError("Time at current job is required.");
      setStep(2);
      return;
    }
    if (!workReferenceName.trim() || !workReferencePhone.trim()) {
      setError("Work reference name and phone are required.");
      setStep(3);
      return;
    }
    const normalizedApplicant = {
      firstName: (applicant.firstName ?? "").trim(),
      lastName: (applicant.lastName ?? "").trim(),
      email: (applicant.email ?? "").trim(),
      dob: (applicant.dob ?? "").trim(),
      middleInitial: applicant.middleInitial ?? null,
      phoneHome: applicant.phoneHome ? digitsOnly(applicant.phoneHome) : null,
      phoneWork: applicant.phoneWork ? digitsOnly(applicant.phoneWork) : null,
      maritalStatus: applicant.maritalStatus ?? null,
    };
    const normalizedCoApplicant = coApplicantEnabled
      ? {
          firstName: (coApplicant.firstName ?? "").trim(),
          lastName: (coApplicant.lastName ?? "").trim(),
          email: (coApplicant.email ?? "").trim(),
          dob: (coApplicant.dob ?? "").trim(),
          middleInitial: coApplicant.middleInitial ?? null,
          phoneHome: coApplicant.phoneHome ? digitsOnly(coApplicant.phoneHome) : null,
          phoneWork: coApplicant.phoneWork ? digitsOnly(coApplicant.phoneWork) : null,
          maritalStatus: coApplicant.maritalStatus ?? null,
        }
      : null;
    const dobValue = normalizedApplicant.dob;
    if (!dobValue) {
      setError("Date of birth is required for screening.");
      setStep(0);
      return;
    }
    if (!isValidDob(dobValue)) {
      setError("Date of birth must be YYYY-MM-DD.");
      setStep(0);
      return;
    }
    if (
      normalizedCoApplicant &&
      (!normalizedCoApplicant.firstName ||
        !normalizedCoApplicant.lastName ||
        !normalizedCoApplicant.email ||
        !normalizedCoApplicant.dob)
    ) {
      setError("Please complete co-applicant required fields.");
      setStep(0);
      return;
    }
    if (normalizedCoApplicant && !isValidDob(normalizedCoApplicant.dob)) {
      setError("Co-applicant date of birth must be YYYY-MM-DD.");
      setStep(0);
      return;
    }
    if (!normalizedApplicant.firstName || !normalizedApplicant.lastName || !normalizedApplicant.email) {
      setError("Please complete required fields.");
      setStep(0);
      return;
    }
    if (!consent.creditConsent) {
      setError("Consent for credit screening is required.");
      setStep(4);
      return;
    }
    if (!consent.referenceConsent) {
      setError("Consent to contact references is required.");
      setStep(4);
      return;
    }
    if (!signatureTypedName.trim() || !signatureTypedAck) {
      setError("Signature is required to submit.");
      setStep(4);
      return;
    }
    if (!applicationConsentAccepted) {
      setError("Application consent is required.");
      setStep(4);
      return;
    }
    if (!canContinue()) {
      setError("Please complete required fields.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const history = residentialHistory.map((entry, idx) => {
        if (idx !== 0) return entry;
        return {
          ...entry,
          address: [profileAddress.line1, profileAddress.line2, profileAddress.city, profileAddress.provinceState, profileAddress.postalCode]
            .filter(Boolean)
            .join(", "),
          durationMonths: Number(timeAtAddressMonths) || null,
          rentAmountCents: parseCents(currentRentAmount),
        };
      });
      const payload: RentalApplicationPayload = {
        token,
        applicant: normalizedApplicant,
        coApplicant: normalizedCoApplicant,
        otherResidents: otherResidents.filter((r) => r.name.trim()),
        residentialHistory: history.filter((h) => h.address.trim()),
        employment: {
          applicant: { ...employment.applicant, incomeType: "GROSS" },
          coApplicant: coApplicantEnabled
            ? employment.coApplicant
              ? { ...employment.coApplicant, incomeType: "GROSS" }
              : null
            : null,
        },
        references: references || null,
        loans: loans.filter((l) => l.institution || l.address || l.monthlyPaymentCents || l.balanceCents),
        vehicles: vehicles.filter((v) => v.makeModel || v.plate),
        nextOfKin: nextOfKin || null,
        coNextOfKin: coApplicantEnabled ? coNextOfKin ?? null : null,
        consent: {
          ...consent,
          acceptedAt: Date.now(),
        },
        applicantProfile: {
          currentAddress: {
            line1: profileAddress.line1,
            line2: profileAddress.line2 || undefined,
            city: profileAddress.city,
            provinceState: profileAddress.provinceState,
            postalCode: profileAddress.postalCode,
            country: "CA",
          },
          timeAtCurrentAddressMonths: Number(timeAtAddressMonths) || 0,
          currentRentAmountCents: parseCents(currentRentAmount) || 0,
          employment: {
            employerName: employment.applicant.employer || "",
            jobTitle: employment.applicant.jobTitle || "",
            incomeAmountCents: employment.applicant.monthlyIncomeCents || 0,
            incomeFrequency: "monthly",
            monthsAtJob: employment.applicant.lengthMonths || 0,
          },
          workReference: {
            name: workReferenceName.trim(),
            phone: digitsOnly(workReferencePhone),
          },
          signature: {
            type: "typed",
            typedName: signatureTypedName.trim(),
            typedAcknowledge: signatureTypedAck,
            signedAt: new Date().toISOString(),
          },
          applicantNotes: applicantNotes || undefined,
        },
        applicationConsent: {
          version: "v1.0",
          accepted: true,
          acceptedAt: new Date().toISOString(),
        },
        formVersion: "v2",
      };
      const resp = await submitPublicApplication(payload);
      setSubmitted(true);
      setApplicationId(resp.applicationId || null);
    } catch (e: any) {
      setError(e?.message || "Could not submit application.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 760, margin: "40px auto", padding: "0 16px" }}>
        {header}
        <div>Loading application.</div>
      </div>
    );
  }

  if (error && !submitted) {
    return (
      <div style={{ maxWidth: 760, margin: "40px auto", padding: "0 16px" }}>
        {header}
        <div style={{ border: "1px solid #fca5a5", background: "#fef2f2", padding: 12, borderRadius: 8 }}>
          {error}
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ maxWidth: 760, margin: "40px auto", padding: "0 16px" }}>
        {header}
        <div style={{ border: "1px solid #c7f9cc", background: "#f0fff4", padding: 14, borderRadius: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Application submitted</div>
          <div style={{ opacity: 0.85 }}>
            Thank you for applying. A property manager may contact you if additional information is needed.
          </div>
          {applicationId ? (
            <div style={{ marginTop: 8, fontSize: "0.9rem" }}>
              Reference ID: <code>{applicationId}</code>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: "40px auto", padding: "0 16px" }}>
      {header}
      {expiryNote ? <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>{expiryNote}</div> : null}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {steps.map((label, idx) => (
          <div
            key={label}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              fontSize: "0.85rem",
              border: "1px solid #e5e7eb",
              background: idx === step ? "#111827" : "#f8fafc",
              color: idx === step ? "#fff" : "#374151",
            }}
          >
            {idx + 1}. {label}
          </div>
        ))}
      </div>

      <div style={cardStyle}>
        {step === 0 ? (
          <>
            <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>Personal information</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
              <label style={labelStyle}>
                First name *
                <input value={applicant.firstName ?? ""} onChange={(e) => updateApplicant({ firstName: e.target.value })} />
              </label>
              <label style={labelStyle}>
                Middle initial
                <input value={applicant.middleInitial || ""} onChange={(e) => updateApplicant({ middleInitial: e.target.value })} />
              </label>
              <label style={labelStyle}>
                Last name *
                <input value={applicant.lastName ?? ""} onChange={(e) => updateApplicant({ lastName: e.target.value })} />
              </label>
              <label style={labelStyle}>
                Email *
                <input type="email" value={applicant.email ?? ""} onChange={(e) => updateApplicant({ email: e.target.value })} />
              </label>
              <label style={labelStyle}>
                Phone (home)
                <input
                  type="tel"
                  inputMode="tel"
                  pattern="[0-9]*"
                  value={applicant.phoneHome || ""}
                  onChange={(e) => updateApplicant({ phoneHome: digitsOnly(e.target.value) })}
                />
              </label>
              <label style={labelStyle}>
                Phone (work)
                <input
                  type="tel"
                  inputMode="tel"
                  pattern="[0-9]*"
                  value={applicant.phoneWork || ""}
                  onChange={(e) => updateApplicant({ phoneWork: digitsOnly(e.target.value) })}
                />
              </label>
              <label style={labelStyle}>
                Date of birth *
                <input type="date" value={applicant.dob || ""} onChange={(e) => updateApplicant({ dob: e.target.value })} />
              </label>
              <label style={labelStyle}>
                Marital status
                <select
                  value={applicant.maritalStatus || ""}
                  onChange={(e) => updateApplicant({ maritalStatus: (e.target.value as any) || null })}
                >
                  <option value="">Select</option>
                  <option value="SINGLE">Single</option>
                  <option value="MARRIED">Married</option>
                  <option value="DIVORCED">Divorced</option>
                  <option value="COMMON_LAW">Common-law</option>
                </select>
              </label>
            </div>

            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={coApplicantEnabled} onChange={(e) => setCoApplicantEnabled(e.target.checked)} />
              Add co-applicant
            </label>

            {coApplicantEnabled ? (
              <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12, display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 700 }}>Co-applicant</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
                  <label style={labelStyle}>
                    First name *
                    <input value={coApplicant?.firstName || ""} onChange={(e) => updateCoApplicant({ firstName: e.target.value })} />
                  </label>
                  <label style={labelStyle}>
                    Middle initial
                    <input value={coApplicant?.middleInitial || ""} onChange={(e) => updateCoApplicant({ middleInitial: e.target.value })} />
                  </label>
                  <label style={labelStyle}>
                    Last name *
                    <input value={coApplicant?.lastName || ""} onChange={(e) => updateCoApplicant({ lastName: e.target.value })} />
                  </label>
                  <label style={labelStyle}>
                    Email *
                    <input type="email" value={coApplicant?.email || ""} onChange={(e) => updateCoApplicant({ email: e.target.value })} />
                  </label>
                  <label style={labelStyle}>
                    Phone (home)
                    <input
                      type="tel"
                      inputMode="tel"
                      pattern="[0-9]*"
                      value={coApplicant?.phoneHome || ""}
                      onChange={(e) => updateCoApplicant({ phoneHome: digitsOnly(e.target.value) })}
                    />
                  </label>
                  <label style={labelStyle}>
                    Phone (work)
                    <input
                      type="tel"
                      inputMode="tel"
                      pattern="[0-9]*"
                      value={coApplicant?.phoneWork || ""}
                      onChange={(e) => updateCoApplicant({ phoneWork: digitsOnly(e.target.value) })}
                    />
                  </label>
                  <label style={labelStyle}>
                    Date of birth *
                    <input type="date" value={coApplicant?.dob || ""} onChange={(e) => updateCoApplicant({ dob: e.target.value })} />
                  </label>
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>Residential history</div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 600 }}>Current address *</div>
              <label style={labelStyle}>
                Address line 1 *
                <input
                  value={profileAddress.line1}
                  onChange={(e) => setProfileAddress({ ...profileAddress, line1: e.target.value })}
                />
              </label>
              <label style={labelStyle}>
                Address line 2
                <input
                  value={profileAddress.line2}
                  onChange={(e) => setProfileAddress({ ...profileAddress, line2: e.target.value })}
                />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
                <label style={labelStyle}>
                  City *
                  <input
                    value={profileAddress.city}
                    onChange={(e) => setProfileAddress({ ...profileAddress, city: e.target.value })}
                  />
                </label>
                <label style={labelStyle}>
                  Province *
                  <input
                    value={profileAddress.provinceState}
                    onChange={(e) => setProfileAddress({ ...profileAddress, provinceState: e.target.value })}
                  />
                </label>
                <label style={labelStyle}>
                  Postal code *
                  <input
                    value={profileAddress.postalCode}
                    onChange={(e) => setProfileAddress({ ...profileAddress, postalCode: e.target.value.toUpperCase() })}
                  />
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
                <label style={labelStyle}>
                  Time at current address (months) *
                  <input
                    inputMode="numeric"
                    value={timeAtAddressMonths}
                    onChange={(e) => setTimeAtAddressMonths(digitsOnly(e.target.value))}
                  />
                </label>
                <label style={labelStyle}>
                  Current rent amount (monthly) *
                  <input
                    inputMode="decimal"
                    value={currentRentAmount}
                    onChange={(e) => setCurrentRentAmount(decimalOnly(e.target.value))}
                  />
                </label>
              </div>
            </div>
            {residentialHistory.map((entry, idx) => (
              <div key={idx} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 600 }}>Address {idx + 1}</div>
                <label style={labelStyle}>
                  {idx === 0 ? "Current address *" : "Address"}
                  <input value={entry.address} onChange={(e) => updateHistory(idx, { address: e.target.value })} />
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
                  <label style={labelStyle}>
                    Duration (months)
                    <input
                      inputMode="numeric"
                      value={entry.durationMonths ?? ""}
                      onChange={(e) => updateHistory(idx, { durationMonths: e.target.value ? Number(digitsOnly(e.target.value)) : null })}
                    />
                  </label>
                  <label style={labelStyle}>
                    Rent amount (monthly)
                    <input
                      value={entry.rentAmountCents ? `${entry.rentAmountCents / 100}` : ""}
                      onChange={(e) => updateHistory(idx, { rentAmountCents: parseCents(e.target.value) })}
                    />
                  </label>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
                  <label style={labelStyle}>
                    Landlord name
                    <input value={entry.landlordName || ""} onChange={(e) => updateHistory(idx, { landlordName: e.target.value })} />
                  </label>
                  <label style={labelStyle}>
                    Landlord phone
                    <input
                      type="tel"
                      inputMode="tel"
                      pattern="[0-9]*"
                      value={entry.landlordPhone || ""}
                      onChange={(e) => updateHistory(idx, { landlordPhone: digitsOnly(e.target.value) })}
                    />
                  </label>
                </div>
                <label style={labelStyle}>
                  Reason for leaving
                  <input value={entry.reasonForLeaving || ""} onChange={(e) => updateHistory(idx, { reasonForLeaving: e.target.value })} />
                </label>
              </div>
            ))}

            <div style={{ fontWeight: 700 }}>Other residents</div>
            {otherResidents.map((entry, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8 }}>
                <label style={labelStyle}>
                  Name
                  <input value={entry.name} onChange={(e) => updateResident(idx, { name: e.target.value })} />
                </label>
                <label style={labelStyle}>
                  Relationship
                  <input value={entry.relationship} onChange={(e) => updateResident(idx, { relationship: e.target.value })} />
                </label>
                <label style={labelStyle}>
                  Age
                  <input
                    inputMode="numeric"
                    value={entry.age ?? ""}
                    onChange={(e) => updateResident(idx, { age: e.target.value ? Number(digitsOnly(e.target.value)) : null })}
                  />
                </label>
              </div>
            ))}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>Employment & income</div>
            <div style={{ fontWeight: 600 }}>Applicant</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8 }}>
              <label style={labelStyle}>
                Status
                <select
                  value={employment.applicant.status || ""}
                  onChange={(e) => setEmployment({ ...employment, applicant: { ...employment.applicant, status: (e.target.value as any) || null } })}
                >
                  <option value="">Select</option>
                  <option value="FULL_TIME">Full-time</option>
                  <option value="PART_TIME">Part-time</option>
                  <option value="STUDENT">Student</option>
                  <option value="RETIRED">Retired</option>
                  <option value="UNEMPLOYED">Unemployed</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              <label style={labelStyle}>
                Employer *
                <input value={employment.applicant.employer || ""} onChange={(e) => setEmployment({ ...employment, applicant: { ...employment.applicant, employer: e.target.value } })} />
              </label>
              <label style={labelStyle}>
                Job title *
                <input value={employment.applicant.jobTitle || ""} onChange={(e) => setEmployment({ ...employment, applicant: { ...employment.applicant, jobTitle: e.target.value } })} />
              </label>
              <label style={labelStyle}>
                Supervisor
                <input value={employment.applicant.supervisor || ""} onChange={(e) => setEmployment({ ...employment, applicant: { ...employment.applicant, supervisor: e.target.value } })} />
              </label>
              <label style={labelStyle}>
                Phone
                <input
                  type="tel"
                  inputMode="tel"
                  pattern="[0-9]*"
                  value={employment.applicant.phone || ""}
                  onChange={(e) =>
                    setEmployment({
                      ...employment,
                      applicant: { ...employment.applicant, phone: digitsOnly(e.target.value) },
                    })
                  }
                />
              </label>
              <label style={labelStyle}>
                Gross income (monthly) *
                <input
                  inputMode="decimal"
                  value={employment.applicant.monthlyIncomeCents ? `${employment.applicant.monthlyIncomeCents / 100}` : ""}
                  onChange={(e) =>
                    setEmployment({
                      ...employment,
                      applicant: { ...employment.applicant, monthlyIncomeCents: parseCents(decimalOnly(e.target.value)) },
                    })
                  }
                />
              </label>
              <label style={labelStyle}>
                Length (months) *
                <input
                  inputMode="numeric"
                  value={employment.applicant.lengthMonths ?? ""}
                  onChange={(e) =>
                    setEmployment({
                      ...employment,
                      applicant: {
                        ...employment.applicant,
                        lengthMonths: e.target.value ? Number(digitsOnly(e.target.value)) : null,
                      },
                    })
                  }
                />
              </label>
              <label style={labelStyle}>
                Employer address
                <input value={employment.applicant.employerAddress || ""} onChange={(e) => setEmployment({ ...employment, applicant: { ...employment.applicant, employerAddress: e.target.value } })} />
              </label>
            </div>

            {coApplicantEnabled ? (
              <>
                <div style={{ fontWeight: 600, marginTop: 12 }}>Co-applicant</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8 }}>
                  <label style={labelStyle}>
                    Status
                    <select
                      value={employment.coApplicant?.status || ""}
                      onChange={(e) => setEmployment({ ...employment, coApplicant: { ...employment.coApplicant, status: (e.target.value as any) || null } })}
                    >
                      <option value="">Select</option>
                      <option value="FULL_TIME">Full-time</option>
                      <option value="PART_TIME">Part-time</option>
                      <option value="STUDENT">Student</option>
                      <option value="RETIRED">Retired</option>
                      <option value="UNEMPLOYED">Unemployed</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </label>
                  <label style={labelStyle}>
                    Employer
                    <input value={employment.coApplicant?.employer || ""} onChange={(e) => setEmployment({ ...employment, coApplicant: { ...employment.coApplicant, employer: e.target.value } })} />
                  </label>
                  <label style={labelStyle}>
                    Job title
                    <input value={employment.coApplicant?.jobTitle || ""} onChange={(e) => setEmployment({ ...employment, coApplicant: { ...employment.coApplicant, jobTitle: e.target.value } })} />
                  </label>
                  <label style={labelStyle}>
                    Supervisor
                    <input value={employment.coApplicant?.supervisor || ""} onChange={(e) => setEmployment({ ...employment, coApplicant: { ...employment.coApplicant, supervisor: e.target.value } })} />
                  </label>
                  <label style={labelStyle}>
                    Phone
                    <input
                      type="tel"
                      inputMode="tel"
                      pattern="[0-9]*"
                      value={employment.coApplicant?.phone || ""}
                      onChange={(e) =>
                        setEmployment({
                          ...employment,
                          coApplicant: { ...employment.coApplicant, phone: digitsOnly(e.target.value) },
                        })
                      }
                    />
                  </label>
                  <label style={labelStyle}>
                    Gross income (monthly)
                    <input
                      inputMode="decimal"
                      value={employment.coApplicant?.monthlyIncomeCents ? `${employment.coApplicant?.monthlyIncomeCents / 100}` : ""}
                      onChange={(e) =>
                        setEmployment({
                          ...employment,
                          coApplicant: {
                            ...employment.coApplicant,
                            monthlyIncomeCents: parseCents(decimalOnly(e.target.value)),
                          },
                        })
                      }
                    />
                  </label>
                  <label style={labelStyle}>
                    Length (months)
                    <input
                      inputMode="numeric"
                      value={employment.coApplicant?.lengthMonths ?? ""}
                      onChange={(e) =>
                        setEmployment({
                          ...employment,
                          coApplicant: {
                            ...employment.coApplicant,
                            lengthMonths: e.target.value ? Number(digitsOnly(e.target.value)) : null,
                          },
                        })
                      }
                    />
                  </label>
                  <label style={labelStyle}>
                    Employer address
                    <input value={employment.coApplicant?.employerAddress || ""} onChange={(e) => setEmployment({ ...employment, coApplicant: { ...employment.coApplicant, employerAddress: e.target.value } })} />
                  </label>
                </div>
              </>
            ) : null}
          </>
        ) : null}
        {step === 3 ? (
          <>
            <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>References, loans, vehicles</div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 600 }}>Work reference *</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8 }}>
                <label style={labelStyle}>
                  Reference name *
                  <input value={workReferenceName} onChange={(e) => setWorkReferenceName(e.target.value)} />
                </label>
                <label style={labelStyle}>
                  Reference phone *
                  <input
                    type="tel"
                    inputMode="tel"
                    pattern="[0-9]*"
                    value={workReferencePhone}
                    onChange={(e) => setWorkReferencePhone(digitsOnly(e.target.value))}
                  />
                </label>
              </div>
            </div>
            <div style={{ fontWeight: 600 }}>Bank reference</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8 }}>
              <label style={labelStyle}>
                Bank name
                <input value={references?.bank?.name || ""} onChange={(e) => setReferences({ ...references, bank: { ...references?.bank, name: e.target.value } })} />
              </label>
              <label style={labelStyle}>
                Bank address
                <input value={references?.bank?.address || ""} onChange={(e) => setReferences({ ...references, bank: { ...references?.bank, address: e.target.value } })} />
              </label>
            </div>

            <div style={{ fontWeight: 600 }}>Personal references</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8 }}>
              <label style={labelStyle}>
                Applicant reference name
                <input value={references?.applicantPersonal?.name || ""} onChange={(e) => setReferences({ ...references, applicantPersonal: { ...references?.applicantPersonal, name: e.target.value } })} />
              </label>
              <label style={labelStyle}>
                Relationship
                <input value={references?.applicantPersonal?.relationship || ""} onChange={(e) => setReferences({ ...references, applicantPersonal: { ...references?.applicantPersonal, relationship: e.target.value } })} />
              </label>
              <label style={labelStyle}>
                Phone
                <input
                  type="tel"
                  inputMode="tel"
                  pattern="[0-9]*"
                  value={references?.applicantPersonal?.phone || ""}
                  onChange={(e) =>
                    setReferences({
                      ...references,
                      applicantPersonal: { ...references?.applicantPersonal, phone: digitsOnly(e.target.value) },
                    })
                  }
                />
              </label>
              <label style={labelStyle}>
                Address
                <input value={references?.applicantPersonal?.address || ""} onChange={(e) => setReferences({ ...references, applicantPersonal: { ...references?.applicantPersonal, address: e.target.value } })} />
              </label>
            </div>

            {coApplicantEnabled ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8 }}>
                <label style={labelStyle}>
                  Co-applicant reference name
                  <input value={references?.coApplicantPersonal?.name || ""} onChange={(e) => setReferences({ ...references, coApplicantPersonal: { ...references?.coApplicantPersonal, name: e.target.value } })} />
                </label>
                <label style={labelStyle}>
                  Relationship
                  <input value={references?.coApplicantPersonal?.relationship || ""} onChange={(e) => setReferences({ ...references, coApplicantPersonal: { ...references?.coApplicantPersonal, relationship: e.target.value } })} />
                </label>
                <label style={labelStyle}>
                  Phone
                  <input
                    type="tel"
                    inputMode="tel"
                    pattern="[0-9]*"
                    value={references?.coApplicantPersonal?.phone || ""}
                    onChange={(e) =>
                      setReferences({
                        ...references,
                        coApplicantPersonal: { ...references?.coApplicantPersonal, phone: digitsOnly(e.target.value) },
                      })
                    }
                  />
                </label>
                <label style={labelStyle}>
                  Address
                  <input value={references?.coApplicantPersonal?.address || ""} onChange={(e) => setReferences({ ...references, coApplicantPersonal: { ...references?.coApplicantPersonal, address: e.target.value } })} />
                </label>
              </div>
            ) : null}

            <div style={{ fontWeight: 600 }}>Loans</div>
            {loans.map((entry, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8 }}>
                <label style={labelStyle}>
                  Institution
                  <input value={entry.institution || ""} onChange={(e) => updateLoan(idx, { institution: e.target.value })} />
                </label>
                <label style={labelStyle}>
                  Address
                  <input value={entry.address || ""} onChange={(e) => updateLoan(idx, { address: e.target.value })} />
                </label>
                <label style={labelStyle}>
                  Monthly payment
                  <input
                    inputMode="decimal"
                    value={entry.monthlyPaymentCents ? `${entry.monthlyPaymentCents / 100}` : ""}
                    onChange={(e) => updateLoan(idx, { monthlyPaymentCents: parseCents(decimalOnly(e.target.value)) })}
                  />
                </label>
                <label style={labelStyle}>
                  Balance
                  <input
                    inputMode="decimal"
                    value={entry.balanceCents ? `${entry.balanceCents / 100}` : ""}
                    onChange={(e) => updateLoan(idx, { balanceCents: parseCents(decimalOnly(e.target.value)) })}
                  />
                </label>
              </div>
            ))}

            <div style={{ fontWeight: 600 }}>Vehicles</div>
            {vehicles.map((entry, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8 }}>
                <label style={labelStyle}>
                  Make/model
                  <input value={entry.makeModel || ""} onChange={(e) => updateVehicle(idx, { makeModel: e.target.value })} />
                </label>
                <label style={labelStyle}>
                  Year
                  <input value={entry.year || ""} onChange={(e) => updateVehicle(idx, { year: e.target.value })} />
                </label>
                <label style={labelStyle}>
                  Color
                  <input value={entry.color || ""} onChange={(e) => updateVehicle(idx, { color: e.target.value })} />
                </label>
                <label style={labelStyle}>
                  Plate
                  <input value={entry.plate || ""} onChange={(e) => updateVehicle(idx, { plate: e.target.value })} />
                </label>
                <label style={labelStyle}>
                  Province
                  <input value={entry.province || ""} onChange={(e) => updateVehicle(idx, { province: e.target.value })} />
                </label>
              </div>
            ))}

            <div style={{ fontWeight: 600 }}>Next of kin</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8 }}>
              <label style={labelStyle}>
                Name
                <input value={nextOfKin?.name || ""} onChange={(e) => setNextOfKin({ ...nextOfKin, name: e.target.value })} />
              </label>
              <label style={labelStyle}>
                Relationship
                <input value={nextOfKin?.relationship || ""} onChange={(e) => setNextOfKin({ ...nextOfKin, relationship: e.target.value })} />
              </label>
              <label style={labelStyle}>
                Phone
                <input
                  type="tel"
                  inputMode="tel"
                  pattern="[0-9]*"
                  value={nextOfKin?.phone || ""}
                  onChange={(e) => setNextOfKin({ ...nextOfKin, phone: digitsOnly(e.target.value) })}
                />
              </label>
              <label style={labelStyle}>
                Address
                <input value={nextOfKin?.address || ""} onChange={(e) => setNextOfKin({ ...nextOfKin, address: e.target.value })} />
              </label>
            </div>

            {coApplicantEnabled ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8 }}>
                <label style={labelStyle}>
                  Co-applicant next of kin name
                  <input value={coNextOfKin?.name || ""} onChange={(e) => setCoNextOfKin({ ...coNextOfKin, name: e.target.value })} />
                </label>
                <label style={labelStyle}>
                  Relationship
                  <input value={coNextOfKin?.relationship || ""} onChange={(e) => setCoNextOfKin({ ...coNextOfKin, relationship: e.target.value })} />
                </label>
                <label style={labelStyle}>
                  Phone
                  <input
                    type="tel"
                    inputMode="tel"
                    pattern="[0-9]*"
                    value={coNextOfKin?.phone || ""}
                    onChange={(e) => setCoNextOfKin({ ...coNextOfKin, phone: digitsOnly(e.target.value) })}
                  />
                </label>
                <label style={labelStyle}>
                  Address
                  <input value={coNextOfKin?.address || ""} onChange={(e) => setCoNextOfKin({ ...coNextOfKin, address: e.target.value })} />
                </label>
              </div>
            ) : null}
          </>
        ) : null}

        {step === 4 ? (
          <>
            <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>Consent & signatures</div>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <input type="checkbox" checked={consent.creditConsent} onChange={(e) => setConsent({ ...consent, creditConsent: e.target.checked })} />
              <span>I consent to a credit/consumer report.</span>
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <input type="checkbox" checked={consent.referenceConsent} onChange={(e) => setConsent({ ...consent, referenceConsent: e.target.checked })} />
              <span>I consent to contacting references and past landlords.</span>
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <input type="checkbox" checked={consent.dataSharingConsent} onChange={(e) => setConsent({ ...consent, dataSharingConsent: e.target.checked })} />
              <span>I consent to data sharing for the tenant database.</span>
            </label>
            <div style={{ display: "grid", gap: 8 }}>
              <label style={labelStyle}>
                Applicant full name (typed) *
                <input value={consent.applicantNameTyped || ""} onChange={(e) => setConsent({ ...consent, applicantNameTyped: e.target.value })} />
              </label>
              {coApplicantEnabled ? (
                <label style={labelStyle}>
                  Co-applicant full name (typed) *
                  <input value={consent.coApplicantNameTyped || ""} onChange={(e) => setConsent({ ...consent, coApplicantNameTyped: e.target.value })} />
                </label>
              ) : null}
            </div>
            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 10, display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 600 }}>Signature *</div>
              <label style={labelStyle}>
                Type your full name *
                <input value={signatureTypedName} onChange={(e) => setSignatureTypedName(e.target.value)} />
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <input type="checkbox" checked={signatureTypedAck} onChange={(e) => setSignatureTypedAck(e.target.checked)} />
                <span>I agree this is my legal signature.</span>
              </label>
            </div>
            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 10, display: "grid", gap: 8 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <input type="checkbox" checked={applicationConsentAccepted} onChange={(e) => setApplicationConsentAccepted(e.target.checked)} />
                <span>
                  I confirm the information provided is accurate and I authorize the landlord/manager to use it to evaluate my rental application.
                </span>
              </label>
              <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>
                By proceeding, you consent to the collection, use, and disclosure of your information for tenant screening and verification.
              </div>
            </div>
            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 10 }}>
              <label style={labelStyle}>
                Applicant notes (optional)
                <textarea value={applicantNotes} onChange={(e) => setApplicantNotes(e.target.value)} style={{ minHeight: 90 }} />
              </label>
            </div>
            <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>
              By submitting, you confirm the information provided is accurate.
            </div>
          </>
        ) : null}

        {error ? (
          <div style={{ border: "1px solid #fca5a5", background: "#fef2f2", padding: 10, borderRadius: 8 }}>
            {error}
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            Back
          </button>
          {step < steps.length - 1 ? (
            <button type="button" onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))} disabled={!canContinue()}>
              Next
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={submitting || !canContinue()}>
              {submitting ? "Submitting..." : "Submit application"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
