import type { FirestoreEnvironmentGuardResult } from "../config/firestoreEnvironmentGuard";

export type FirebaseInitializationMode = FirestoreEnvironmentGuardResult["mode"];

export type FirebaseInitializationState = {
  environment: string;
  mode: FirebaseInitializationMode;
  emulatorHost: string | null;
  projectId: string;
  timestamp: string;
  caller: string;
};

let currentState: FirebaseInitializationState | null = null;

export function recordInitializationState(input: {
  guard: FirestoreEnvironmentGuardResult;
  projectId: string;
  caller: string;
  timestamp?: string;
}): FirebaseInitializationState {
  currentState = {
    environment: input.guard.environment,
    mode: input.guard.mode,
    emulatorHost: input.guard.emulatorHost,
    projectId: input.projectId,
    timestamp: input.timestamp || new Date().toISOString(),
    caller: input.caller,
  };
  return currentState;
}

export function initializationState(): FirebaseInitializationState {
  if (currentState) return { ...currentState };
  return {
    environment: String(process.env.NODE_ENV || "development").toLowerCase(),
    mode: "emulator",
    emulatorHost: String(process.env.FIRESTORE_EMULATOR_HOST || "").trim() || null,
    projectId: "",
    timestamp: new Date(0).toISOString(),
    caller: "firebase_initialization_not_recorded",
  };
}

export function captureInitializationAudit(): FirebaseInitializationState {
  return initializationState();
}
