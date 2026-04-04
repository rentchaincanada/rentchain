import Papa from "papaparse";
import type { RegistrySourceAdapter, RegistryAdapterContext, ParsedRegistryRow } from "./RegistrySourceAdapter";
import type { RegistryPropertyCandidate, RegistryRecordNormalized, RegistryRecordRaw, RegistrySourceRecord } from "../registryTypes";
import {
  hashPayload,
  makeStableId,
  normalizeAddress,
  normalizeAddressFromParts,
  normalizePid,
  parseDateString,
  toNullableNumber,
  trimString,
} from "../registryUtils";

const HALIFAX_SOURCE: RegistrySourceRecord = {
  id: "halifax_r400",
  sourceKey: "halifax_r400",
  jurisdictionCountry: "CA",
  jurisdictionProvince: "NS",
  jurisdictionMunicipality: "Halifax",
  sourceType: "rental_registry",
  sourceLabel: "Halifax Residential Rental Registry",
  sourceUrl: "https://catalogue-hrm.opendata.arcgis.com/datasets/residential-rental-registry",
  active: true,
  ingestionMode: "csv_upload",
  schemaVersion: 1,
  refreshFrequency: "manual",
  latestImportId: null,
  createdAt: "",
  updatedAt: "",
};

function readField(row: ParsedRegistryRow, keys: string[]) {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim()) return row[key];
  }
  return null;
}

function normalizeRentalUnitType(value: string | null) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes("apartment")) return "apartment";
  if (raw.includes("secondary")) return "secondary_suite";
  if (raw.includes("rooming")) return "rooming_house";
  return raw.replace(/\s+/g, "_");
}

function normalizeBuildingType(value: string | null) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes("house")) return "house";
  if (raw.includes("apartment")) return "apartment_building";
  if (raw.includes("duplex")) return "duplex";
  if (raw.includes("town")) return "townhouse";
  return raw.replace(/\s+/g, "_");
}

function mapRegisteredStatus(value: string | null): RegistryRecordNormalized["registrationStatusNormalized"] {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "y" || raw === "yes" || raw === "true" || raw === "registered") return "registered";
  if (raw === "n" || raw === "no" || raw === "false") return "pending_review";
  return "unknown";
}

function splitAddressTokens(address: string | null): string[] {
  return String(address || "")
    .split(",")
    .map((part) => String(part || "").trim())
    .filter(Boolean);
}

function looksLikePostalCode(value: string) {
  return /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/.test(String(value || "").trim());
}

function looksLikeStreetStart(value: string) {
  return /^\d+[A-Za-z]?\s+/.test(String(value || "").trim());
}

function buildAddressCandidates(address: string | null, province: string) {
  const tokens = splitAddressTokens(address);
  const postalCode = tokens.find((token) => looksLikePostalCode(token)) || null;
  const city = tokens.find((token) => !looksLikePostalCode(token) && !looksLikeStreetStart(token) && token.length >= 3) || null;
  const streetTokens = tokens.filter((token) => looksLikeStreetStart(token));

  if (!streetTokens.length) {
    const normalized = normalizeAddress(address);
    return {
      primary: normalized,
      candidates: normalized ? [normalized] : [],
      postalCode: postalCode ? postalCode.replace(/\s+/g, "").toUpperCase() : null,
    };
  }

  const candidates = Array.from(
    new Set(
      streetTokens
        .map((street) => normalizeAddressFromParts([street, city, province, postalCode]))
        .filter(Boolean)
    )
  ) as string[];

  return {
    primary: candidates[0] || normalizeAddress(address),
    candidates: candidates.length ? candidates : compactSingleCandidate(address),
    postalCode: postalCode ? postalCode.replace(/\s+/g, "").toUpperCase() : null,
  };
}

function compactSingleCandidate(address: string | null) {
  const normalized = normalizeAddress(address);
  return normalized ? [normalized] : [];
}

export class HalifaxR400Adapter implements RegistrySourceAdapter {
  readonly sourceKey = "halifax_r400" as const;

  getSourceDefinition(): RegistrySourceRecord {
    return { ...HALIFAX_SOURCE };
  }

