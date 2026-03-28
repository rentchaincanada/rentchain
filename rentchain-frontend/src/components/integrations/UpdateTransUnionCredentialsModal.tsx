import React from "react";
import type { TransUnionCredentialsPayload, TransUnionIntegration } from "@/api/integrationsApi";
import { ConnectTransUnionModal } from "./ConnectTransUnionModal";

type Props = {
  open: boolean;
  submitting?: boolean;
  integration?: TransUnionIntegration | null;
  onClose: () => void;
  onSubmit: (payload: TransUnionCredentialsPayload) => Promise<void> | void;
};

export function UpdateTransUnionCredentialsModal({
  open,
  submitting,
  integration,
  onClose,
  onSubmit,
}: Props) {
  return (
    <ConnectTransUnionModal
      open={open}
      submitting={submitting}
      integration={integration}
      onClose={onClose}
      onSubmit={onSubmit}
      title="Update TransUnion Credentials"
      submitLabel="Update Credentials"
    />
  );
}
