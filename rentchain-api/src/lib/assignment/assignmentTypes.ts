export type AssignmentHistoryEntryV1 = {
  id: string;
  timestamp: string;
  action: "set" | "changed" | "cleared";
  fromOwnerId?: string | null;
  fromOwnerLabel?: string | null;
  toOwnerId?: string | null;
  toOwnerLabel?: string | null;
  authorId?: string | null;
  authorRole?: string | null;
  note?: string | null;
};

export type AssignmentRecordV1 = {
  version: "v1";
  id: string;
  resource: {
    type: string;
    id: string;
  };
  currentOwner: {
    ownerId?: string | null;
    ownerLabel?: string | null;
  };
  createdAt: string;
  updatedAt: string;
  history: AssignmentHistoryEntryV1[];
  metadata?: Record<string, unknown>;
};