  parse(csvText: string): ParsedRegistryRow[] {
    const parsed = Papa.parse<Record<string, unknown>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader(header) {
        return String(header || "").replace(/^\uFEFF/, "").trim();
      },
    });
    return Array.isArray(parsed.data) ? parsed.data : [];
  }

  mapRawRow(row: ParsedRegistryRow, rowIndex: number, context: RegistryAdapterContext): RegistryRecordRaw {
    const objectId = trimString(readField(row, ["OBJECTID", "objectid"]));
    const registrationNumber = trimString(readField(row, ["Registration Number", "registration_number"]));
    const pid = normalizePid(readField(row, ["PID", "pid"]));
    const address = trimString(readField(row, ["Address", "address"]));
    const rentalUnitType = trimString(readField(row, ["Rental Unit Type", "rental_unit_type"]));
    const buildingType = trimString(readField(row, ["Building Type", "building_type"]));
    const sharedFacilities = trimString(readField(row, ["Shared Facilities", "shared_facilities"]));
    const registered = trimString(readField(row, ["Registered", "registered"]));
    const dateRegistrationIssued = trimString(
      readField(row, ["Date Registration Issued", "date_registration_issued"])
    );
    const globalId = trimString(readField(row, ["GlobalID", "globalid"]));
    const rawId = makeStableId([
      context.importRecord.importBatchId,
      registrationNumber,
      objectId,
      globalId,
      rowIndex + 1,
    ]);

    return {
      id: rawId,
      importBatchId: context.importRecord.importBatchId,
      sourceKey: this.sourceKey,
      sourceRowHash: hashPayload(row),
      sourcePayload: row,
      objectId,
      registrationNumber,
      pid,
      address,
      rentalUnitType,
      buildingType,
      registeredUnits: toNullableNumber(readField(row, ["Registered Units", "registered_units"])),
      numberOfFloors: toNullableNumber(readField(row, ["Number of Floors", "number_of_floors"])),
      sharedFacilities,
      registered,
      dateRegistrationIssued,
      globalId,
      x: toNullableNumber(readField(row, ["x", "X"])),
      y: toNullableNumber(readField(row, ["y", "Y"])),
      importedAt: context.importedAt,
    };
  }

  normalizeRawRow(rawRow: RegistryRecordRaw, context: RegistryAdapterContext): RegistryRecordNormalized {
    const registryRecordId =
      rawRow.registrationNumber || rawRow.globalId || rawRow.objectId || rawRow.sourceRowHash.slice(0, 16);
    const addressCandidates = buildAddressCandidates(rawRow.address, context.source.jurisdictionProvince);
    return {
      id: makeStableId([this.sourceKey, registryRecordId]),
      importBatchId: context.importRecord.importBatchId,
      sourceKey: this.sourceKey,
      jurisdictionCountry: "CA",
      jurisdictionProvince: context.source.jurisdictionProvince,
      jurisdictionMunicipality: context.source.jurisdictionMunicipality,
      registryCategory: "rental_registry",
      registryRecordId,
      registrationNumber: rawRow.registrationNumber,
      pid: rawRow.pid,
      addressRaw: rawRow.address,
      primaryAddressCandidate: addressCandidates.primary,
      addressCandidates: addressCandidates.candidates,
      addressNormalized: addressCandidates.primary,
      postalCode: addressCandidates.postalCode,
      rentalUnitTypeRaw: rawRow.rentalUnitType,
      rentalUnitTypeNormalized: normalizeRentalUnitType(rawRow.rentalUnitType),
      buildingTypeRaw: rawRow.buildingType,
      buildingTypeNormalized: normalizeBuildingType(rawRow.buildingType),
      registeredUnits: rawRow.registeredUnits,
      numberOfFloors: rawRow.numberOfFloors,
      sharedFacilities: rawRow.sharedFacilities,
      registrationStatusRaw: rawRow.registered,
      registrationStatusNormalized: mapRegisteredStatus(rawRow.registered),
      registrationIssuedAt: parseDateString(rawRow.dateRegistrationIssued),
      lat: rawRow.y,
      lng: rawRow.x,
      sourceConfidence: rawRow.registrationNumber || rawRow.pid ? 0.94 : 0.8,
      internalDiagnostics: {
        unmatchedReasons: [],
        pidSourceFieldsChecked: ["pid", "propertyPid", "parcelId", "parcelPid", "PID", "metadata.pid", "metadata.propertyPid"],
        addressCandidateCount: addressCandidates.candidates.length,
      },
      importedAt: context.importedAt,
      updatedAt: context.importedAt,
    };
  }

  buildPropertyAddressCandidate(property: Record<string, unknown>): RegistryPropertyCandidate {
    const propertyId = trimString(property.id) || trimString(property.propertyId) || "";
    const pidSourceFields = [
      "pid",
      "PID",
      "propertyPid",
      "parcelId",
      "parcelPid",
      "metadata.pid",
      "metadata.propertyPid",
      "metadata.parcelId",
    ];
    const metadata = (property.metadata && typeof property.metadata === "object" ? property.metadata : {}) as Record<string, unknown>;
    const resolvedPid =
      normalizePid(property.pid) ||
      normalizePid((property as any).PID) ||
      normalizePid(property.propertyPid) ||
      normalizePid(property.parcelId) ||
      normalizePid(property.parcelPid) ||
      normalizePid(metadata.pid) ||
      normalizePid(metadata.propertyPid) ||
      normalizePid(metadata.parcelId);
    const primaryAddress = normalizeAddressFromParts([
      property.addressLine1 || property.address1 || property.address,
      property.city,
      property.province,
      property.postalCode,
    ]);
    return {
      propertyId,
      landlordId: trimString(property.landlordId),
      propertyName: trimString(property.name) || trimString(property.nickname),
      addressLine1: trimString(property.addressLine1) || trimString(property.address1) || trimString(property.address),
      city: trimString(property.city),
      province: trimString(property.province),
      postalCode: trimString(property.postalCode),
      pid: resolvedPid,
      unitCount:
        typeof property.unitCount === "number"
          ? property.unitCount
          : typeof property.totalUnits === "number"
            ? property.totalUnits
            : null,
      buildingType: trimString(property.buildingType),
      pidSourceFields,
      addressCandidates: primaryAddress ? [primaryAddress] : [],
      addressNormalized: primaryAddress,
    };
  }
}
