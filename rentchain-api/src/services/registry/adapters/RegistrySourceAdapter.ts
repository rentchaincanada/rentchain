import type {
  RegistryImportRecord,
  RegistryPropertyCandidate,
  RegistryRecordNormalized,
  RegistryRecordRaw,
  RegistrySourceKey,
  RegistrySourceRecord,
} from "../registryTypes";

export type ParsedRegistryRow = Record<string, unknown>;

export type RegistryAdapterContext = {
  importRecord: RegistryImportRecord;
  source: RegistrySourceRecord;
  importedAt: string;
};

export interface RegistrySourceAdapter {
  readonly sourceKey: RegistrySourceKey;
  getSourceDefinition(): RegistrySourceRecord;
  parse(csvText: string): ParsedRegistryRow[];
  mapRawRow(row: ParsedRegistryRow, rowIndex: number, context: RegistryAdapterContext): RegistryRecordRaw;
  normalizeRawRow(rawRow: RegistryRecordRaw, context: RegistryAdapterContext): RegistryRecordNormalized;
  buildPropertyAddressCandidate(property: Record<string, unknown>): RegistryPropertyCandidate;
}
