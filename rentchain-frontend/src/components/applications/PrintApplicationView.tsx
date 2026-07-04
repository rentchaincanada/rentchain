import React from "react";
import type { Application } from "../../types/applications";

type PrintApplicationViewProps = {
  application: Application;
};

const formatDate = (date?: string | null, includeTime?: boolean) => {
  if (!date) return "—";
  const d = new Date(date);
  return includeTime ? d.toLocaleString() : d.toLocaleDateString();
};

const formatRecentAddress = (app: Application) => {
  const addr = app.recentAddress;
  if (!addr) return "—";
  const street = [addr.streetNumber, addr.streetName].filter(Boolean).join(" ");
  const cityProvince = [addr.city, addr.province].filter(Boolean).join(", ");
  const parts = [street, cityProvince, addr.postalCode].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
};

const getPropertyAddress = (app: Application) => {
  const line1 =
    (app as any).propertyAddressLine1 ||
    (app as any).propertyAddress ||
    null;
  const city =
    (app as any).propertyCity ||
    (app as any).city ||
    null;
  const province =
    (app as any).propertyProvince ||
    (app as any).province ||
    null;
  const postalCode =
    (app as any).propertyPostalCode ||
    (app as any).postalCode ||
    null;

  const cityLine = [city, province].filter(Boolean).join(", ");
  const parts = [line1, cityLine, postalCode].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
};

const commaOrDash = (value?: string | null) => (value && value.trim()) || "—";

const formatMoney = (value?: number | null) =>
  typeof value === "number" && !Number.isNaN(value)
    ? `$${value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : "—";

const formatCents = (value?: number | null) => formatMoney(typeof value === "number" ? value / 100 : null);

const formatList = (items?: Array<string | null | undefined> | null, fallback = "None recorded") => {
  const compact = (items || []).map((item) => String(item || "").trim()).filter(Boolean);
  return compact.length ? compact.join("; ") : fallback;
};

const yesNo = (value?: boolean | null) => {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "—";
};

const formatAddressParts = (...parts: Array<string | null | undefined>) => {
  const compact = parts.map((part) => String(part || "").trim()).filter(Boolean);
  return compact.length ? compact.join(" · ") : "—";
};

const formatSlot = (slot?: { startAt?: string | null; endAt?: string | null; note?: string | null } | null) => {
  if (!slot?.startAt) return null;
  const start = new Date(slot.startAt);
  const end = slot.endAt ? new Date(slot.endAt) : null;
  if (Number.isNaN(start.getTime())) return null;
  const endLabel = end && !Number.isNaN(end.getTime())
    ? ` - ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : "";
  return `${start.toLocaleString()}${endLabel}${slot.note ? ` · ${slot.note}` : ""}`;
};

