export type ResolutionStatus =
  | "open"
  | "acknowledged"
  | "in_progress"
  | "resolved"
  | "dismissed";

export type ResolutionNoteV1 = {
  id: string;
  createdAt: string;
  authorId?: string | null;
  authorRole?: string | null;
  message: string;
};

export type ResolutionHistoryEntryV1 = {
  id: string;
  timestamp: string;
  fromStatus?: ResolutionStatus | null;
  toStatus: ResolutionStatus;
  authorId?: string | null;
  authorRole?: string | null;
  reason?: string | null;
};

export type ResolutionRecordV1 = {
  version: "v1";
  id: string;
  resource: {
    type: string;
    id: string;
  };
  triage: {
    category?: string | null;
    severity?: string | null;
    reasonCode?: string | null;
  };
  status: ResolutionStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  dismissedAt?: string | null;
  notes: ResolutionNoteV1[];
  history: ResolutionHistoryEntryV1[];
  metadata?: Record<string, unknown>;
};
