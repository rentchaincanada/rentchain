import admin from "firebase-admin";
import { assertSafeFirestoreEnvironment } from "../config/firestoreEnvironmentGuard";
import { recordInitializationState } from "./initializationRegistry";

export const PROJECT_ID = "project-0d9658de-af29-4dc0-a99";

const guard = assertSafeFirestoreEnvironment();

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

export const firestore = firestoreInstance;
export const db = firestoreInstance;
export const FieldValue = admin.firestore.FieldValue;

console.log("[FIREBASE CONFIG LOADED]");
console.log("[FIREBASE CONFIG] PROJECT_ID =", PROJECT_ID);
