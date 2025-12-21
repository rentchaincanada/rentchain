import { db } from "../config/firebase";

export type ActivityEvent = {
  id: string;
  scope: "property";
  propertyId: string;
  type: string;
  title: string;
  body?: string;
  createdAt: Date;
  meta?: Record<string, any>;
};

function activityEventId(args: {
  propertyId: string;
  type: string;
  ruleKey: string;
  stamp: string;
}) {
  const raw = `${args.propertyId}__${args.type}__${args.ruleKey}__${args.stamp}`;
  return raw.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function dayStamp(d: Date) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

export async function emitPropertyActivityEvent(args: {
  propertyId: string;
  type: string;
  ruleKey: string;
  title: string;
  body?: string;
  meta?: Record<string, any>;
}) {
  const now = new Date();
  const stamp = dayStamp(now);

  const id = activityEventId({
    propertyId: args.propertyId,
    type: args.type,
    ruleKey: args.ruleKey,
    stamp,
  });

  const ref = db.collection("activityEvents").doc(id);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) return;

    tx.set(ref, {
      id,
      scope: "property",
      propertyId: args.propertyId,
      type: args.type,
      title: args.title,
      body: args.body ?? "",
      createdAt: now,
      meta: args.meta ?? {},
    } as ActivityEvent);
  });

  return { id };
}
