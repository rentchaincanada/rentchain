// @ts-nocheck
import { getTenantLedger } from "./tenantLedgerService";
import { getPaymentsForTenant } from "./paymentsService";
import { getTenantDetailBundle } from "./tenantDetailsService";

export type TenantPaymentBehaviorSummary = {
  onTimeRate: number | null;
  avgDaysLate: number | null;
  totalPayments: number;
  paymentsLast12Months: number;
  firstPaymentDate?: string | null;
  lastPaymentDate?: string | null;
};

export type TenantLedgerSummary = {
  currentBalance: number;
  totalCharges: number;
  totalPayments: number;
  netLifetime: number;
};

export type TenantReportData = {
  tenantId: string;
  tenantName: string;
  propertyName?: string | null;
  unitLabel?: string | null;
  createdAt?: string | null;
  behavior: TenantPaymentBehaviorSummary;
  ledgerSummary: TenantLedgerSummary;
  payments: any[];
  ledgerEntries: any[];
};

let PDFDocument: any | null = null;

async function loadPDFKit() {
  if (PDFDocument) return PDFDocument;
  try {
    const mod: any = await import("pdfkit");
    PDFDocument = mod?.default ?? mod;
    return PDFDocument;
  } catch (err) {
    const e: any = new Error("PDFKIT_MISSING");
    e.cause = err;
    throw e;
  }
}

const parseDate = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export async function buildTenantReportData(
  tenantId: string
): Promise<TenantReportData> {
  const bundle = await getTenantDetailBundle(tenantId);
  const payments = await getPaymentsForTenant(tenantId);
  const ledgerEntries = await getTenantLedger(tenantId);

  const behavior: TenantPaymentBehaviorSummary = {
    onTimeRate: null,
    avgDaysLate: null,
    totalPayments: 0,
    paymentsLast12Months: 0,
    firstPaymentDate: null,
    lastPaymentDate: null,
  };

  const now = new Date();
  const twelveMonthsAgo = new Date(
    now.getFullYear() - 1,
    now.getMonth(),
    now.getDate()
  );

  const paymentsForStats = payments.map((p: any) => ({
    dueDate: parseDate((p as any).dueDate),
    paidAt: parseDate((p as any).paidAt || (p as any).date),
  }));

  const withDueAndPaid = paymentsForStats.filter(
    (p) => p.dueDate && p.paidAt
  );

  let onTimeCount = 0;
  let lateCount = 0;
  let totalLateDays = 0;
  let firstPayment: Date | null = null;
  let lastPayment: Date | null = null;
  let paymentsLast12 = 0;

  withDueAndPaid.forEach((p) => {
    if (!p.dueDate || !p.paidAt) return;

    if (!firstPayment || p.paidAt < firstPayment) {
      firstPayment = p.paidAt;
    }
    if (!lastPayment || p.paidAt > lastPayment) {
      lastPayment = p.paidAt;
    }

    if (p.paidAt >= twelveMonthsAgo) {
      paymentsLast12 += 1;
    }

    const diffMs = p.paidAt.getTime() - p.dueDate.getTime();
    const daysLate = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (daysLate <= 0) {
      onTimeCount += 1;
    } else {
      lateCount += 1;
      totalLateDays += daysLate;
    }
  });

  const totalCount = onTimeCount + lateCount;
  behavior.totalPayments = totalCount;
  behavior.paymentsLast12Months = paymentsLast12;
  behavior.onTimeRate = totalCount > 0 ? onTimeCount / totalCount : null;
  behavior.avgDaysLate = lateCount > 0 ? totalLateDays / lateCount : null;
  behavior.firstPaymentDate = firstPayment
    ? firstPayment.toISOString().slice(0, 10)
    : null;
  behavior.lastPaymentDate = lastPayment
    ? lastPayment.toISOString().slice(0, 10)
    : null;

  let currentBalance = 0;
  let totalCharges = 0;
  let totalPaymentsAmount = 0;

  if (ledgerEntries && ledgerEntries.length > 0) {
    const last = ledgerEntries[0];
    if (typeof (last as any).runningBalance === "number") {
      currentBalance = (last as any).runningBalance;
    } else {
      currentBalance = ledgerEntries.reduce(
        (acc: number, e: any) => acc + (e.amount || 0),
        0
      );
    }

    ledgerEntries.forEach((e: any) => {
      if (e.type === "charge") {
        totalCharges += e.amount || 0;
      } else if (e.type === "payment") {
        totalPaymentsAmount += e.amount || 0;
      }
    });
  }

  const ledgerSummary: TenantLedgerSummary = {
    currentBalance,
    totalCharges,
    totalPayments: totalPaymentsAmount,
    netLifetime: totalPaymentsAmount + totalCharges,
  };

  return {
    tenantId,
    tenantName:
      bundle?.tenant?.fullName ||
      bundle?.tenant?.name ||
      "Unknown tenant",
    propertyName: bundle?.tenant?.propertyName ?? null,
    unitLabel: (bundle?.tenant as any)?.unit ?? null,
    createdAt: (bundle?.tenant as any)?.createdAt ?? null,
    behavior,
    ledgerSummary,
    payments,
    ledgerEntries,
  };
}

