export type LeaseStartTransactionErrorFactory = (kind: "idempotency" | "stale") => Error;

export type LeaseStartAtomicEvent = {
  ref: any;
  record: Record<string, unknown>;
};

export async function runLeaseStartTransaction<T>(
  firestore: any,
  execute: (transaction: any) => Promise<T>
): Promise<T> {
  return firestore.runTransaction(execute);
}

export async function readLeaseStartReplay<T>(input: {
  transaction: any;
  requestRef: any;
  payloadHash: string;
  error: LeaseStartTransactionErrorFactory;
}): Promise<T | null> {
  const prior = await input.transaction.get(input.requestRef);
  if (!prior.exists) return null;
  const data = prior.data() || {};
  if (data.payloadHash !== input.payloadHash) throw input.error("idempotency");
  return {
    ...data.result,
    outcome: "idempotent_replay",
    idempotency: { ...data.result.idempotency, replay: true },
  } as T;
}

export function assertLeaseStartExpectedState(
  actual: string,
  expected: string,
  error: LeaseStartTransactionErrorFactory
): void {
  if (actual !== expected) throw error("stale");
}

export function persistLeaseStartAtomicResult(input: {
  transaction: any;
  requestRef: any;
  requestRecord: Record<string, unknown>;
  events?: LeaseStartAtomicEvent[];
}): void {
  for (const event of input.events || []) {
    input.transaction.create(event.ref, event.record);
  }
  input.transaction.create(input.requestRef, input.requestRecord);
}
