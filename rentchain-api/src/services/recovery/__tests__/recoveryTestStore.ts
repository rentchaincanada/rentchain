type StoredRecord = Record<string, unknown>;

type WhereClause = {
  field: string;
  value: unknown;
};

export type TestStore = {
  seed: (collection: string, id: string, data: StoredRecord) => void;
  read: (collection: string, id: string) => StoredRecord | null;
  collection: (name: string) => {
    doc: (id?: string) => {
      get: () => Promise<{ id: string; exists: boolean; data: () => StoredRecord | undefined }>;
      set: (data: StoredRecord) => Promise<void>;
      create: (data: StoredRecord) => Promise<void>;
    };
    where: (field: string, op: string, value: unknown) => ReturnType<TestStore["collection"]>;
    orderBy: (field: string, direction?: "asc" | "desc") => ReturnType<TestStore["collection"]>;
    limit: (count: number) => ReturnType<TestStore["collection"]>;
    get: () => Promise<{ docs: Array<{ id: string; data: () => StoredRecord }> }>;
  };
};

export function createRecoveryTestStore(): TestStore {
  const collections = new Map<string, Map<string, StoredRecord>>();

  function ensure(name: string): Map<string, StoredRecord> {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  function query(name: string, clauses: WhereClause[] = [], limitCount?: number): ReturnType<TestStore["collection"]> {
    return {
      doc(id = `doc-${ensure(name).size + 1}`) {
        return {
          async get() {
            return {
              id,
              exists: ensure(name).has(id),
              data: () => ensure(name).get(id),
            };
          },
          async set(data: StoredRecord) {
            ensure(name).set(id, data);
          },
          async create(data: StoredRecord) {
            if (ensure(name).has(id)) throw new Error("already_exists");
            ensure(name).set(id, data);
          },
        };
      },
      where(field: string, _op: string, value: unknown) {
        return query(name, [...clauses, { field, value }], limitCount);
      },
      orderBy() {
        return query(name, clauses, limitCount);
      },
      limit(count: number) {
        return query(name, clauses, count);
      },
      async get() {
        const docs = Array.from(ensure(name).entries())
          .filter(([, data]) => clauses.every((clause) => data[clause.field] === clause.value))
          .slice(0, limitCount || Number.MAX_SAFE_INTEGER)
          .map(([id, data]) => ({ id, data: () => data }));
        return { docs };
      },
    };
  }

  return {
    seed(collection: string, id: string, data: StoredRecord) {
      ensure(collection).set(id, data);
    },
    read(collection: string, id: string) {
      return ensure(collection).get(id) || null;
    },
    collection(name: string) {
      return query(name);
    },
  };
}
