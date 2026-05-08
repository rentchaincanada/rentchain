import type { LandlordActiveLease } from "@/api/leasesApi";
import { shouldStartNewPage, triggerDocumentDownload, wrapTextForPdf } from "@/lib/documentRendering";
import { composeLeaseSummaryLegalDocument } from "@/lib/legalDocumentComposition";
import { createPdfExportTimer, recordPdfExportEvent } from "@/lib/pdfExportObservability";

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

export function buildLeaseSummaryPdfSource(lease: LandlordActiveLease) {
  const documentDefinition = composeLeaseSummaryLegalDocument(lease, {
    currency: formatCurrency,
    date: formatDate,
    status: prettyLeaseStatus,
  });

  const page = { width: 612, height: 792 };
  const docX = 54;
  const docY = 52;
  const docWidth = 504;
  const docHeight = 688;
  const bottomY = 88;
  const pageTopY = 704;
  const pages: string[][] = [];
  let content: string[] = [];
  let y = 704;

  const addPage = () => {
    content = [];
    pages.push(content);
    y = pageTopY;
  };

  const textAt = (text: string, x: number, baselineY: number, size = 10, font = "F1") => {
    content.push(`BT /${font} ${size} Tf ${x} ${baselineY} Td (${escapePdfText(text)}) Tj ET`);
  };
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    content.push(`q 0.86 0.89 0.93 RG ${x1} ${y1} m ${x2} ${y2} l S Q`);
  };
  const rect = (x: number, rectY: number, width: number, height: number, fill = false) => {
    content.push(`q ${fill ? "0.97 0.98 0.99 rg" : "0.86 0.89 0.93 RG"} ${x} ${rectY} ${width} ${height} re ${fill ? "f" : "S"} Q`);
  };
  const drawPageFrame = () => {
    rect(docX, docY, docWidth, docHeight);
  };
  const ensureSpace = (neededHeight: number) => {
    if (!shouldStartNewPage({ cursorY: y, neededHeight, bottomY })) return;
    addPage();
    drawPageFrame();
  };

  addPage();
  drawPageFrame();
  textAt(documentDefinition.eyebrow, 236, y, 10, "F2");
  y -= 24;
  textAt(documentDefinition.title, 193, y, 20, "F2");
  y -= 18;
  textAt(documentDefinition.description, 128, y, 10);
  y -= 30;

  documentDefinition.sections.forEach((section) => {
    ensureSpace(48);
    line(84, y + 14, 528, y + 14);
    textAt(section.title, 84, y, 13, "F2");
    y -= 22;

    section.fields.forEach((field) => {
      ensureSpace(34);
      rect(84, y - 8, 444, 24, true);
      textAt(field.label.toUpperCase(), 96, y, 8, "F2");
      textAt(field.value, 252, y, 10);
      y -= 28;
    });

    if (section.note) {
      const wrapped = wrapTextForPdf(String(section.note), 86);
      wrapped.forEach((wrappedLine) => {
        ensureSpace(18);
        textAt(wrappedLine, 96, y, 10);
        y -= 14;
      });
      y -= 6;
    }
    y -= 10;
  });

  const pageObjectIds = pages.map((_, index) => 5 + index * 2);
  const contentObjectIds = pages.map((_, index) => 6 + index * 2);
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    `2 0 obj << /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >> endobj\n`,
    "3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj\n",
  ];
  pages.forEach((pageContent, index) => {
    const stream = pageContent.join("\n");
    objects.push(
      `${pageObjectIds[index]} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectIds[index]} 0 R >> endobj\n`,
      `${contentObjectIds[index]} 0 obj << /Length ${new TextEncoder().encode(stream).length} >> stream\n${stream}\nendstream endobj\n`
    );
  });
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
  return pdf;
}

export function buildLeaseSummaryPdf(lease: LandlordActiveLease) {
  return new Blob([buildLeaseSummaryPdfSource(lease)], { type: "application/pdf" });
}

export function downloadLeaseSummaryPdf(lease: LandlordActiveLease) {
  const timer = createPdfExportTimer();
  recordPdfExportEvent("pdf_export_started", {
    exportType: "lease_summary",
    renderingPath: "frontend_pdf_builder",
    status: "started",
  });
  const blob = buildLeaseSummaryPdf(lease);
  recordPdfExportEvent("pdf_export_completed", {
    exportType: "lease_summary",
    renderingPath: "frontend_pdf_builder",
    status: "completed",
    durationMs: timer.durationMs(),
    byteSize: blob.size,
  });
  triggerDocumentDownload({
    blob,
    filename: `lease-${lease.unitNumber || lease.id}.pdf`,
    urlApi: window.URL,
  });
}
