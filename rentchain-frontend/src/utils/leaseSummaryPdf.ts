import type { LandlordActiveLease } from "@/api/leasesApi";

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

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function buildLeaseSummaryPdf(lease: LandlordActiveLease) {
  const lines = [
    { text: "RentChain lease record", size: 10 },
    { text: "Residential Lease Pack", size: 18 },
    { text: "Document-style summary generated from the current landlord lease record.", size: 10 },
    { text: "", size: 10 },
    { text: "Property and Unit", size: 13 },
    { text: `Property: ${lease.propertyName || lease.propertyLabel || lease.propertyAddress || "Property"}`, size: 10 },
    { text: `Unit: ${lease.unitNumber || "—"}`, size: 10 },
    { text: `Lease reference: ${lease.id}`, size: 10 },
    { text: "", size: 10 },
    { text: "Landlord and Tenant", size: 13 },
    { text: `Tenant: ${lease.tenantName || "Tenant not linked"}`, size: 10 },
    { text: `Tenant email: ${lease.tenantEmail || "No email on file"}`, size: 10 },
    { text: "Landlord record: Current RentChain landlord account", size: 10 },
    { text: "", size: 10 },
    { text: "Lease Term", size: 13 },
    { text: `Start date: ${formatDate(lease.startDate)}`, size: 10 },
    { text: `End date: ${formatDate(lease.endDate)}`, size: 10 },
    { text: `Current status: ${prettyLeaseStatus(lease.status)}`, size: 10 },
    { text: "", size: 10 },
    { text: "Rent and Payment Terms", size: 13 },
    { text: `Monthly rent: ${formatCurrency(lease.monthlyRent)}`, size: 10 },
    { text: `Payment readiness: ${lease.paymentReadiness?.readinessLabel || "Payment readiness unavailable"}`, size: 10 },
    { text: `Rent collection: ${lease.rentPaymentSummary?.paymentRail.enabled ? "Enabled" : "Not enabled"}`, size: 10 },
    ...(lease.paymentReadiness?.readinessDescription
      ? [{ text: lease.paymentReadiness.readinessDescription, size: 10 }]
      : []),
    { text: "", size: 10 },
    { text: "Clauses and Additional Terms", size: 13 },
    {
      text:
        "Full legal clauses remain in the attached lease document when one is available. This fallback view summarizes the landlord-visible lease record so the lease is still reviewable when no separate file is attached.",
      size: 10,
    },
  ];
  const contentLines = lines.map((line, index) => {
    const y = 760 - index * 18;
    return `BT /F1 ${line.size} Tf 54 ${y} Td (${escapePdfText(line.text)}) Tj ET`;
  });
  const stream = contentLines.join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
    `5 0 obj << /Length ${new TextEncoder().encode(stream).length} >> stream\n${stream}\nendstream endobj\n`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += object;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

export function downloadLeaseSummaryPdf(lease: LandlordActiveLease) {
  const blob = buildLeaseSummaryPdf(lease);
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `lease-${lease.unitNumber || lease.id}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