export async function generateTenantReportPdfBuffer(
  tenantId: string
): Promise<Buffer> {
  const PDF = await loadPDFKit();
  const data = await buildTenantReportData(tenantId);

  const doc = new PDF({
    size: "A4",
    margin: 40,
  });

  const chunks: Buffer[] = [];
  return await new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    doc
      .fontSize(18)
      .text("Tenant Payment History Report", { align: "left" })
      .moveDown(0.5);

    doc
      .fontSize(11)
      .fillColor("#555555")
      .text(`Generated: ${new Date().toLocaleString()}`)
      .moveDown(0.5);

    doc
      .fontSize(12)
      .fillColor("#000000")
      .text(`Tenant: ${data.tenantName}`, { continued: true })
      .text(`   (ID: ${data.tenantId})`)
      .moveDown(0.25);

    if (data.propertyName || data.unitLabel) {
      doc
        .fontSize(11)
        .fillColor("#333333")
        .text(
          `Property: ${data.propertyName || "N/A"}   Unit: ${
            data.unitLabel || "N/A"
          }`
        )
        .moveDown(0.5);
    }

    doc
      .moveDown(0.5)
      .strokeColor("#cccccc")
      .lineWidth(1)
      .moveTo(40, doc.y)
      .lineTo(555, doc.y)
      .stroke()
      .moveDown(0.5);

    doc
      .fontSize(14)
      .fillColor("#000000")
      .text("Payment behavior summary", { underline: true })
      .moveDown(0.4);

    const onTimeRatePercent =
      data.behavior.onTimeRate != null
        ? `${(data.behavior.onTimeRate * 100).toFixed(0)}%`
        : "Not enough data";

    const avgLate =
      data.behavior.avgDaysLate != null
        ? `${data.behavior.avgDaysLate.toFixed(1)} days`
        : "Not enough data";

    doc
      .fontSize(11)
      .fillColor("#000000")
      .text(`Total recorded payments: ${data.behavior.totalPayments}`)
      .moveDown(0.1);
    doc.fontSize(11).text(`On-time rate: ${onTimeRatePercent}`).moveDown(0.1);
    doc
      .fontSize(11)
      .text(`Average days late (when late): ${avgLate}`)
      .moveDown(0.1);
    doc
      .fontSize(11)
      .text(
        `Payments in last 12 months: ${data.behavior.paymentsLast12Months}`
      )
      .moveDown(0.1);
    doc
      .fontSize(11)
      .text(
        `First recorded payment: ${data.behavior.firstPaymentDate || "N/A"}`
      )
      .moveDown(0.1);
    doc
      .fontSize(11)
      .text(
        `Most recent recorded payment: ${
          data.behavior.lastPaymentDate || "N/A"
        }`
      )
      .moveDown(0.5);

    doc
      .moveDown(0.3)
      .strokeColor("#e5e5e5")
      .lineWidth(0.5)
      .moveTo(40, doc.y)
      .lineTo(555, doc.y)
      .stroke()
      .moveDown(0.5);

    doc
      .fontSize(14)
      .fillColor("#000000")
      .text("Ledger summary", { underline: true })
      .moveDown(0.4);

    doc
      .fontSize(11)
      .text(
        `Current balance: ${data.ledgerSummary.currentBalance >= 0 ? "+" : "-"}$${Math.abs(
          data.ledgerSummary.currentBalance
        ).toFixed(2)}`
      )
      .moveDown(0.1);
    doc
      .fontSize(11)
      .text(
        `Lifetime charges: $${data.ledgerSummary.totalCharges.toFixed(2)}`
      )
      .moveDown(0.1);
    doc
      .fontSize(11)
      .text(
        `Lifetime payments: $${data.ledgerSummary.totalPayments.toFixed(2)}`
      )
      .moveDown(0.1);
    doc
      .fontSize(11)
      .text(
        `Net lifetime (payments + charges): $${data.ledgerSummary.netLifetime.toFixed(
          2
        )}`
      )
      .moveDown(0.5);

    doc
      .moveDown(0.3)
      .strokeColor("#e5e5e5")
      .lineWidth(0.5)
      .moveTo(40, doc.y)
      .lineTo(555, doc.y)
      .stroke()
      .moveDown(0.5);

    doc
      .fontSize(13)
      .fillColor("#000000")
      .text("Recent ledger entries", { underline: true })
      .moveDown(0.3);

    const maxLedgerRows = 12;
    const ledgerSlice = (data.ledgerEntries || []).slice(0, maxLedgerRows);

    if (ledgerSlice.length === 0) {
      doc.fontSize(11).text("No ledger entries on file.").moveDown(0.5);
    } else {
      ledgerSlice.forEach((entry: any) => {
        doc
          .fontSize(11)
          .fillColor("#000000")
          .text(
            `${entry.date || "Unknown date"}  |  ${entry.type || "entry"}  |  ${entry.label || ""}`
          );
        doc
          .fontSize(10)
          .fillColor("#444444")
          .text(
            `Amount: ${entry.type === "payment" ? "+" : ""}$${Number(
              entry.amount || 0
            ).toFixed(2)}   |   Balance: $${Number(
              entry.runningBalance || 0
            ).toFixed(2)}`,
            { indent: 12 }
          )
          .moveDown(0.25);
      });
      if ((data.ledgerEntries || []).length > maxLedgerRows) {
        doc
          .fontSize(10)
          .fillColor("#666666")
          .text(
            `(+ ${data.ledgerEntries.length - maxLedgerRows} additional entries not shown in this summary)`,
            { italic: true }
          )
          .moveDown(0.5);
      }
    }

    doc
      .moveDown(0.5)
      .fontSize(9)
      .fillColor("#666666")
      .text(
        "This report is based on internal records and is for informational purposes only.",
        {
          align: "left",
        }
      );

    doc.end();
  });
}
