import type { ReceivablesSchemaInventoryCommandResult } from "./receivablesSchemaInventoryCommandTypes";

export const RECEIVABLES_SCHEMA_INVENTORY_LOCAL_COMMAND_VERSION =
  "receivables_schema_inventory_local_command_v1" as const;

export const RECEIVABLES_SCHEMA_INVENTORY_LOCAL_COMMAND_MAX_BYTES = 64 * 1024;

export type ReceivablesSchemaInventoryLocalCommandErrorCode =
  | "LOCAL_INVENTORY_INPUT_PATH_REQUIRED"
  | "LOCAL_INVENTORY_INPUT_PATH_INVALID"
  | "LOCAL_INVENTORY_APPROVED_ROOT_INVALID"
  | "LOCAL_INVENTORY_FILE_NOT_FOUND"
  | "LOCAL_INVENTORY_FILE_UNSAFE"
  | "LOCAL_INVENTORY_FILE_TOO_LARGE"
  | "LOCAL_INVENTORY_FILE_UNREADABLE"
  | "LOCAL_INVENTORY_JSON_MALFORMED"
  | "LOCAL_INVENTORY_RECEIPTS_INVALID"
  | "LOCAL_INVENTORY_RECEIPTS_UNSAFE";

export type RunReceivablesSchemaInventoryLocalCommandInput = {
  approvedRoot: string;
  inputFilePath: string;
};

export type ReceivablesSchemaInventoryLocalCommandResult =
  ReceivablesSchemaInventoryCommandResult;

export class ReceivablesSchemaInventoryLocalCommandError extends Error {
  readonly code: ReceivablesSchemaInventoryLocalCommandErrorCode;

  constructor(code: ReceivablesSchemaInventoryLocalCommandErrorCode) {
    super(code);
    this.name = "ReceivablesSchemaInventoryLocalCommandError";
    this.code = code;
  }
}
