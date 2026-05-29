import type { BrowserContextOptions } from "@playwright/test";
import { buildAdminStorageStateFixture, type SmokeRole } from "../fixtures/admin-storage-state";
import { generateStorageState } from "./storage-state-generator";

export interface StorageStatePreset {
  role: SmokeRole;
  storageState: BrowserContextOptions["storageState"];
}

const baseUrl = process.env.VITE_API_BASE_URL || "http://localhost:5173";
const fixture = buildAdminStorageStateFixture();

function createPreset(role: SmokeRole): StorageStatePreset {
  return {
    role,
    storageState: generateStorageState({
      fixture,
      role,
      baseUrl,
    }),
  };
}

export const ADMIN_STORAGE_STATE: StorageStatePreset = createPreset("admin");
export const LANDLORD_STORAGE_STATE: StorageStatePreset = createPreset("landlord");
export const TENANT_STORAGE_STATE: StorageStatePreset = createPreset("tenant");

export function getStorageStateForRole(role: SmokeRole): BrowserContextOptions["storageState"] {
  switch (role) {
    case "admin":
      return ADMIN_STORAGE_STATE.storageState;
    case "landlord":
      return LANDLORD_STORAGE_STATE.storageState;
    case "tenant":
      return TENANT_STORAGE_STATE.storageState;
    default:
      throw new Error(`Unknown role: ${role}`);
  }
}

export function getAllStorageStatePresets(): StorageStatePreset[] {
  return [ADMIN_STORAGE_STATE, LANDLORD_STORAGE_STATE, TENANT_STORAGE_STATE];
}
