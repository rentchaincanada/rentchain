import { db } from "../../../config/firebase";
import type { TransUnionIntegrationDoc } from "./transunionTypes";

function docRef(landlordId: string) {
  return db.collection(`landlords/${landlordId}/integrations`).doc("transunion");
}

export async function getTransUnionIntegrationDoc(
  landlordId: string
): Promise<TransUnionIntegrationDoc | null> {
  const snap = await docRef(landlordId).get();
  if (!snap.exists) return null;
  return snap.data() as TransUnionIntegrationDoc;
}

export async function setTransUnionIntegrationDoc(
  landlordId: string,
  doc: Partial<TransUnionIntegrationDoc>
): Promise<void> {
  await docRef(landlordId).set(doc, { merge: true });
}
