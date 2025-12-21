import React from "react";

export type PropertyOption = {
  id: string;
  name: string;
  address?: string;
};

type PropertySelectorProps = {
  properties?: PropertyOption[];
  selectedPropertyId?: string;
  onChangeSelectedProperty?: (id: string) => void;
};

// Temporary mock data so the selector always has something to show
const mockProperties: PropertyOption[] = [
  { id: "P001", name: "Main St. Apartments", address: "101 Main St" },
  { id: "P002", name: "Downtown Lofts", address: "22 King St" },
  { id: "P003", name: "Riverside Townhomes", address: "7 River Rd" },
];

export function PropertySelector({
  properties,
  selectedPropertyId,
  onChangeSelectedProperty,
}: PropertySelectorProps) {
  // Use provided properties if passed, otherwise fall back to mock list
  const options =
    properties && properties.length > 0 ? properties : mockProperties;

  if (!options || options.length === 0) {
    // Nothing to select – render a tiny safe placeholder instead of crashing
    return (
      <div className="property-selector">
        <span>No properties available</span>
      </div>
    );
  }

  const currentId = selectedPropertyId ?? options[0].id;

  const handleChange: React.ChangeEventHandler<HTMLSelectElement> = (event) => {
    const newId = event.target.value;
    if (onChangeSelectedProperty) {
      onChangeSelectedProperty(newId);
    }
  };

    return (
    <div className="property-selector">
      <label className="property-selector-label" htmlFor="property-select">
        Property:
      </label>
      <select
        id="property-select"
        name="property"
        className="property-selector-select"
        value={currentId}
        onChange={handleChange}
      >
        {options.map((property) => (
          <option key={property.id} value={property.id}>
            {property.name}
            {property.address ? ` – ${property.address}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
