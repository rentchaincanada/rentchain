// @ts-nocheck
import { db } from "../config/firebase";
import {
  deriveFinancialProjectionRows,
  type FinancialProjectionRow,
  type FinancialProjectionSourceType,
} from "./financialProjectionService";
import { getTenantLedger } from "./tenantLedgerService";
import { getTenantDetailBundle } from "./tenantDetailsService";
import { formatInternalReference } from "../lib/identityReferences";

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
  financialActivityRows: FinancialProjectionRow[];
};

const PDF_LEFT = 40;
const PDF_RIGHT = 555;
const PDF_BOTTOM_MARGIN = 40;

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

const toMillis = (value: any): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value?.toMillis === "function") {
    try {
      return Number(value.toMillis()) || 0;
    } catch {
      return 0;
    }
  }
  if (typeof value?.seconds === "number") return Number(value.seconds) * 1000;
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

async function loadPersistedPaymentsForTenant(tenantId: string) {
  const snap = await db
    .collection("payments")
    .where("tenantId", "==", tenantId)
    .orderBy("paidAt", "desc")
    .limit(200)
    .get();

  return snap.docs.map((doc: any) => {
    const raw = doc.data() as any;
    return {
      id: doc.id,
      tenantId: String(raw?.tenantId || "").trim() || tenantId,
      propertyId: String(raw?.propertyId || "").trim() || null,
      amount: Number(raw?.amount ?? 0),
      paidAt: String(raw?.paidAt || "").trim(),
      dueDate: raw?.dueDate ?? null,
      method: raw?.method ?? null,
      notes: raw?.notes ?? null,
      status: String(raw?.status || "").trim() || "Recorded",
    };
  });
}

function buildLedgerEntryLabel(entry: any) {
  const category = String(entry?.category || "").trim();
  const reference = String(entry?.reference || "").trim();
  const notes = String(entry?.notes || "").trim();

  if (entry?.entryType === "payment") {
    if (reference) return `Payment${entry?.method ? ` (${entry.method})` : ""} · ${reference}`;
    if (entry?.method) return `Payment (${entry.method})`;
    return "Payment";
  }

  if (category === "rent") return "Charge · rent";
  if (category === "fee") return "Charge · fee";
  if (category === "adjustment") return "Charge · adjustment";
  if (notes) return notes;
  return "Charge";
}

async function loadCurrentLeaseLedgerEntries(leaseId: string, landlordId?: string | null) {
  const snap = await db
    .collection("ledgerEntries")
    .where("leaseId", "==", leaseId)
    .get();

  const rawEntries = snap.docs
    .map((doc: any) => ({ id: doc.id, ...(doc.data() as any) }))
    .filter((entry: any) => {
      if (!landlordId) return true;
      return String(entry?.landlordId || "").trim() === String(landlordId).trim();
    })
    .sort((a: any, b: any) => {
      const dateDiff = String(a?.effectiveDate || "").localeCompare(String(b?.effectiveDate || ""));
      if (dateDiff !== 0) return dateDiff;
      return toMillis(a?.createdAt) - toMillis(b?.createdAt);
    });

  let runningBalanceCents = 0;
  const mappedAsc = rawEntries.map((entry: any) => {
    const amountCents = Math.abs(Number(entry?.amountCents || 0));
    const signedAmountCents =
      String(entry?.entryType || "").trim().toLowerCase() === "payment"
        ? -amountCents
        : amountCents;
    runningBalanceCents += signedAmountCents;
    return {
      id: entry.id,
      tenantId: null,
      date: String(entry?.effectiveDate || "").trim() || null,
      type: String(entry?.entryType || "").trim().toLowerCase() || "entry",
      amount: amountCents / 100,
      direction:
        String(entry?.entryType || "").trim().toLowerCase() === "payment"
          ? "credit"
          : "debit",
      method: entry?.method ?? null,
      label: buildLedgerEntryLabel(entry),
      notes: entry?.notes ?? null,
      referenceId: entry?.reference ?? null,
      runningBalance: runningBalanceCents / 100,
    };
  });

  return mappedAsc.reverse();
}

function ensurePdfSpace(doc: any, neededHeight: number) {
  const bottomLimit = Number(doc.page?.height || 842) - PDF_BOTTOM_MARGIN;
  if (doc.y + neededHeight <= bottomLimit) return false;
  doc.addPage();
  return true;
}

function drawLedgerTableHeader(doc: any, columns: Array<{ label: string; x: number; width: number }>) {
  doc
    .fontSize(10)
    .fillColor("#0f172a");
  columns.forEach((column) => {
    doc.text(column.label, column.x, doc.y, {
      width: column.width,
      align: column.label === "Amount" || column.label === "Balance" ? "right" : "left",
    });
  });
  doc.moveDown(0.2);
  const lineY = doc.y + 2;
  doc
    .strokeColor("#d4d4d8")
    .lineWidth(0.75)
    .moveTo(PDF_LEFT, lineY)
    .lineTo(PDF_RIGHT, lineY)
    .stroke();
  doc.y = lineY + 8;
}