export const PrintApplicationView: React.FC<PrintApplicationViewProps> = ({
  application,
}) => {
  const applicantName =
    application.fullName || application.applicantName || "Applicant";
  const propertyAddress = getPropertyAddress(application);
  const app: any = application as any;
  const profile = app.applicantProfile || {};
  const profileAddress = profile.currentAddress || {};
  const employment = profile.employment || {};
  const workReference = profile.workReference || {};
  const signature = profile.signature || {};
  const consent = app.applicationConsent || {};
  const household = app.household || {};
  const coApplicant = app.coApplicant || {};
  const currentLeaseStatus = app.currentLeaseStatus || null;
  const decisionSummary = app.decisionSummary || null;
  const risk = decisionSummary?.riskSnapshot || decisionSummary?.riskInsights || null;
  const viewingRequests = Array.isArray(app.viewingRequests) ? app.viewingRequests.slice(0, 5) : [];
  const residentialHistory = Array.isArray(app.residentialHistory) ? app.residentialHistory.slice(0, 5) : [];
  const monthlyIncomeFromProfile =
    typeof employment.incomeAmountCents === "number"
      ? employment.incomeFrequency === "annual"
        ? employment.incomeAmountCents / 12 / 100
        : employment.incomeAmountCents / 100
      : null;

  return (
    <article className="print-application-view" aria-label="Application summary print view">
      <style>
        {`
        @media print {
          body {
            background: #fff;
            color: #000;
          }
          body * {
            visibility: hidden;
          }
          .print-application-view, .print-application-view * {
            visibility: visible;
          }
          .print-application-view {
            display: block !important;
            position: static;
            padding: 32px 36px;
            width: 100%;
            height: auto;
            min-height: auto;
            max-height: none;
            overflow: visible;
            transform: none;
            box-sizing: border-box;
            background: #fff;
            color: #000;
            font-family: "Helvetica Neue", Arial, sans-serif;
          }
          .print-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }
          .print-card {
            border: 1px solid #d1d5db;
            border-radius: 8px;
            padding: 12px;
            break-inside: avoid;
          }
          .print-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: #111;
            margin: 0 0 4px;
          }
          .print-value {
            font-size: 14px;
            color: #000;
            line-height: 1.35;
            overflow-wrap: anywhere;
          }
          .print-muted {
            color: #111;
            font-size: 12px;
            overflow-wrap: anywhere;
          }
          .no-print {
            display: none !important;
          }
        }
        .print-application-view {
          display: none;
        }
      `}
      </style>

      <header style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: 0.08, textTransform: "uppercase", marginBottom: 4 }}>
            Application summary
          </div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{applicantName}</h1>
          <div style={{ fontSize: 14, marginTop: 4 }}>
            {application.propertyName}
            {propertyAddress ? ` · ${propertyAddress}` : ""}
          </div>
          <div style={{ fontSize: 13, marginTop: 2 }}>
            Unit: {commaOrDash(application.unitApplied || application.unit)} | Lease start:{" "}
            {formatDate(application.leaseStartDate)}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 12 }}>
          <div>Submitted: {formatDate(application.submittedAt || application.createdAt, true)}</div>
          <div>Approved: {formatDate(application.approvedAt, true)}</div>
          <div>Status: {application.status}</div>
        </div>
      </header>

      <section className="print-card" aria-labelledby="print-application-context-heading" style={{ marginBottom: 12 }}>
        <h2 id="print-application-context-heading" className="print-label">Application context</h2>
        <div className="print-grid">
          <div className="print-value">Status: {application.status || "—"}</div>
          <div className="print-value">Requested rent: {formatMoney(app.requestedRent)}</div>
          <div className="print-value">Move-in date: {formatDate(app.moveInDate)}</div>
          <div className="print-value">Risk level: {app.riskLevel || "—"}</div>
        </div>
      </section>

      <div className="print-grid" style={{ marginBottom: 12 }}>
        <section className="print-card" aria-labelledby="print-application-contact-heading">
          <h2 id="print-application-contact-heading" className="print-label">Contact</h2>
          <div className="print-value">{applicantName}</div>
          <div className="print-muted">{commaOrDash(application.email)}</div>
          <div className="print-muted">{commaOrDash(application.phone || application.applicantPhone)}</div>
        </section>

        <section className="print-card" aria-labelledby="print-application-details-heading">
          <h2 id="print-application-details-heading" className="print-label">Applicant details</h2>
          <div className="print-value">DOB: {formatDate(application.dateOfBirth)}</div>
          <div className="print-value" style={{ marginTop: 4 }}>
            Recent address: {formatRecentAddress(application)}
          </div>
          <div className="print-value" style={{ marginTop: 4 }}>
            Monthly income: {formatMoney(application.monthlyIncome)}
          </div>
        </section>
      </div>

      <section className="print-card" aria-labelledby="print-application-profile-heading" style={{ marginBottom: 12 }}>
        <h2 id="print-application-profile-heading" className="print-label">Applicant profile</h2>
        <div className="print-grid">
          <div className="print-value">
            Current address:{" "}
            {formatAddressParts(
              profileAddress.line1,
              profileAddress.line2,
              [profileAddress.city, profileAddress.provinceState].filter(Boolean).join(", "),
              profileAddress.postalCode
            )}
          </div>
          <div className="print-value">
            Current rent: {formatCents(profile.currentRentAmountCents)}
          </div>
          <div className="print-value">
            Employer: {employment.employerName || "—"}
            {employment.jobTitle ? ` · ${employment.jobTitle}` : ""}
          </div>
          <div className="print-value">
            Income: {monthlyIncomeFromProfile != null ? formatMoney(monthlyIncomeFromProfile) : "—"}
            {employment.incomeFrequency === "annual" ? " monthly equivalent" : ""}
          </div>
          <div className="print-value">
            Time at job: {employment.monthsAtJob != null ? `${employment.monthsAtJob} months` : "—"}
          </div>
          <div className="print-value">
            Work reference: {workReference.name || "—"}
            {workReference.phone ? ` · ${workReference.phone}` : ""}
          </div>
          <div className="print-value">
            Signature: {signature.signedAt ? `Signed ${formatDate(signature.signedAt, true)}` : "—"}
          </div>
          <div className="print-value">
            Application consent: {consent.acceptedAt ? `Accepted ${formatDate(consent.acceptedAt, true)}` : "—"}
          </div>
        </div>
        {profile.applicantNotes ? (
          <div className="print-muted" style={{ marginTop: 8 }}>Applicant notes: {profile.applicantNotes}</div>
        ) : null}
      </section>

      <section className="print-card" aria-labelledby="print-application-household-heading" style={{ marginBottom: 12 }}>
        <h2 id="print-application-household-heading" className="print-label">Household & co-applicant</h2>
        <div className="print-grid">
          <div className="print-value">Co-applicant: {coApplicant.fullName || "—"}</div>
          <div className="print-value">Co-applicant contact: {formatAddressParts(coApplicant.email, coApplicant.phone)}</div>
          <div className="print-value">Co-applicant income: {formatMoney(coApplicant.monthlyIncome)}</div>
          <div className="print-value">Other occupants: {household.otherOccupants || "—"}</div>
          <div className="print-value">Pets: {household.pets || "—"}</div>
          <div className="print-value">Vehicles: {household.vehicles || "—"}</div>
        </div>
        {household.notes ? <div className="print-muted" style={{ marginTop: 8 }}>Household notes: {household.notes}</div> : null}
      </section>

      <section className="print-card" aria-labelledby="print-application-references-heading" style={{ marginBottom: 12 }}>
        <h2 id="print-application-references-heading" className="print-label">References</h2>
        <div className="print-value">
          Contacted: {application.referencesContacted ? "Yes" : "No"}
          {application.referencesContactedAt
            ? ` on ${formatDate(application.referencesContactedAt, true)}`
            : ""}
        </div>
        <div className="print-muted" style={{ marginTop: 4 }}>
          Notes: {application.referencesNotes ? application.referencesNotes : "—"}
        </div>
      </section>

      <section className="print-card" aria-labelledby="print-application-housing-heading" style={{ marginBottom: 12 }}>
        <h2 id="print-application-housing-heading" className="print-label">Current housing & residential history</h2>
        <div className="print-value">
          Active lease: {yesNo(currentLeaseStatus?.hasActiveLease)}
          {currentLeaseStatus?.leaseEndDate ? ` · Lease end: ${formatDate(currentLeaseStatus.leaseEndDate)}` : ""}
          {currentLeaseStatus?.landlordAware ? ` · Landlord aware: ${String(currentLeaseStatus.landlordAware).replace(/_/g, " ")}` : ""}
        </div>
        {currentLeaseStatus?.reasonForMoving ? (
          <div className="print-muted" style={{ marginTop: 4 }}>Reason for moving: {currentLeaseStatus.reasonForMoving}</div>
        ) : null}
        <div style={{ marginTop: 8 }}>
          {residentialHistory.length ? (
            residentialHistory.map((entry: any, index: number) => (
              <div key={`${entry.address || "history"}-${index}`} className="print-muted" style={{ marginTop: 4 }}>
                {index + 1}. {entry.address || "Address not provided"}
                {entry.durationMonths ? ` · ${entry.durationMonths} months` : ""}
                {entry.rentAmountCents ? ` · ${formatCents(entry.rentAmountCents)}` : ""}
                {entry.landlordName ? ` · Landlord: ${entry.landlordName}` : ""}
                {entry.landlordPhone ? ` (${entry.landlordPhone})` : ""}
                {entry.reasonForLeaving ? ` · Reason: ${entry.reasonForLeaving}` : ""}
              </div>
            ))
          ) : (
            <div className="print-muted">No residential history provided.</div>
          )}
        </div>
      </section>

      <section className="print-card" aria-labelledby="print-application-risk-heading" style={{ marginBottom: 12 }}>
        <h2 id="print-application-risk-heading" className="print-label">Screening, risk & decision guidance</h2>
        <div className="print-grid">
          <div className="print-value">Screening status: {app.screeningStatus || app.screening?.status || "—"}</div>
          <div className="print-value">Screening provider: {app.screeningProvider || app.screening?.provider || "—"}</div>
          <div className="print-value">
            Risk score: {risk?.score != null ? `${risk.score}${risk.grade ? ` (${risk.grade})` : ""}` : "—"}
          </div>
          <div className="print-value">
            Confidence: {risk?.confidence != null ? `${Math.round(Number(risk.confidence) * 100)}%` : "—"}
          </div>
        </div>
        <div className="print-muted" style={{ marginTop: 8 }}>
          Decision summary: {decisionSummary?.decisionSupport?.summaryLine || "Not provided"}
        </div>
        <div className="print-muted" style={{ marginTop: 4 }}>
          Next action: {decisionSummary?.decisionSupport?.nextBestAction || "Not provided"}
        </div>
        <div className="print-muted" style={{ marginTop: 4 }}>
          Signals: {formatList(risk?.signals || risk?.flags)}
        </div>
        <div className="print-muted" style={{ marginTop: 4 }}>
          Recommendations: {formatList(risk?.recommendations)}
        </div>
        <div className="print-muted" style={{ marginTop: 4 }}>
          Reference questions: {formatList(decisionSummary?.referenceQuestions)}
        </div>
      </section>

      <section className="print-card" aria-labelledby="print-application-viewings-heading" style={{ marginBottom: 12 }}>
        <h2 id="print-application-viewings-heading" className="print-label">Viewing requests</h2>
        {viewingRequests.length ? (
          viewingRequests.map((request: any, index: number) => {
            const selectedSlot = formatSlot(request.selectedSlot);
            const proposed = Array.isArray(request.proposedSlots)
              ? request.proposedSlots.map(formatSlot).filter(Boolean).slice(0, 3)
              : [];
            return (
              <div key={request.id || index} className="print-muted" style={{ marginTop: index ? 8 : 0 }}>
                <div className="print-value">
                  {request.applicantName || applicantName} · {request.status || "requested"}
                </div>
                <div>{request.applicantEmail || "No email provided"}</div>
                {request.requestedMessage ? <div>Message: {request.requestedMessage}</div> : null}
                {selectedSlot ? <div>Selected time: {selectedSlot}</div> : null}
                {proposed.length ? <div>Proposed times: {proposed.join("; ")}</div> : null}
              </div>
            );
          })
        ) : (
          <div className="print-muted">No viewing requests recorded.</div>
        )}
      </section>

      <div className="print-grid" style={{ marginBottom: 12 }}>
        <section className="print-card" aria-labelledby="print-application-flags-heading">
          <h2 id="print-application-flags-heading" className="print-label">Flags</h2>
          <div className="print-value">
            {application.flags && application.flags.length > 0
              ? application.flags.join(", ")
              : "None recorded"}
          </div>
        </section>
        <section className="print-card" aria-labelledby="print-application-notes-heading">
          <h2 id="print-application-notes-heading" className="print-label">Notes</h2>
          <div className="print-value">
            {application.notes && application.notes.trim()
              ? application.notes
              : "No notes on file."}
          </div>
        </section>
      </div>

      {application.applicants && application.applicants.length > 0 && (
        <section className="print-card" aria-labelledby="print-application-applicants-heading">
          <h2 id="print-application-applicants-heading" className="print-label">Applicants</h2>
          {application.applicants.map((appl) => (
            <div key={appl.id} style={{ marginBottom: 8 }}>
              <div className="print-value">
                {appl.fullName} {appl.role === "co_applicant" ? "(Co-applicant)" : "(Primary)"}
              </div>
              <div className="print-muted">
                DOB: {appl.dateOfBirth ? formatDate(appl.dateOfBirth) : "—"} | Income:{" "}
                {formatMoney(appl.monthlyIncome)}
              </div>
              <div className="print-muted">
                Recent address:{" "}
                {[
                  appl.currentAddress,
                  [appl.currentCity, appl.currentProvince].filter(Boolean).join(", "),
                  appl.currentPostalCode,
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </div>
              {appl.notes && (
                <div className="print-muted" style={{ marginTop: 2 }}>
                  Notes: {appl.notes}
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </article>
  );
};
