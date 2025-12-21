import Ajv from "ajv";
import schema from "../schemas/unitImportRow.schema.json";

const ajv = new Ajv({ allErrors: true, coerceTypes: true, removeAdditional: "all" });
const validate = ajv.compile(schema as any);

export function validateUnitImportRow(row: any) {
  const ok = validate(row);
  return {
    ok: !!ok,
    errors:
      validate.errors?.map((e) => `${e.instancePath || "row"} ${e.message}`) ??
      [],
    value: row,
  };
}
