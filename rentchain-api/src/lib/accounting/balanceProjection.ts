import {
  normalizeReceivableTransaction,
  parseDateOnly,
  sortReceivableFindings,
  type ReceivableFinding,
  type ReceivableTransaction,
} from "./receivablesTypes";

export type ReceivableBalanceProjection = {
  chargeCents: number;
  creditCents: number;
  appliedPaymentCents: number;
  reversalCents: number;
  writeOffCents: number;
  adjustmentIncreaseCents: number;
  adjustmentDecreaseCents: number;
  netBalanceCents: number;
  outstandingCents: number;
  overpaymentCents: number;
  transactionCount: number;
  findings: ReceivableFinding[];
};

export type ReceivableProjectionScope = {
  leaseId?: string;
  propertyId?: string;
  asOfDate?: string;
};

function normalizedTransactions(inputs: readonly unknown[], findings: ReceivableFinding[]): ReceivableTransaction[] {
  const seen = new Set<string>();
  const result: ReceivableTransaction[] = [];
  for (const input of inputs) {
    const normalized = normalizeReceivableTransaction(input);
    findings.push(...normalized.findings);
    if (!normalized.transaction) continue;
    if (seen.has(normalized.transaction.transactionId)) {
      findings.push({ code: "duplicate_transaction_id", severity: "error", transactionId: normalized.transaction.transactionId });
      continue;
    }
    seen.add(normalized.transaction.transactionId);
    result.push(normalized.transaction);
  }
  return result.sort((a, b) =>
    [a.effectiveDate, a.transactionId].join(":").localeCompare([b.effectiveDate, b.transactionId].join(":"))
  );
}

export function projectReceivableBalance(
  inputs: readonly unknown[],
  scope: ReceivableProjectionScope = {}
): ReceivableBalanceProjection {
  const findings: ReceivableFinding[] = [];
  const asOf = scope.asOfDate ? parseDateOnly(scope.asOfDate) : null;
  if (scope.asOfDate && !asOf) findings.push({ code: "invalid_date_only", severity: "error", field: "asOfDate" });
  const all = normalizedTransactions(inputs, findings);
  const scoped = all.filter((transaction) => {
    if (scope.leaseId && transaction.leaseId !== scope.leaseId) return false;
    if (scope.propertyId && transaction.propertyId !== scope.propertyId) return false;
    if (asOf && parseDateOnly(transaction.effectiveDate)!.epochDay > asOf.epochDay) return false;
    return true;
  });
  const byId = new Map(scoped.map((transaction) => [transaction.transactionId, transaction]));
  const reversedTargets = new Set<string>();
  const valid: ReceivableTransaction[] = [];

  for (const transaction of scoped) {
    if (transaction.type === "nsf_fee") continue;
    if (transaction.type !== "payment_reversal") {
      valid.push(transaction);
      continue;
    }
    const targetId = transaction.reversesTransactionId;
    const target = targetId ? byId.get(targetId) : null;
    if (!target || target.type !== "payment_applied") {
      findings.push({ code: "invalid_payment_reversal_target", severity: "error", transactionId: transaction.transactionId });
      continue;
    }
    if (target.transactionId === transaction.transactionId) {
      findings.push({ code: "self_reversal_not_allowed", severity: "error", transactionId: transaction.transactionId });
      continue;
    }
    if (
      target.leaseId !== transaction.leaseId ||
      target.propertyId !== transaction.propertyId ||
      target.currency !== transaction.currency ||
      target.amountCents !== transaction.amountCents
    ) {
      findings.push({ code: "payment_reversal_mismatch", severity: "error", transactionId: transaction.transactionId });
      continue;
    }
    if (reversedTargets.has(target.transactionId)) {
      findings.push({ code: "duplicate_payment_reversal", severity: "error", transactionId: transaction.transactionId });
      continue;
    }
    reversedTargets.add(target.transactionId);
    valid.push(transaction);
  }

  let chargeCents = 0;
  let creditCents = 0;
  let appliedPaymentCents = 0;
  let reversalCents = 0;
  let writeOffCents = 0;
  let adjustmentIncreaseCents = 0;
  let adjustmentDecreaseCents = 0;
  let netBalanceCents = 0;

  for (const transaction of valid) {
    switch (transaction.type) {
      case "scheduled_rent_charge":
      case "deposit_charge":
      case "one_time_charge":
        chargeCents += transaction.amountCents;
        netBalanceCents += transaction.amountCents;
        break;
      case "credit":
        creditCents += transaction.amountCents;
        netBalanceCents -= transaction.amountCents;
        break;
      case "payment_applied":
        appliedPaymentCents += transaction.amountCents;
        netBalanceCents -= transaction.amountCents;
        break;
      case "payment_reversal":
        reversalCents += transaction.amountCents;
        netBalanceCents += transaction.amountCents;
        break;
      case "write_off":
        writeOffCents += transaction.amountCents;
        netBalanceCents -= transaction.amountCents;
        break;
      case "adjustment":
        if (transaction.metadata.adjustmentDirection === "increase") {
          adjustmentIncreaseCents += transaction.amountCents;
          netBalanceCents += transaction.amountCents;
        } else {
          adjustmentDecreaseCents += transaction.amountCents;
          netBalanceCents -= transaction.amountCents;
        }
        break;
      case "nsf_fee":
        break;
    }
  }

  return {
    chargeCents,
    creditCents,
    appliedPaymentCents,
    reversalCents,
    writeOffCents,
    adjustmentIncreaseCents,
    adjustmentDecreaseCents,
    netBalanceCents,
    outstandingCents: Math.max(0, netBalanceCents),
    overpaymentCents: Math.max(0, -netBalanceCents),
    transactionCount: valid.length,
    findings: sortReceivableFindings(findings),
  };
}
