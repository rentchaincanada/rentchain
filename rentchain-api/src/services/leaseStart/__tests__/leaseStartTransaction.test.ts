import { describe, expect, it, vi } from "vitest";
import { runLeaseStartTransaction } from "../leaseStartTransaction";

type Ref = { collection: string; id: string };

function ref(collection: string, id: string): Ref {
  return { collection, id };
}

function createTransactionalStore() {
  const data = new Map<string, any>();
  let tail = Promise.resolve();
  const key = (target: Ref) => `${target.collection}/${target.id}`;
  const firestore = {
    runTransaction: vi.fn(async (callback: (transaction: any) => Promise<any>) => {
      const execute = async () => {
        const pending: Array<() => void> = [];
        const transaction = {
          get: async (target: Ref) => {
            const value = data.get(key(target));
            return { exists: value !== undefined, data: () => value };
          },
          create: (target: Ref, value: any) => pending.push(() => {
            if (data.has(key(target))) throw new Error("already_exists");
            data.set(key(target), structuredClone(value));
          }),
          set: (target: Ref, value: any) => pending.push(() => data.set(key(target), structuredClone(value))),
        };
        const result = await callback(transaction);
        pending.forEach((apply) => apply());
        return result;
      };
      const result = tail.then(execute, execute);
      tail = result.then(() => undefined, () => undefined);
      return result;
    }),
  };
  return { firestore, data, read: (target: Ref) => data.get(key(target)) };
}

function adapter(store: ReturnType<typeof createTransactionalStore>, overrides: Record<string, any> = {}) {
  const requestRef = ref("leaseStartRequests", "request-1");
  const eventRef = ref("canonicalEvents", "event-1");
  const domainRef = ref("leases", "lease-1");
  const apply = vi.fn((transaction: any) => transaction.set(domainRef, { status: "active" }));
  const load = vi.fn(async () => ({ expectedStateToken: "token-1" }));
  const postcondition = vi.fn();
  return {
    requestRef,
    eventRef,
    domainRef,
    apply,
    load,
    postcondition,
    input: {
      firestore: store.firestore,
      requestRef,
      payloadHash: "fingerprint-1",
      expectedStateToken: "token-1",
      error: (kind: string) => Object.assign(new Error(kind), { code: kind }),
      loadAuthoritativeState: load,
      getExpectedStateToken: (loaded: any) => loaded.expectedStateToken,
      buildPlan: vi.fn(async ({ transaction }: any) => ({
        result: { outcome: "committed", idempotency: { replay: false } },
        applyMutations: () => apply(transaction),
        assertPostcondition: postcondition,
        events: [{ ref: eventRef, record: { type: "lease.started" } }],
        requestRecord: {
          payloadHash: "fingerprint-1",
          result: { outcome: "committed", idempotency: { replay: false } },
        },
      })),
      ...overrides,
    },
  };
}

describe("shared lease-start transaction engine", () => {
  it("executes the domain callback once and persists domain, audit, and result atomically", async () => {
    const store = createTransactionalStore();
    const subject = adapter(store);
    await runLeaseStartTransaction(subject.input);
    expect(store.firestore.runTransaction).toHaveBeenCalledTimes(1);
    expect(subject.input.buildPlan).toHaveBeenCalledTimes(1);
    expect(subject.apply).toHaveBeenCalledTimes(1);
    expect(subject.postcondition).toHaveBeenCalledTimes(1);
    expect(store.read(subject.domainRef)).toEqual({ status: "active" });
    expect(store.read(subject.eventRef)).toEqual({ type: "lease.started" });
    expect(store.read(subject.requestRef)).toMatchObject({ payloadHash: "fingerprint-1" });
  });

  it("returns a stored same-key replay without loading or mutating domain state", async () => {
    const store = createTransactionalStore();
    const first = adapter(store);
    await runLeaseStartTransaction(first.input);
    const replay = adapter(store);
    const result = await runLeaseStartTransaction(replay.input);
    expect(result).toMatchObject({ outcome: "idempotent_replay", idempotency: { replay: true } });
    expect(replay.load).not.toHaveBeenCalled();
    expect(replay.apply).not.toHaveBeenCalled();
  });

  it("rejects a changed fingerprint before load or mutation", async () => {
    const store = createTransactionalStore();
    const first = adapter(store);
    await runLeaseStartTransaction(first.input);
    const changed = adapter(store, { payloadHash: "fingerprint-2" });
    await expect(runLeaseStartTransaction(changed.input)).rejects.toMatchObject({ code: "idempotency" });
    expect(changed.load).not.toHaveBeenCalled();
    expect(changed.apply).not.toHaveBeenCalled();
  });

  it("rejects stale expected state before mutation", async () => {
    const store = createTransactionalStore();
    const subject = adapter(store, { expectedStateToken: "stale-token" });
    await expect(runLeaseStartTransaction(subject.input)).rejects.toMatchObject({ code: "stale" });
    expect(subject.apply).not.toHaveBeenCalled();
    expect(store.read(subject.requestRef)).toBeUndefined();
  });

  it("rolls back queued domain writes when the postcondition fails", async () => {
    const store = createTransactionalStore();
    const subject = adapter(store);
    subject.postcondition.mockImplementation(() => { throw new Error("postcondition_failed"); });
    await expect(runLeaseStartTransaction(subject.input)).rejects.toThrow("postcondition_failed");
    expect(store.read(subject.domainRef)).toBeUndefined();
    expect(store.read(subject.eventRef)).toBeUndefined();
    expect(store.read(subject.requestRef)).toBeUndefined();
  });

  it("does not persist success state when the domain callback fails", async () => {
    const store = createTransactionalStore();
    const subject = adapter(store);
    subject.input.buildPlan.mockRejectedValueOnce(new Error("domain_failed"));
    await expect(runLeaseStartTransaction(subject.input)).rejects.toThrow("domain_failed");
    expect(store.read(subject.eventRef)).toBeUndefined();
    expect(store.read(subject.requestRef)).toBeUndefined();
  });

  it("serializes concurrent same-key attempts into one logical mutation and one replay", async () => {
    const store = createTransactionalStore();
    const first = adapter(store);
    const second = adapter(store);
    const results = await Promise.all([
      runLeaseStartTransaction(first.input),
      runLeaseStartTransaction(second.input),
    ]);
    expect(results.map((result: any) => result.outcome).sort()).toEqual(["committed", "idempotent_replay"]);
    expect(first.apply.mock.calls.length + second.apply.mock.calls.length).toBe(1);
    expect(store.read(first.eventRef)).toEqual({ type: "lease.started" });
  });

  it("keeps one logical result when Firestore retries a conflicted callback", async () => {
    const store = createTransactionalStore();
    const subject = adapter(store);
    const nativeRunner = store.firestore.runTransaction;
    subject.input.firestore = {
      runTransaction: async (callback: any) => {
        await callback({
          get: async () => ({ exists: false, data: () => undefined }),
          create: () => undefined,
          set: () => undefined,
        });
        return nativeRunner(callback);
      },
    };
    const result = await runLeaseStartTransaction(subject.input);
    expect(result).toMatchObject({ outcome: "committed" });
    expect(subject.input.buildPlan).toHaveBeenCalledTimes(2);
    expect(store.read(subject.eventRef)).toEqual({ type: "lease.started" });
    expect(store.read(subject.requestRef)).toMatchObject({ payloadHash: "fingerprint-1" });
  });
});