const projectionGroupOrder: FinancialProjectionSourceType[] = [
  "recorded_payment",
  "lease_charge",
  "lease_credit",
  "ledger_payment_unmatched",
];

const projectionGroupLabels: Record<FinancialProjectionSourceType, string> = {
  recorded_payment: "Recorded Payments",
  lease_charge: "Lease Charges",
  lease_credit: "Lease Credits",
  ledger_payment_unmatched: "Unmatched Ledger Payments",
};

const projectionSourceLabels: Record<FinancialProjectionSourceType, string> = {
  recorded_payment: "Recorded Payment",
  lease_charge: "Lease Charge",
  lease_credit: "Credit",
  ledger_payment_unmatched: "Ledger Payment",
};

function drawProjectionTableHeader(doc: any, columns: Array<{ label: string; x: number; width: number }>) {
  doc.fontSize(10).fillColor("#0f172a");
  columns.forEach((column) => {
    doc.text(column.label, column.x, doc.y, {
      width: column.width,
      align: column.label === "Amount" ? "right" : "left",
    });
  });
  doc.moveDown(0.1);
  const lineY = doc.y + 1;
  doc
    .strokeColor("#d4d4d8")
    .lineWidth(0.75)
    .moveTo(PDF_LEFT, lineY)
    .lineTo(PDF_RIGHT, lineY)
    .stroke();
  doc.y = lineY + 6;
}

function formatProjectionDate(value: string | null | undefined) {
  const parsed = parseDate(value);
  if (!parsed) return "Unknown date";
  return parsed.toISOString().slice(0, 10);
}

function formatProjectionAmount(value: number, direction: string) {
  const magnitude = Math.abs(Number(value || 0)).toFixed(2);
  return `${direction === "debit" ? "-" : "+"}$${magnitude}`;
}

function buildProjectionContext(row: FinancialProjectionRow) {
  const parts = [row.propertyLabel, row.unitLabel ? `Unit ${row.unitLabel}` : null].filter(Boolean);
  return parts.length ? parts.join(" • ") : "—";
}

