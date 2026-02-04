export type ApplicationPrereqState = {
  missingProperty: boolean;
  missingUnit: boolean;
  missingSelectedProperty: boolean;
};

type PrereqArgs = {
  propertiesCount: number;
  unitsCount: number;
  selectedPropertyId?: string | null;
  requireSelection?: boolean;
};

export function getApplicationPrereqState({
  propertiesCount,
  unitsCount,
  selectedPropertyId,
  requireSelection = false,
}: PrereqArgs): ApplicationPrereqState {
  const missingProperty = propertiesCount <= 0;
  const missingUnit = !missingProperty && unitsCount <= 0;
  const missingSelectedProperty =
    !missingProperty && requireSelection && !selectedPropertyId;

  return { missingProperty, missingUnit, missingSelectedProperty };
}
