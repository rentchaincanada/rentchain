// src/events/firestore.ts
//
// Single place to expose a Firestore client for the whole API.
//
// It relies on src/config/firebase.ts to initialize firebase-admin.
// That file is already running (you see the logs:
// "🔥 [FIREBASE CONFIG LOADED] Path: /Users/paul/rentchain-api/src/config/firebase.ts")

import admin from "firebase-admin";
import "../config/firebase"; // ensures admin.initializeApp(...) has run

// Named export
export const firestore = admin.firestore();

// Optional default export (in case any older code imported default)
export default firestore;
