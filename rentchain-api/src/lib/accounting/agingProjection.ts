import {
  normalizeReceivableTransaction,
  parseDateOnly,
  sortReceivableFindings,
  type ReceivableFinding,
  type ReceivableTransaction,
} from "./receivablesTypes";

export type ReceivableAgingBucket = "current" | "days_1_30" | "days_31_60" | "days_61_90" | "days_90_plus";
export type ReceivableAgingAllocationPolicy = "explicit" | "oldest_due_first";

export type ReceivableAgingRow = {
  transactionId: string;
  dueDate: string;
  originalAmountCents: number;
  outstandingCents: number;
  daysPastDue: number;
  bucket: ReceivableAgingBucket;
};

export type ReceivableAgingProjection = {
  asOfDate: string;
  allocationPolicy: ReceivableAgingAllocationPolicy;
  currentCents: number;
  days1To30Cents: number;
  days31To60Cents: number;
  days61To90Cents: number;
  days90PlusCents: number;
  totalOutstandingCents: number;
  chargeRows: ReceivableAgingRow[];
  findings: ReceivableFinding[];
};

function bucketFor(daysPastDue: number): ReceivableAgingBucket {
  if (daysPastDue <= 0) return "current";
  if (daysPastDue <= 30) return "days_1_30";
  if (daysPastDue <= 60) return "days_31_60";
  if (daysPastDue <= 90) return "days_61_90";
  return "days_90_plus";
}

export function projectReceivableAging(input: {
  transactions: readonly unknown[];
  asOfDate: string;
  allocationPolicy?: ReceivableAgingAllocationPolicy;
  leaseId?: string;
  propertyId?: string;
}): ReceivableAgingProjection {
  const findings: ReceivableFinding[] = [];
  const asOf = parseDateOnly(input.asOfDate);
  const policy = input.allocationPolicy || "explicit";
  if (!asOf) findings.push({ code: "invalid_date_only", severity: "error", field: "asOfDate" });
  const transactions: ReceivableTransaction[] = [];
  const seen = new Set<string>();
  for (const raw of input.transactions) {
    const result = normalizeReceivableTransaction(raw);
    findings.push(...result.findings);
    if (!result.transaction) continue;
    if (seen.has(result.transaction.transactionId)) {
      findings.push({ code: "duplicate_transaction_id", severity: "error", transactionId: result.transaction.transactionId });
      continue;
    }
    seen.add(result.transaction.transactionId);
    if (input.leaseId && result.transaction.leaseId !== input.leaseId) continue;
    if (input.propertyId && result.transaction.propertyId !== input.propertyId) continue;
    if (asOf && parseDateOnly(result.transaction.effectiveDate)!.epochDay > asOf.epochDay) continue;
    if (result.transaction.type !== "nsf_fee") transactions.push(result.transaction);
  }

  const chargeTypes = new Set(["scheduled_rent_charge", "deposit_charge", "one_time_charge"]);
  const charges = transactions
    .filter((transaction) => chargeTypes.has(transaction.type))
    .filter((transaction) => {
      if (transaction.dueDate) return true;
      findings.push({ code: "charge_due_date_required", severity: "error", transactionId: transaction.transactionId, field: "dueDate" });
      return false;
    })
    .map((transaction) => ({ transaction, outstandingCents: transaction.amountCents }))
    .sort((a, b) => [a.transaction.dueDate, a.transaction.transactionId].join(":").localeCompare([b.transaction.dueDate, b.transaction.transactionId].join(":")));
  const chargeById = new Map(charges.map((row) => [row.transaction.transactionId, row]));
  const reductions = transactions.filter((transaction) => ["credit", "payment_applied", "write_off"].includes(transaction.type));
  const reductionById = new Map(reductions.map((transaction) => [transaction.transactionId, transaction]));
  const reversedReductionIds = new Set<string>();
  for (const reversal of transactions.filter((transaction) => transaction.type === "payment_reversal")) {
    const target = reversal.reversesTransactionId ? reductionById.get(reversal.reversesTransactionId) : null;
    if (!target || target.type !== "payment_applied") {
      findings.push({ code: "invalid_payment_reversal_target", severity: "error", transactionId: reversal.transactionId });
      continue;
    }
    if (
      target.leaseId !== reversal.leaseId ||
      target.propertyId !== reversal.propertyId ||
      target.currency !== reversal.currency ||
      target.amountCents !== reversal.amountCents
    ) {
      findings.push({ code: "payment_reversal_mismatch", severity: "error", transactionId: reversal.transactionId });
      continue;
    }
    if (reversedReductionIds.has(target.transactionId)) {
      findings.push({ code: "duplicate_payment_reversal", severity: "error", transactionId: reversal.transactionId });
      continue;
    }
    reversedReductionIds.add(target.transactionId);
  }

  for (const reduction of reductions) {
    if (reversedReductionIds.has(reduction.transactionId)) continue;
    let remaining = reduction.amountCents;
    if (reduction.appliesToTransactionId) {
      const charge = chargeById.get(reduction.appliesToTransactionId);
      if (!charge) {
        findings.push({ code: "allocation_target_not_found", severity: "error", transactionId: reduction.transactionId });
        continue;
      }
      const applied = Math.min(remaining, charge.outstandingCents);
      charge.outstandingCents -= applied;
      remaining -= applied;
    } else if (policy === "oldest_due_first") {
      for (const charge of charges) {
        if (remaining <= 0) break;
        const applied = Math.min(remaining, charge.outstandingCents);
        charge.outstandingCents -= applied;
        remaining -= applied;
      }
    } else {
      findings.push({ code: "allocation_required", severity: "review", transactionId: reduction.transactionId, field: "appliesToTransactionId" });
      continue;
    }
    if (remaining > 0) findings.push({ code: "unapplied_reduction_balance", severity: "review", transactionId: reduction.transactionId });
  }

  const chargeRows: ReceivableAgingRow[] = asOf
    ? charges
        .filter((row) => row.outstandingCents > 0)
        .map((row) => {
          const due = parseDateOnly(row.transaction.dueDate)!;
          const daysPastDue = asOf.epochDay - due.epochDay;
          return {
            transactionId: row.transaction.transactionId,
            dueDate: due.value,
            originalAmountCents: row.transaction.amountCents,
            outstandingCents: row.outstandingCents,
            daysPastDue,
            bucket: bucketFor(daysPastDue),
          };
        })
    : [];
  const sumBucket = (bucket: ReceivableAgingBucket) => chargeRows.filter((row) => row.bucket === bucket).reduce((sum, row) => sum + row.outstandingCents, 0);
  return {
    asOfDate: asOf?.value || input.asOfDate,
    allocationPolicy: policy,
    currentCents: sumBucket("current"),
    days1To30Cents: sumBucket("days_1_30"),
    days31To60Cents: sumBucket("days_31_60"),
    days61To90Cents: sumBucket("days_61_90"),
    days90PlusCents: sumBucket("days_90_plus"),
    totalOutstandingCents: chargeRows.reduce((sum, row) => sum + row.outstandingCents, 0),
    chargeRows,
    findings: sortReceivableFindings(findings),
  };
}