export async function buildTenantReportData(
  tenantId: string
): Promise<TenantReportData> {
  const bundle = await getTenantDetailBundle(tenantId);
  const currentLeaseId = String(
    bundle?.currentLease?.id ||
      bundle?.lease?.id ||
      bundle?.tenant?.currentLeaseId ||
      ""
  ).trim();
  const landlordId = String(bundle?.tenant?.landlordId || "").trim() || null;
  const payments = await loadPersistedPaymentsForTenant(tenantId);
  const ledgerEntries = currentLeaseId
    ? await loadCurrentLeaseLedgerEntries(currentLeaseId, landlordId)
    : await getTenantLedger(tenantId);
  const financialActivityRows = landlordId
    ? (await deriveFinancialProjectionRows({ landlordId, tenantId, limit: 48 })).rows
    : [];

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
    propertyName:
      bundle?.currentLease?.propertyName ??
      bundle?.lease?.propertyName ??
      bundle?.tenant?.propertyName ??
      null,
    unitLabel:
      bundle?.currentLease?.unit ??
      bundle?.lease?.unit ??
      (bundle?.tenant as any)?.unit ??
      null,
    createdAt: (bundle?.tenant as any)?.createdAt ?? null,
    behavior,
    ledgerSummary,
    payments,
    ledgerEntries,
    financialActivityRows,
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
      .text(`   (${formatInternalReference("tenant", data.tenantId)})`)
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
      .text("Recorded rent payment summary", { underline: true })
      .moveDown(0.2);

    doc
      .fontSize(10)
      .fillColor("#555555")
      .text(
        "This section uses recorded rent payments only. Lease ledger charges and credits are summarized separately below."
      )
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
      .text("Current lease ledger summary", { underline: true })
      .moveDown(0.2);

    doc
      .fontSize(10)
      .fillColor("#555555")
      .text(
        "This section uses the current lease ledger to show charges, credits, and running balance for the active lease."
      )
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
      .text("Financial activity overview", { underline: true })
      .moveDown(0.2);

    doc
      .fontSize(10)
      .fillColor("#555555")
      .text(
        "This read-only section combines recorded payments and lease ledger activity without changing the underlying records."
      )
      .moveDown(0.4);

    const projectionRows = Array.isArray(data.financialActivityRows) ? data.financialActivityRows : [];
    const groupedProjectionRows = new Map<FinancialProjectionSourceType, FinancialProjectionRow[]>();
    projectionGroupOrder.forEach((groupKey) => groupedProjectionRows.set(groupKey, []));
    projectionRows.forEach((row) => {
      const group = groupedProjectionRows.get(row.sourceType);
      if (group) group.push(row);
    });

    if (projectionRows.length === 0) {
      doc.fontSize(11).text("No financial activity is available for this tenant yet.").moveDown(0.5);
    } else {
      const columns = [
        { label: "Date", x: PDF_LEFT, width: 64 },
        { label: "Activity", x: 110, width: 134 },
        { label: "Context", x: 250, width: 158 },
        { label: "Amount", x: 414, width: 56 },
        { label: "Source", x: 476, width: 72 },
      ];

      projectionGroupOrder.forEach((groupKey) => {
        const items = groupedProjectionRows.get(groupKey) || [];
        if (!items.length) return;

        ensurePdfSpace(doc, 32);
        doc
          .fontSize(11)
          .fillColor("#0f172a")
          .text(projectionGroupLabels[groupKey])
          .moveDown(0.2);
        drawProjectionTableHeader(doc, columns);

        items.forEach((row) => {
          const rowValues = {
            date: formatProjectionDate(row.occurredAt),
            activity: String(row.displayLabel || "Financial activity"),
            context: buildProjectionContext(row),
            amount: formatProjectionAmount(row.amount, row.direction),
            source: projectionSourceLabels[row.sourceType] || "Financial item",
          };
          const rowHeight = Math.max(
            18,
            doc.heightOfString(rowValues.date, { width: columns[0].width }),
            doc.heightOfString(rowValues.activity, { width: columns[1].width }),
            doc.heightOfString(rowValues.context, { width: columns[2].width }),
            doc.heightOfString(rowValues.amount, { width: columns[3].width, align: "right" }),
            doc.heightOfString(rowValues.source, { width: columns[4].width })
          ) + 8;

          if (ensurePdfSpace(doc, rowHeight + 12)) {
            doc
              .fontSize(11)
              .fillColor("#0f172a")
              .text(projectionGroupLabels[groupKey])
              .moveDown(0.2);
            drawProjectionTableHeader(doc, columns);
          }

          const rowY = doc.y;
          doc.fontSize(9).fillColor("#000000");
          doc.text(rowValues.date, columns[0].x, rowY, { width: columns[0].width });
          doc.text(rowValues.activity, columns[1].x, rowY, { width: columns[1].width });
          doc.text(rowValues.context, columns[2].x, rowY, { width: columns[2].width });
          doc.text(rowValues.amount, columns[3].x, rowY, { width: columns[3].width, align: "right" });
          doc.text(rowValues.source, columns[4].x, rowY, { width: columns[4].width });

          const dividerY = rowY + rowHeight - 4;
          doc
            .strokeColor("#ececf1")
            .lineWidth(0.5)
            .moveTo(PDF_LEFT, dividerY)
            .lineTo(PDF_RIGHT, dividerY)
            .stroke();
          doc.y = rowY + rowHeight;
        });

        doc.moveDown(0.3);
      });
    }

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
      .text("Recent current lease ledger entries", { underline: true })
      .moveDown(0.3);

    const maxLedgerRows = 12;
    const ledgerSlice = (data.ledgerEntries || []).slice(0, maxLedgerRows);

    if (ledgerSlice.length === 0) {
      doc.fontSize(11).text("No ledger entries on file.").moveDown(0.5);
    } else {
      const columns = [
        { label: "Date", x: PDF_LEFT, width: 74 },
        { label: "Type", x: 118, width: 62 },
        { label: "Details", x: 186, width: 180 },
        { label: "Amount", x: 372, width: 78 },
        { label: "Balance", x: 456, width: 88 },
      ];

      drawLedgerTableHeader(doc, columns);

      ledgerSlice.forEach((entry: any) => {
        const rowValues = {
          date: String(entry.date || "Unknown date"),
          type: String(entry.type || "entry").replace(/_/g, " "),
          details: String(entry.label || entry.notes || "—"),
          amount: `${entry.type === "payment" ? "+" : ""}$${Number(entry.amount || 0).toFixed(2)}`,
          balance: `$${Number(entry.runningBalance || 0).toFixed(2)}`,
        };
        const rowHeight = Math.max(
          18,
          doc.heightOfString(rowValues.date, { width: columns[0].width }),
          doc.heightOfString(rowValues.type, { width: columns[1].width }),
          doc.heightOfString(rowValues.details, { width: columns[2].width }),
          doc.heightOfString(rowValues.amount, { width: columns[3].width, align: "right" }),
          doc.heightOfString(rowValues.balance, { width: columns[4].width, align: "right" })
        ) + 8;

        if (ensurePdfSpace(doc, rowHeight + 12)) {
          drawLedgerTableHeader(doc, columns);
        }

        const rowY = doc.y;
        doc.fontSize(10).fillColor("#000000");
        doc.text(rowValues.date, columns[0].x, rowY, { width: columns[0].width });
        doc.text(rowValues.type, columns[1].x, rowY, { width: columns[1].width });
        doc.text(rowValues.details, columns[2].x, rowY, { width: columns[2].width });
        doc.text(rowValues.amount, columns[3].x, rowY, { width: columns[3].width, align: "right" });
        doc.text(rowValues.balance, columns[4].x, rowY, { width: columns[4].width, align: "right" });

        const dividerY = rowY + rowHeight - 4;
        doc
          .strokeColor("#ececf1")
          .lineWidth(0.5)
          .moveTo(PDF_LEFT, dividerY)
          .lineTo(PDF_RIGHT, dividerY)
          .stroke();
        doc.y = rowY + rowHeight;
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
