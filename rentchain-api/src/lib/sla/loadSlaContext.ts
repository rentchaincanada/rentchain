import type { AssignmentRecordV1 } from "../assignment/assignmentTypes";
import type { ResolutionRecordV1 } from "../resolution/resolutionTypes";
import type { AdminTriageItemV1 } from "../triage/triageTypes";

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

export type SlaContextRecord = {
  triageItem: AdminTriageItemV1;
  resolution: ResolutionRecordV1 | null;
  assignment: AssignmentRecordV1 | null;
};

export function loadSlaContext(input: {
  triageItems?: AdminTriageItemV1[];
  resolutions?: ResolutionRecordV1[];
  assignments?: AssignmentRecordV1[];
  resourceType?: string | null;
  resourceId?: string | null;
}): SlaContextRecord[] {
  const triageItems = input.triageItems || [];
  const resolutions = input.resolutions || [];
  const assignments = input.assignments || [];
  const resourceType = asString(input.resourceType, 120);
  const resourceId = asString(input.resourceId, 240);

  return triageItems
    .filter((item) => (resourceType ? item.resource.type === resourceType : true))
    .filter((item) => (resourceId ? item.resource.id === resourceId : true))
    .map((triageItem) => {
      const resolution =
        resolutions.find(
          (record) =>
            asString(record.resource?.type, 120) === triageItem.resource.type &&
            asString(record.resource?.id, 240) === triageItem.resource.id
        ) || null;
      const assignment =
        assignments.find(
          (record) =>
            asString(record.resource?.type, 120) === triageItem.resource.type &&
            asString(record.resource?.id, 240) === triageItem.resource.id
        ) || null;
      return {
        triageItem,
        resolution,
        assignment,
      };
    });
}
