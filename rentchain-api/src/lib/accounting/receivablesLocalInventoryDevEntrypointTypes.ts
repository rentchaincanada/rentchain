import type {
  ReceivablesSchemaInventoryLocalCommandResult,
  RunReceivablesSchemaInventoryLocalCommandInput,
} from "./receivablesSchemaInventoryLocalCommandTypes";

export const RECEIVABLES_LOCAL_INVENTORY_DEV_ENTRYPOINT_VERSION =
  "receivables_local_inventory_dev_entrypoint_v1" as const;

export type ReceivablesLocalInventoryDevEntrypointStatus =
  | "ready_for_next_audit"
  | "not_ready"
  | "invalid_invocation"
  | "invalid_input"
  | "internal_failure";

export type ReceivablesLocalInventoryDevEntrypointResult = {
  status: ReceivablesLocalInventoryDevEntrypointStatus;
  exitCode: 0 | 2 | 64 | 65 | 70;
};

export type ReceivablesLocalInventoryDevEntrypointDependencies = {
  approvedRoot: string;
  runLocalCommand: (
    input: RunReceivablesSchemaInventoryLocalCommandInput
  ) => ReceivablesSchemaInventoryLocalCommandResult;
  writeOutput: (value: string) => void;
  writeError: (value: string) => void;
};

export type RunReceivablesLocalInventoryDevEntrypointInput = {
  args: readonly string[];
  dependencies: ReceivablesLocalInventoryDevEntrypointDependencies;
};
