import type { IdentityDocumentStatus } from "./identityDocumentTypes";

const TRANSITIONS: Readonly<Record<IdentityDocumentStatus, readonly IdentityDocumentStatus[]>> = {
  pending_upload: ["processing", "deletion_scheduled"],
  processing: ["ready", "rejected", "deletion_scheduled"],
  ready: ["replaced", "deletion_scheduled"],
  rejected: ["replaced", "deletion_scheduled"],
  replaced: ["deletion_scheduled"],
  deletion_scheduled: ["deleted"],
  deleted: [],
};

export function canTransitionIdentityDocumentStatus(from: IdentityDocumentStatus, to: IdentityDocumentStatus) {
  return TRANSITIONS[from].includes(to);
}
