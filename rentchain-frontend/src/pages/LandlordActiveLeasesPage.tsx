import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  archiveLeaseRecord,
  convertUnitReferenceToLease,
  getActiveLeasesForLandlord,
  getArchivedLeasesForLandlord,
  getLeaseReconciliationCandidates,
  restoreLeaseRecord,
  type LandlordActiveLease,
  type LeaseReconciliationCandidate,
} from "@/api/leasesApi";

function formatCurrency(value: number | null | undefined) {
  const amount = typeof value === "number" ? value : 0;
  return amount.toLocaleString(undefined, { style: "currency", currency: "CAD" });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

function prettyLeaseStatus(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "Unknown";
  if (normalized === "notice_pending") return "Renew letter needed";
  if (normalized === "renewal_pending") return "Renewal pending";
  if (normalized === "renewal_accepted") return "Renewing";
  if (normalized === "move_out_pending") return "Quitting";
  return normalized.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function downloadLeaseSummary(lease: LandlordActiveLease) {
  const text = [
    `Property: ${lease.propertyName || "Property"}`,
    `Unit: ${lease.unitNumber || "—"}`,
    `Tenant: ${lease.tenantName || "—"}`,
    `Tenant email: ${lease.tenantEmail || "—"}`,
    `Monthly rent: ${formatCurrency(lease.monthlyRent)}`,
    `Start date: ${lease.startDate || "—"}`,
    `End date: ${lease.endDate || "—"}`,
    `Status: ${prettyLeaseStatus(lease.status)}`,
    `Lease document: ${lease.documentUrl || "Not available"}`,
  ].join("\n");

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lease-${lease.unitNumber || lease.id}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function normalizePhoneInput(value: string) {
  return String(value || "").replace(/\D/g, "").slice(0, 15);
}

function formatBlockingReason(reason: string) {
  switch (String(reason || "").trim().toLowerCase()) {
    case "occupant_name_required":
      return "Occupant name required";
    case "rent_required":
      return "Monthly rent required";
    default:
      return String(reason || "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

function buildCompleteTenantInfoHref(candidate: LeaseReconciliationCandidate) {
  const params = new URLSearchParams();
  params.set("propertyId", String(candidate.propertyId));
  params.set("unitId", String(candidate.unitId));
  return `/properties?${params.toString()}`;
}

function matchesLeaseSearch(lease: LandlordActiveLease, normalizedQuery: string) {
  if (!normalizedQuery) return true;
  const haystack = [lease.tenantName, lease.unitNumber, lease.propertyName]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
  return haystack.includes(normalizedQuery);
}

function statusBadge(status: string | null | undefined) {
  return (
    <span
      style={{
        display: "inline-flex",
        padding: "4px 8px",
        borderRadius: 999,
        background: "#eff6ff",
        color: "#1d4ed8",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {prettyLeaseStatus(status)}
    </span>
  );
}

export default function LandlordActiveLeasesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") === "archived" ? "archived" : "active";
  const [leases, setLeases] = React.useState<LandlordActiveLease[]>([]);
  const [candidates, setCandidates] = React.useState<LeaseReconciliationCandidate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCandidate, setSelectedCandidate] = React.useState<LeaseReconciliationCandidate | null>(null);
  const [convertSaving, setConvertSaving] = React.useState(false);
  const [occupantName, setOccupantName] = React.useState("");
  const [tenantEmail, setTenantEmail] = React.useState("");
  const [tenantPhone, setTenantPhone] = React.useState("");
  const [coApplicantEmail, setCoApplicantEmail] = React.useState("");
  const [coApplicantPhone, setCoApplicantPhone] = React.useState("");
  const [startDate, setStartDate] = React.useState(todayIso());
  const [endDate, setEndDate] = React.useState("");
  const [monthlyRent, setMonthlyRent] = React.useState("");

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [leaseResponse, candidateResponse] = await Promise.all([
        view === "archived" ? getArchivedLeasesForLandlord() : getActiveLeasesForLandlord(),
        view === "active" ? getLeaseReconciliationCandidates() : Promise.resolve({ candidates: [] }),
      ]);
      setLeases(Array.isArray(leaseResponse?.leases) ? leaseResponse.leases : []);
      setCandidates(Array.isArray(candidateResponse?.candidates) ? candidateResponse.candidates : []);
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to load lease operations."));
      setLeases([]);
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [view]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!selectedCandidate) return;
    setOccupantName(String(selectedCandidate.occupantName || ""));
    setTenantEmail("");
    setTenantPhone("");
    setCoApplicantEmail("");
    setCoApplicantPhone("");
    setStartDate(todayIso());
    setEndDate(String(selectedCandidate.leaseEndDate || ""));
    setMonthlyRent(String(selectedCandidate.monthlyRent || ""));
  }, [selectedCandidate]);

  async function handleArchive(lease: LandlordActiveLease) {
    const confirmed = window.confirm(
      "Archive this lease from the landlord lease workspace? You can restore it later from View archive."
    );
    if (!confirmed) return;
    await archiveLeaseRecord(lease.id);
    await load();
  }

  async function handleRestore(lease: LandlordActiveLease) {
    await restoreLeaseRecord(lease.id);
    await load();
  }

  async function handleConvert() {
    if (!selectedCandidate) return;
    setConvertSaving(true);
    setError(null);
    try {
      await convertUnitReferenceToLease(selectedCandidate.unitId, {
        occupantName,
        tenantEmail: tenantEmail.trim() || undefined,
        tenantPhone: tenantPhone.trim() || undefined,
        coApplicantEmail: coApplicantEmail.trim() || undefined,
        coApplicantPhone: coApplicantPhone.trim() || undefined,
        startDate,
        endDate: endDate || null,
        monthlyRent: Number(monthlyRent || 0),
      });
      setSelectedCandidate(null);
      await load();
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to convert reference to lease."));
    } finally {
      setConvertSaving(false);
    }
  }

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredLeases = React.useMemo(
    () => leases.filter((lease) => matchesLeaseSearch(lease, normalizedSearchQuery)),
    [leases, normalizedSearchQuery]
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 24, fontWeight: 800 }}>Lease operations</div>
        <div style={{ color: "#475569", fontSize: 14 }}>
          Keep canonical lease records visible, reconcile occupied units missing leases, and use the ledger and archive views safely.
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setSearchParams({})}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #cbd5e1",
            background: view === "active" ? "#0f172a" : "#fff",
            color: view === "active" ? "#fff" : "#0f172a",
          }}
        >
          Active leases
        </button>
        <button
          type="button"
          onClick={() => setSearchParams({ view: "archived" })}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #cbd5e1",
            background: view === "archived" ? "#0f172a" : "#fff",
            color: view === "archived" ? "#fff" : "#0f172a",
          }}
        >
          View archive
        </button>
      </div>

      <label style={{ display: "grid", gap: 6, maxWidth: 420 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Search leases</span>
        <input
          aria-label="Search leases"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search by tenant, unit, or property"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #cbd5e1",
            background: "#fff",
            color: "#0f172a",
          }}
        />
      </label>

      {loading ? <div>Loading lease operations…</div> : null}
      {error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}

      {!loading && view === "active" && candidates.length > 0 ? (
        <div style={{ display: "grid", gap: 10, border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff", padding: 16 }}>
          <div style={{ fontWeight: 800, color: "#0f172a" }}>Occupied units missing lease records</div>
          <div style={{ color: "#64748b", fontSize: 13 }}>
            Units remain the occupancy source of truth. Convert these occupied reference states into real lease records only when you are ready.
          </div>
          {candidates.map((candidate) => (
            <div
              key={candidate.unitId}
              style={{
                display: "grid",
                gap: 8,
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>
                    {candidate.propertyName} · Unit {candidate.unitNumber}
                  </div>
                  <div style={{ color: "#475569", fontSize: 13 }}>
                    {candidate.occupantName || "Occupant name missing"} · {formatCurrency(candidate.monthlyRent)}
                    {candidate.leaseEndDate ? ` · Ends ${formatDate(candidate.leaseEndDate)}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {candidate.leaseDocument?.url ? (
                    <a href={candidate.leaseDocument.url} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>
                      View reference
                    </a>
                  ) : null}
                  {candidate.canConvert ? (
                    <button
                      type="button"
                      aria-label={`Convert unit ${candidate.unitNumber} to lease`}
                      onClick={() => setSelectedCandidate(candidate)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #cbd5e1",
                        background: "#fff",
                        color: "#0f172a",
                      }}
                    >
                      Convert to lease
                    </button>
                  ) : (
                    <Link
                      to={buildCompleteTenantInfoHref(candidate)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #cbd5e1",
                        background: "#fff",
                        color: "#0f172a",
                        textDecoration: "none",
                      }}
                    >
                      Complete tenant info
                    </Link>
                  )}
                </div>
              </div>
              {!candidate.canConvert && candidate.blockingReasons.length > 0 ? (
                <div style={{ color: "#b45309", fontSize: 12 }}>
                  Missing: {candidate.blockingReasons.map(formatBlockingReason).join(", ")}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {!loading && !error && leases.length === 0 ? (
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            background: "#fff",
            color: "#475569",
          }}
        >
          {view === "archived" ? "No archived leases yet." : "No active leases were found for this landlord yet."}
        </div>
      ) : null}

      {!loading && !error && leases.length > 0 && filteredLeases.length === 0 ? (
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            background: "#fff",
            color: "#475569",
          }}
        >
          No leases match your search.
        </div>
      ) : null}

      {!loading && !error && filteredLeases.length > 0 ? (
        <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff" }}>
          <table style={{ width: "100%", minWidth: 1040, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", color: "#475569" }}>
                {["Property", "Unit", "Tenant", "Status", "Rent", "Term", "Actions"].map((label) => (
                  <th key={label} style={{ textAlign: "left", padding: 12, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredLeases.map((lease) => {
                const ledgerPath = `/leases/${encodeURIComponent(lease.id)}/ledger`;
                const ledgerUrl =
                  typeof window !== "undefined"
                    ? `${window.location.origin}${ledgerPath}`
                    : ledgerPath;
                const emailSubject = encodeURIComponent(`Lease for ${lease.propertyName} unit ${lease.unitNumber}`);
                const emailBody = encodeURIComponent(
                  [
                    `Lease reference for ${lease.propertyName} unit ${lease.unitNumber}.`,
                    "",
                    `Monthly rent: ${formatCurrency(lease.monthlyRent)}`,
                    `Status: ${prettyLeaseStatus(lease.status)}`,
                    `Term: ${formatDate(lease.startDate)} to ${formatDate(lease.endDate)}`,
                    `View ledger: ${ledgerUrl}`,
                    lease.documentUrl ? `Lease document: ${lease.documentUrl}` : "",
                  ]
                    .filter(Boolean)
                    .join("\n")
                );
                const emailHref = lease.tenantEmail
                  ? `mailto:${encodeURIComponent(lease.tenantEmail)}?subject=${emailSubject}&body=${emailBody}`
                  : null;

                return (
                  <tr key={lease.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                    <td style={{ padding: 12 }}>
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>{lease.propertyName}</div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>{lease.id}</div>
                    </td>
                    <td style={{ padding: 12 }}>{lease.unitNumber || "—"}</td>
                    <td style={{ padding: 12 }}>
                      <div>{lease.tenantName || "Tenant not linked"}</div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>{lease.tenantEmail || "No email on file"}</div>
                    </td>
                    <td style={{ padding: 12 }}>
                      <div>{statusBadge(lease.status)}</div>
                      {lease.archivedAt ? (
                        <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                          Archived {formatDate(lease.archivedAt)}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ padding: 12 }}>{formatCurrency(lease.monthlyRent)}</td>
                    <td style={{ padding: 12 }}>
                      <div>{formatDate(lease.startDate)}</div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>to {formatDate(lease.endDate)}</div>
                    </td>
                    <td style={{ padding: 12 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Link to={ledgerPath} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", textDecoration: "none", color: "#0f172a" }}>
                          View
                        </Link>
                        {emailHref ? (
                          <a
                            href={emailHref}
                            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", textDecoration: "none", color: "#0f172a" }}
                          >
                            Email
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled
                            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#94a3b8" }}
                          >
                            Email
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (lease.documentUrl) {
                              const a = document.createElement("a");
                              a.href = lease.documentUrl;
                              a.target = "_blank";
                              a.rel = "noreferrer";
                              a.download = "";
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                              return;
                            }
                            downloadLeaseSummary(lease);
                          }}
                          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a" }}
                        >
                          Save
                        </button>
                        {view === "archived" ? (
                          <button
                            type="button"
                            onClick={() => void handleRestore(lease)}
                            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a" }}
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleArchive(lease)}
                            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a" }}
                          >
                            Archive lease
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {selectedCandidate ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 90,
          }}
          onClick={() => !convertSaving && setSelectedCandidate(null)}
        >
          <div
            style={{
              width: "min(520px, 96vw)",
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              background: "#fff",
              boxShadow: "0 20px 50px rgba(15,23,42,0.2)",
              padding: 18,
              display: "grid",
              gap: 10,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 800 }}>
              Convert reference to lease
            </div>
            <div style={{ color: "#475569", fontSize: 13 }}>
              This creates a real lease record. The unit reference document stays as supporting context and does not remain the lease truth.
            </div>
            <label style={{ display: "grid", gap: 4 }}>
              <span>Occupant name</span>
              <input value={occupantName} onChange={(event) => setOccupantName(event.target.value)} />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span>Tenant email (optional)</span>
              <input value={tenantEmail} onChange={(event) => setTenantEmail(event.target.value)} />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span>Tenant phone (optional)</span>
              <input
                inputMode="numeric"
                value={tenantPhone}
                onChange={(event) => setTenantPhone(normalizePhoneInput(event.target.value))}
              />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span>Co-applicant email (optional)</span>
              <input value={coApplicantEmail} onChange={(event) => setCoApplicantEmail(event.target.value)} />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span>Co-applicant phone (optional)</span>
              <input
                inputMode="numeric"
                value={coApplicantPhone}
                onChange={(event) => setCoApplicantPhone(normalizePhoneInput(event.target.value))}
              />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
              <label style={{ display: "grid", gap: 4 }}>
                <span>Start date</span>
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span>End date</span>
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span>Monthly rent</span>
                <input type="number" min="0" step="0.01" value={monthlyRent} onChange={(event) => setMonthlyRent(event.target.value)} />
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setSelectedCandidate(null)} disabled={convertSaving}>
                Cancel
              </button>
              <button type="button" onClick={() => void handleConvert()} disabled={convertSaving}>
                {convertSaving ? "Converting…" : "Create lease"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
