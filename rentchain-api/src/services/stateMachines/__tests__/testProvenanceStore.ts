import type { FirestoreLike } from "../provenanceStorage";
import type { TransitionProvenanceEvent } from "../types";

type Stored = TransitionProvenanceEvent;

type Filter = {
  field: string;
  value: unknown;
};

type Store = Map<string, Stored>;

function valueAt(record: Record<string, unknown>, field: string): unknown {
  return field.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, record);
}

function collectionFor(store: Store, filters: Filter[] = []) {
  const nextFilters = filters;
  return {
    doc: (id?: string) => {
      const docId = id || `doc-${store.size + 1}`;
      return {
        async get() {
          const data = store.get(docId);
          return { exists: Boolean(data), id: docId, data: () => data };
        },
        async create(data: Stored) {
          if (store.has(docId)) throw new Error("already_exists");
          store.set(docId, data);
        },
        async set(data: Stored) {
          store.set(docId, data);
        },
      };
    },
    where: (field: string, _op: string, value: unknown) => collectionFor(store, [...nextFilters, { field, value }]),
    orderBy: () => collectionFor(store, nextFilters),
    limit: () => collectionFor(store, nextFilters),
    async get() {
      const docs = [...store.entries()]
        .filter(([, event]) =>
          nextFilters.every((filter) => valueAt(event as unknown as Record<string, unknown>, filter.field) === filter.value)
        )
        .map(([id, event]) => ({ exists: true, id, data: () => event }));
      return { docs };
    },
  };
}

export function createProvenanceFirestore(events: TransitionProvenanceEvent[] = []): FirestoreLike {
  const store: Store = new Map(events.map((event) => [event.eventId, event]));
  return {
    collection: () => collectionFor(store),
  };
}
