import React from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { downloadAuthenticatedExport } from "@/api/exportDownload";
import { getLeaseById, type LandlordActiveLease } from "@/api/leasesApi";
import { LeaseDocumentView } from "@/components/leases/LeaseDocumentView";
import { triggerDocumentDownload } from "@/lib/documentRendering";
import { downloadLeaseSummaryPdf } from "@/utils/leaseSummaryPdf";
import { printSummaryDocument } from "@/utils/printSummary";

const leaseSummaryTheme = {
  card: "#fffaf1",
  borderStrong: "rgba(91, 70, 48, 0.3)",
  charcoal: "#211c17",
  muted: "#63594d",
  pine: "#245842",
  pineSoft: "rgba(36, 88, 66, 0.12)",
} as const;

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function formatCurrency(value: number | null | undefined) {
  const amount = typeof value === "number" ? value : 0;
  return amount.toLocaleString(undefined, { style: "currency", currency: "CAD" });
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

function sectionTargetFromLocation(location: { hash: string; search: string }) {
  const hashTarget = location.hash.replace(/^#/, "").trim();
  if (hashTarget) return hashTarget;
  const section = new URLSearchParams(location.search).get("section");
  if (!section) return null;
  if (section === "rent-payment") return "lease-section-rent-payment";
  if (section === "audit-events") return "lease-section-audit-events";
  return null;
}

function workflowFocusForSection(sectionId: string | null) {
  if (sectionId === "lease-section-rent-payment") {
    return {
      title: "Rent and Payment workflow focus",
      description: "Review rent terms, deposit handling, rent collection readiness, and payment setup context in this section.",
    };
  }
  if (sectionId === "lease-section-audit-events") {
    return {
      title: "Audit and Events workflow focus",
      description: "Review execution, notice, renewal, move-out, and lifecycle context in this section.",
    };
  }
  return null;
}

export default function LandlordLeaseSummaryPage() {
  const { leaseId = "" } = useParams();
  const location = useLocation();
  const [lease, setLease] = React.useState<LandlordActiveLease | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const activeSectionId = sectionTargetFromLocation(location);
  const workflowFocus = workflowFocusForSection(activeSectionId);

  React.useEffect(() => {
    let active = true;

    async function load() {
      if (!leaseId) {
        setError("Missing lease id.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await getLeaseById(leaseId);
        if (!active) return;
        setLease(response.lease || null);
      } catch (err: unknown) {
        if (!active) return;
        setError(errorMessage(err, "Failed to load lease summary."));
        setLease(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [leaseId]);

  React.useEffect(() => {
    if (!lease || loading || !activeSectionId) return;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(activeSectionId);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeSectionId, lease, loading]);

  const ledgerPath = lease ? `/leases/${encodeURIComponent(lease.id)}/ledger` : `/leases/${encodeURIComponent(leaseId)}/ledger`;
  async function handlePrintOrSavePdf() {
    if (!lease) return;
    if (typeof window !== "undefined" && typeof window.print === "function") {
      await printSummaryDocument("summary");
      return;
    }
    downloadLeaseSummaryPdf(lease);
  }

  async function handleDownloadEvidencePackage() {
    if (!lease) return;
    try {
      const { blob, filename } = await downloadAuthenticatedExport({
        path: `/landlord/evidence-packages/leases/${encodeURIComponent(lease.id)}.pdf`,
        fallbackFilename: `lease-evidence-package-${encodeURIComponent(lease.id)}.pdf`,
        errorMessage: "Failed to download evidence package.",
        observability: {
          exportType: "lease_evidence_package",
          renderingPath: "backend_pdfkit",
        },
      });
      triggerDocumentDownload({ blob, filename, urlApi: URL });
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to download evidence package."));
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: leaseSummaryTheme.charcoal }}>Lease summary</div>
        <div style={{ color: leaseSummaryTheme.muted, fontSize: 14 }}>
          Review the current landlord-visible lease details when a separate lease document is not attached.
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link
          to={ledgerPath}
          style={leaseSummaryActionStyle}
        >
          Open payment ledger
        </Link>
          <button
            type="button"
            onClick={() => void handlePrintOrSavePdf()}
          disabled={!lease}
          style={leaseSummaryActionStyle}
        >
          Print / Save PDF
        </button>
        <button
          type="button"
          onClick={() => void handleDownloadEvidencePackage()}
          disabled={!lease}
          style={leaseSummaryActionStyle}
        >
          Download evidence package
        </button>
        <Link
          to="/leases"
          style={leaseSummaryActionStyle}
        >
          Back to leases
        </Link>
        <Link
          to="/operations"
          style={leaseSummaryActionStyle}
        >
          Open operations
        </Link>
      </div>

      {loading ? <div>Loading lease summary…</div> : null}
      {error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}

      {workflowFocus ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            border: `1px solid ${leaseSummaryTheme.borderStrong}`,
            borderRadius: 10,
            background: leaseSummaryTheme.pineSoft,
            color: leaseSummaryTheme.pine,
            padding: "10px 12px",
            display: "grid",
            gap: 3,
            boxShadow: "0 8px 18px rgba(59, 44, 28, 0.07)",
          }}
        >
          <div style={{ fontWeight: 800 }}>{workflowFocus.title}</div>
          <div style={{ fontSize: 13, color: leaseSummaryTheme.muted }}>{workflowFocus.description}</div>
        </div>
      ) : null}

      {lease ? (
        <>
          <LeaseDocumentView lease={lease} activeSectionId={activeSectionId} />
          <div className="print-only print-only-summary" aria-hidden="true">
            <LeaseDocumentView lease={lease} anchorIds={false} />
          </div>
        </>
      ) : null}
    </div>
  );
}

const leaseSummaryActionStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: `1px solid ${leaseSummaryTheme.borderStrong}`,
  background: leaseSummaryTheme.card,
  color: leaseSummaryTheme.pine,
  textDecoration: "none",
  fontWeight: 700,
};
