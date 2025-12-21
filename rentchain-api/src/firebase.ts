import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

// IMPORTANT: make sure we only init once
if (!admin.apps.length) {
  admin.initializeApp({
    // Use env vars if set, otherwise fall back to your actual project ID.
    // 🔴 REPLACE "YOUR_GCP_PROJECT_ID" with your real GCP project id.
    projectId:
      process.env.GCLOUD_PROJECT ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      "project-0d9658de-af29-4dc0-a99",
  });
}

export const db = getFirestore();
