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

  const [applicant, setApplicant] = useState<RentalApplicationPayload["applicant"]>({
    firstName: "",
    middleInitial: "",
    lastName: "",
    email: "",
    phoneHome: "",
    phoneWork: "",
    dob: "",
    maritalStatus: null,
  });
  const [coApplicantEnabled, setCoApplicantEnabled] = useState(false);
  const [coApplicant, setCoApplicant] = useState<RentalApplicationPayload["coApplicant"]>({
    firstName: "",
    middleInitial: "",
    lastName: "",
    email: "",
    phoneHome: "",
    phoneWork: "",
    dob: "",
    maritalStatus: null,
  });
  const [otherResidents, setOtherResidents] = useState<ResidentEntry[]>([{ name: "", relationship: "", age: null }]);
  const [residentialHistory, setResidentialHistory] = useState<HistoryEntry[]>([
    emptyHistory(),
    emptyHistory(),
    emptyHistory(),
  ]);
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
  const [submitting, setSubmitting] = useState(false);
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
      const dobValue = (applicant.dob || "").trim();
      return (
        applicant.firstName.trim() &&
        applicant.lastName.trim() &&
        applicant.email.trim() &&
        dobValue &&
        isValidDob(dobValue)
      );
    }
    if (step === 4) {
      const hasApplicantSig = (consent.applicantNameTyped || "").trim();
      const hasCoSig = !coApplicantEnabled || (consent.coApplicantNameTyped || "").trim();
      return consent.creditConsent && consent.referenceConsent && consent.dataSharingConsent && hasApplicantSig && hasCoSig;
    }
    return true;
  };

  async function handleSubmit() {
    if (!token) {
      setError("Missing application link token.");
      return;
    }
    if (!residentialHistory[0]?.address?.trim()) {
      setError("Current address is required for screening.");
      setStep(1);
      return;
    }
    const dobValue = (applicant.dob || "").trim();
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
    if (!canContinue()) {
      setError("Please complete required fields.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload: RentalApplicationPayload = {
        token,
        applicant: {
          ...applicant,
          middleInitial: applicant.middleInitial || null,
          phoneHome: applicant.phoneHome || null,
          phoneWork: applicant.phoneWork || null,
          dob: applicant.dob || null,
        },
        coApplicant: coApplicantEnabled
          ? {
              ...coApplicant,
              middleInitial: coApplicant.middleInitial || null,
              phoneHome: coApplicant.phoneHome || null,
              phoneWork: coApplicant.phoneWork || null,
              dob: coApplicant.dob || null,
            }
          : null,
        otherResidents: otherResidents.filter((r) => r.name.trim()),
        residentialHistory: residentialHistory.filter((h) => h.address.trim()),
        employment: {
          applicant: employment.applicant,
          coApplicant: coApplicantEnabled ? employment.coApplicant ?? null : null,
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
                <input value={applicant.firstName} onChange={(e) => setApplicant({ ...applicant, firstName: e.target.value })} />
              </label>
              <label style={labelStyle}>
                Middle initial
                <input value={applicant.middleInitial || ""} onChange={(e) => setApplicant({ ...applicant, middleInitial: e.target.value })} />
              </label>
              <label style={labelStyle}>
                Last name *
                <input value={applicant.lastName} onChange={(e) => setApplicant({ ...applicant, lastName: e.target.value })} />
              </label>
              <label style={labelStyle}>
                Email *
                <input type="email" value={applicant.email} onChange={(e) => setApplicant({ ...applicant, email: e.target.value })} />
              </label>
              <label style={labelStyle}>
                Phone (home)
                <input value={applicant.phoneHome || ""} onChange={(e) => setApplicant({ ...applicant, phoneHome: e.target.value })} />
              </label>
              <label style={labelStyle}>
                Phone (work)
                <input value={applicant.phoneWork || ""} onChange={(e) => setApplicant({ ...applicant, phoneWork: e.target.value })} />
              </label>
              <label style={labelStyle}>
                Date of birth *
                <input type="date" value={applicant.dob || ""} onChange={(e) => setApplicant({ ...applicant, dob: e.target.value })} />
              </label>
              <label style={labelStyle}>
                Marital status
                <select
                  value={applicant.maritalStatus || ""}
                  onChange={(e) => setApplicant({ ...applicant, maritalStatus: (e.target.value as any) || null })}
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
                    First name
                    <input value={coApplicant?.firstName || ""} onChange={(e) => setCoApplicant({ ...coApplicant, firstName: e.target.value })} />
                  </label>
                  <label style={labelStyle}>
                    Middle initial
                    <input value={coApplicant?.middleInitial || ""} onChange={(e) => setCoApplicant({ ...coApplicant, middleInitial: e.target.value })} />
                  </label>
                  <label style={labelStyle}>
                    Last name
                    <input value={coApplicant?.lastName || ""} onChange={(e) => setCoApplicant({ ...coApplicant, lastName: e.target.value })} />
                  </label>
                  <label style={labelStyle}>
                    Email
                    <input type="email" value={coApplicant?.email || ""} onChange={(e) => setCoApplicant({ ...coApplicant, email: e.target.value })} />
                  </label>
                  <label style={labelStyle}>
                    Phone (home)
                    <input value={coApplicant?.phoneHome || ""} onChange={(e) => setCoApplicant({ ...coApplicant, phoneHome: e.target.value })} />
                  </label>
                  <label style={labelStyle}>
                    Phone (work)
                    <input value={coApplicant?.phoneWork || ""} onChange={(e) => setCoApplicant({ ...coApplicant, phoneWork: e.target.value })} />
                  </label>
                  <label style={labelStyle}>
                    Date of birth
                    <input type="date" value={coApplicant?.dob || ""} onChange={(e) => setCoApplicant({ ...coApplicant, dob: e.target.value })} />
                  </label>
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>Residential history</div>
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
                      type="number"
                      value={entry.durationMonths ?? ""}
                      onChange={(e) => updateHistory(idx, { durationMonths: e.target.value ? Number(e.target.value) : null })}
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
                    <input value={entry.landlordPhone || ""} onChange={(e) => updateHistory(idx, { landlordPhone: e.target.value })} />
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
                    type="number"
                    value={entry.age ?? ""}
                    onChange={(e) => updateResident(idx, { age: e.target.value ? Number(e.target.value) : null })}
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
                Employer
                <input value={employment.applicant.employer || ""} onChange={(e) => setEmployment({ ...employment, applicant: { ...employment.applicant, employer: e.target.value } })} />
              </label>
              <label style={labelStyle}>
                Job title
                <input value={employment.applicant.jobTitle || ""} onChange={(e) => setEmployment({ ...employment, applicant: { ...employment.applicant, jobTitle: e.target.value } })} />
              </label>
              <label style={labelStyle}>
                Supervisor
                <input value={employment.applicant.supervisor || ""} onChange={(e) => setEmployment({ ...employment, applicant: { ...employment.applicant, supervisor: e.target.value } })} />
              </label>
              <label style={labelStyle}>
                Phone
                <input value={employment.applicant.phone || ""} onChange={(e) => setEmployment({ ...employment, applicant: { ...employment.applicant, phone: e.target.value } })} />
              </label>
              <label style={labelStyle}>
                Monthly income
                <input value={employment.applicant.monthlyIncomeCents ? `${employment.applicant.monthlyIncomeCents / 100}` : ""} onChange={(e) => setEmployment({ ...employment, applicant: { ...employment.applicant, monthlyIncomeCents: parseCents(e.target.value) } })} />
              </label>
              <label style={labelStyle}>
                Income type
                <select
                  value={employment.applicant.incomeType || ""}
                  onChange={(e) => setEmployment({ ...employment, applicant: { ...employment.applicant, incomeType: (e.target.value as any) || null } })}
                >
                  <option value="">Select</option>
                  <option value="NET">Net</option>
                  <option value="GROSS">Gross</option>
                </select>
              </label>
              <label style={labelStyle}>
                Length (months)
                <input type="number" value={employment.applicant.lengthMonths ?? ""} onChange={(e) => setEmployment({ ...employment, applicant: { ...employment.applicant, lengthMonths: e.target.value ? Number(e.target.value) : null } })} />
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
                    <input value={employment.coApplicant?.phone || ""} onChange={(e) => setEmployment({ ...employment, coApplicant: { ...employment.coApplicant, phone: e.target.value } })} />
                  </label>
                  <label style={labelStyle}>
                    Monthly income
                    <input value={employment.coApplicant?.monthlyIncomeCents ? `${employment.coApplicant?.monthlyIncomeCents / 100}` : ""} onChange={(e) => setEmployment({ ...employment, coApplicant: { ...employment.coApplicant, monthlyIncomeCents: parseCents(e.target.value) } })} />
                  </label>
                  <label style={labelStyle}>
                    Income type
                    <select
                      value={employment.coApplicant?.incomeType || ""}
                      onChange={(e) => setEmployment({ ...employment, coApplicant: { ...employment.coApplicant, incomeType: (e.target.value as any) || null } })}
                    >
                      <option value="">Select</option>
                      <option value="NET">Net</option>
                      <option value="GROSS">Gross</option>
                    </select>
                  </label>
                  <label style={labelStyle}>
                    Length (months)
                    <input type="number" value={employment.coApplicant?.lengthMonths ?? ""} onChange={(e) => setEmployment({ ...employment, coApplicant: { ...employment.coApplicant, lengthMonths: e.target.value ? Number(e.target.value) : null } })} />
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
                <input value={references?.applicantPersonal?.phone || ""} onChange={(e) => setReferences({ ...references, applicantPersonal: { ...references?.applicantPersonal, phone: e.target.value } })} />
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
                  <input value={references?.coApplicantPersonal?.phone || ""} onChange={(e) => setReferences({ ...references, coApplicantPersonal: { ...references?.coApplicantPersonal, phone: e.target.value } })} />
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
                  <input value={entry.monthlyPaymentCents ? `${entry.monthlyPaymentCents / 100}` : ""} onChange={(e) => updateLoan(idx, { monthlyPaymentCents: parseCents(e.target.value) })} />
                </label>
                <label style={labelStyle}>
                  Balance
                  <input value={entry.balanceCents ? `${entry.balanceCents / 100}` : ""} onChange={(e) => updateLoan(idx, { balanceCents: parseCents(e.target.value) })} />
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
                <input value={nextOfKin?.phone || ""} onChange={(e) => setNextOfKin({ ...nextOfKin, phone: e.target.value })} />
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
                  <input value={coNextOfKin?.phone || ""} onChange={(e) => setCoNextOfKin({ ...coNextOfKin, phone: e.target.value })} />
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
                Applicant full name (typed)
                <input value={consent.applicantNameTyped || ""} onChange={(e) => setConsent({ ...consent, applicantNameTyped: e.target.value })} />
              </label>
              {coApplicantEnabled ? (
                <label style={labelStyle}>
                  Co-applicant full name (typed)
                  <input value={consent.coApplicantNameTyped || ""} onChange={(e) => setConsent({ ...consent, coApplicantNameTyped: e.target.value })} />
                </label>
              ) : null}
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
