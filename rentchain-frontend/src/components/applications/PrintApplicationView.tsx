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

export const PrintApplicationView: React.FC<PrintApplicationViewProps> = ({
  application,
}) => {
  const applicantName =
    application.fullName || application.applicantName || "Applicant";
  const propertyAddress = getPropertyAddress(application);

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
