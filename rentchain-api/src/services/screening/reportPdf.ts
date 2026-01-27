import PDFDocument from "pdfkit";

type ScreeningSummary = {
  overall: "pass" | "review" | "fail" | "unknown";
  scoreBand?: string;
  flags?: string[];
};

export async function buildScreeningPdf(params: {
  summary: ScreeningSummary | null;
  reportText?: string | null;
  applicationId: string;
}): Promise<Buffer> {
  const doc = new PDFDocument({ size: "LETTER", margin: 54 });
  const chunks: Buffer[] = [];

  doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));

  doc.fontSize(20).text("RentChain Screening Report", { align: "left" });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor("#6b7280").text(`Generated: ${new Date().toLocaleString()}`);
  doc.fillColor("#111827").moveDown(0.5);

  doc.fontSize(12).text(`Application ID: ${params.applicationId}`);
  doc.moveDown(0.5);

  doc.fontSize(14).text("Summary");
  doc.moveDown(0.25);
  if (params.summary) {
    doc.fontSize(12).text(`Overall: ${params.summary.overall}`);
    if (params.summary.scoreBand) {
      doc.fontSize(12).text(`Score band: ${params.summary.scoreBand}`);
    }
    if (params.summary.flags?.length) {
      doc.fontSize(12).text(`Flags: ${params.summary.flags.join(", ")}`);
    }
  } else {
    doc.fontSize(12).text("No summary available.");
  }

  doc.moveDown(0.75);
  doc.fontSize(14).text("Report");
  doc.moveDown(0.25);
  doc.fontSize(12).text(params.reportText || "No report text provided.");

  doc.moveDown(1.5);
  doc.fontSize(10).fillColor("#6b7280").text("For landlord use only.");
  doc.end();

  await new Promise<void>((resolve, reject) => {
    doc.on("end", () => resolve());
    doc.on("error", reject);
  });

  return Buffer.concat(chunks);
}
