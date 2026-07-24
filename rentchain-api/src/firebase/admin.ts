import admin from "firebase-admin";
import { assertSafeFirestoreEnvironment } from "../config/firestoreEnvironmentGuard";
import { recordInitializationState } from "./initializationRegistry";
import { assertRuntimeEnvironment, getConfiguredProjectId, PREVIEW_PROJECT, PRODUCTION_PROJECT } from "../config/runtimeEnvironment";

const runtime = assertRuntimeEnvironment();
export const PROJECT_ID = getConfiguredProjectId() || (runtime === "production" ? PRODUCTION_PROJECT : "");

const guard = assertSafeFirestoreEnvironment();

let firestore: admin.firestore.Firestore;
let db: admin.firestore.Firestore;
const FieldValue = admin.firestore.FieldValue;

if (runtime === "preview" && guard.mode === "preview-disabled") {
  recordInitializationState({ guard, projectId: PREVIEW_PROJECT, caller: "rentchain-api/src/firebase/admin.ts" });
  const unavailable = new Proxy({} as admin.firestore.Firestore, {
    get() {
      throw new Error("[firebase] Firestore is disabled in Preview until separately provisioned.");
    },
  });
  firestore = unavailable;
  db = unavailable;
} else {

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT_ID,
  });
}

const firestoreInstance = admin.firestore();
firestoreInstance.settings({ ignoreUndefinedProperties: true });

recordInitializationState({
  guard,
  projectId: PROJECT_ID,
  caller: "rentchain-api/src/firebase/admin.ts",
});

firestore = firestoreInstance;
db = firestoreInstance;

}

export { firestore, db, FieldValue };

console.log("[FIREBASE CONFIG LOADED]");
console.log("[FIREBASE CONFIG] PROJECT_ID =", PROJECT_ID);
