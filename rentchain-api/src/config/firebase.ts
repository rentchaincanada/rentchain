// src/config/firebase.ts

import admin from "firebase-admin";

// IMPORTANT: type this by hand, do NOT paste from browser/link
const PROJECT_ID = "project-0d9658de-af29-4dc0-a99";

// Initialize the Firebase Admin SDK once
if (!admin.apps.length) {
  admin.initializeApp({
    // Use Application Default Credentials (ADC).
    // GOOGLE_APPLICATION_CREDENTIALS should point to your service account JSON.
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT_ID,
  });
}

const firestoreInstance = admin.firestore();
firestoreInstance.settings({ ignoreUndefinedProperties: true });

export const firestore = firestoreInstance;
export const db = firestoreInstance;
export const FieldValue = admin.firestore.FieldValue;

console.log("🔥 [FIREBASE CONFIG LOADED] Path:", __filename);
console.log("🔥 [ENV] GOOGLE_APPLICATION_CREDENTIALS =", process.env.GOOGLE_APPLICATION_CREDENTIALS);
console.log("🔥 [FIREBASE CONFIG] PROJECT_ID =", PROJECT_ID);
