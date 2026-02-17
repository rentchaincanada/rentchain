import type { NudgeType } from "./nudgeTypes";

const STORAGE_PREFIX = "rc_nudges";
const GLOBAL_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
const PER_TYPE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

type PersistedNudgeState = {
  lastNudgeAt?: number;
  lastShownByType?: Partial<Record<NudgeType, number>>;
  lastDismissedByType?: Partial<Record<NudgeType, number>>;
  dashboardVisits?: number;
};

const sessionShownByUser = new Set<string>();

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`;
}

function nowMs() {
  return Date.now();
}

function readState(userId: string): PersistedNudgeState {
  if (typeof window === "undefined" || !userId) return {};
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PersistedNudgeState;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeState(userId: string, state: PersistedNudgeState) {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    // ignore storage failures
  }
}

export function canShowNudge(userId: string, type: NudgeType): boolean {
  if (!userId || !type) return false;
  if (sessionShownByUser.has(userId)) return false;
  const state = readState(userId);
  const now = nowMs();
  const lastGlobal = Number(state.lastNudgeAt || 0);
  const lastType = Number(state.lastShownByType?.[type] || 0);
  if (lastGlobal && now - lastGlobal < GLOBAL_COOLDOWN_MS) return false;
  if (lastType && now - lastType < PER_TYPE_COOLDOWN_MS) return false;
  return true;
}

export function markNudgeShown(userId: string, type: NudgeType) {
  if (!userId || !type) return;
  const state = readState(userId);
  const now = nowMs();
  state.lastNudgeAt = now;
  state.lastShownByType = state.lastShownByType || {};
  state.lastShownByType[type] = now;
  writeState(userId, state);
  sessionShownByUser.add(userId);
}

export function markNudgeDismissed(userId: string, type: NudgeType) {
  if (!userId || !type) return;
  const state = readState(userId);
  const now = nowMs();
  state.lastDismissedByType = state.lastDismissedByType || {};
  state.lastDismissedByType[type] = now;
  writeState(userId, state);
}

export function markDashboardVisit(userId: string) {
  if (!userId) return;
  const state = readState(userId);
  state.dashboardVisits = Number(state.dashboardVisits || 0) + 1;
  writeState(userId, state);
}

export function getDashboardVisits(userId: string): number {
  if (!userId) return 0;
  const state = readState(userId);
  return Number(state.dashboardVisits || 0);
}

export function hasMeaningfulAction(
  userId: string,
  opts: {
    propertiesCount?: number;
    tenantsCount?: number;
  } = {}
): boolean {
  if (!userId) return false;
  const propertiesCount = Number(opts.propertiesCount || 0);
  const tenantsCount = Number(opts.tenantsCount || 0);
  if (propertiesCount >= 1 || tenantsCount >= 1) return true;
  return getDashboardVisits(userId) >= 2;
}
