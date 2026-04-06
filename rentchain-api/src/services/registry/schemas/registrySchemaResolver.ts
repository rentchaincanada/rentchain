import { genericCanadaRegistryReadySchema } from "./genericCanadaRegistryReadySchema";
import { halifaxRentalRegistrySchema } from "./halifaxRentalRegistrySchema";
import type { RegistrySchemaDefinition } from "./registrySchemaTypes";

function normalizeToken(value: any): string {
  return String(value || "").trim().toLowerCase();
}

function matchesHalifaxJurisdiction(property: Record<string, any>): boolean {
  const country = normalizeToken(property?.country);
  const province = normalizeToken(property?.province);
  const city = normalizeToken(property?.city);
  const municipality = normalizeToken(property?.municipality || property?.jurisdictionMunicipality);

  const inCanada = !country || country === "canada" || country === "ca";
  const inNovaScotia = province === "ns" || province === "nova scotia";
  const inHalifax =
    city === "halifax" ||
    municipality === "halifax" ||
    municipality === "halifax regional municipality";

  return inCanada && inNovaScotia && inHalifax;
}

export function resolveRegistrySchemaForProperty(property: Record<string, any>): RegistrySchemaDefinition {
  if (matchesHalifaxJurisdiction(property)) {
    return halifaxRentalRegistrySchema;
  }
  return {
    ...genericCanadaRegistryReadySchema,
    jurisdiction: {
      country:
        normalizeToken(property?.country) === "ca" || normalizeToken(property?.country) === "canada"
          ? "CA"
          : String(property?.country || "CA").toUpperCase(),
      province: property?.province ? String(property.province) : null,
      municipality: property?.city ? String(property.city) : null,
    },
  };
}

export function listSupportedRegistrySchemas(): RegistrySchemaDefinition[] {
  return [halifaxRentalRegistrySchema, genericCanadaRegistryReadySchema];
}

export function resolveRegistrySchemaSummaryByKey(schemaKey: string): RegistrySchemaDefinition | null {
  return listSupportedRegistrySchemas().find((schema) => schema.schemaKey === schemaKey) || null;
}
