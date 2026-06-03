// Canonical backend Firebase import path.
// Use these exports for Firestore access and server timestamp helpers.
export { db, firestore, FieldValue, PROJECT_ID } from "./admin";
export { initializationState, captureInitializationAudit } from "./initializationRegistry";
export type { FirebaseInitializationMode, FirebaseInitializationState } from "./initializationRegistry";
