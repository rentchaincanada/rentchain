import { db } from "../config/firebase";

interface CreateEventInput {
  type: string;
  payload: any;
}

export async function createEvent(input: CreateEventInput) {
  const ref = db.collection("events").doc();

  const data = {
    id: ref.id,
    type: input.type,
    payload: input.payload,
    createdAt: new Date().toISOString(),
  };

  await ref.set(data);

  return data;
}
