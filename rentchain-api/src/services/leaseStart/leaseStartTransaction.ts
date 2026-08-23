export type LeaseStartTransactionErrorFactory<TLoaded = unknown> = (
  kind: "idempotency" | "stale",
  loaded?: TLoaded
) => Error;

export type LeaseStartAtomicEvent = {
  ref: any;
  record: Record<string, unknown>;
};

export type LeaseStartTransactionPlan<T> = {
  result: T;
  applyMutations?: () => void;
  assertPostcondition?: () => void;
  events?: LeaseStartAtomicEvent[];
  requestRecord?: Record<string, unknown>;
};

export type LeaseStartTransactionAdapter<TLoaded, TResult> = {
  firestore: any;
  requestRef: any;
  payloadHash: string;
  expectedStateToken?: string;
  error: LeaseStartTransactionErrorFactory<TLoaded>;
  loadAuthoritativeState: (transaction: any) => Promise<TLoaded>;
  getExpectedStateToken: (loaded: TLoaded) => string;
  buildPlan: (input: { transaction: any; loaded: TLoaded }) => Promise<LeaseStartTransactionPlan<TResult>> | LeaseStartTransactionPlan<TResult>;
};

export async function runLeaseStartTransaction<TLoaded, TResult>(
  adapter: LeaseStartTransactionAdapter<TLoaded, TResult>
): Promise<TResult> {
  return adapter.firestore.runTransaction(async (transaction: any) => {
    const replay = await readLeaseStartReplay<TResult>({
      transaction,
      requestRef: adapter.requestRef,
      payloadHash: adapter.payloadHash,
      error: adapter.error,
    });
    if (replay) return replay;

    const loaded = await adapter.loadAuthoritativeState(transaction);
    if (adapter.expectedStateToken !== undefined) {
      assertLeaseStartExpectedState(
        adapter.getExpectedStateToken(loaded),
        adapter.expectedStateToken,
        (kind) => adapter.error(kind, loaded)
      );
    }

    const plan = await adapter.buildPlan({ transaction, loaded });
    plan.applyMutations?.();
    plan.assertPostcondition?.();

    if (plan.requestRecord) {
      persistLeaseStartAtomicResult({
        transaction,
        requestRef: adapter.requestRef,
        requestRecord: plan.requestRecord,
        events: plan.events,
      });
    }
    return plan.result;
  });
}

export async function readLeaseStartReplay<T>(input: {
  transaction: any;
  requestRef: any;
  payloadHash: string;
  error: (kind: "idempotency" | "stale") => Error;
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
