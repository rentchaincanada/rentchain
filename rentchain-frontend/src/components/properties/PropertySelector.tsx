import React, { useMemo, useState } from "react";

type PropertySelectorItem = {
  id: string;
  addressLine1?: string;
  address?: string;
  city?: string;
  name?: string;
  nickname?: string;
  unitsCount?: number;
  unitCount?: number;
};

interface PropertySelectorProps {
  properties: PropertySelectorItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const getPrimaryLabel = (property: PropertySelectorItem) =>
  property.addressLine1 ||
  property.address ||
  property.nickname ||
  property.name ||
  "Property";

const getUnitsCount = (property: PropertySelectorItem) =>
  Number(property.unitsCount ?? property.unitCount ?? 0) || 0;

export const PropertySelector: React.FC<PropertySelectorProps> = ({
  properties,
  selectedId,
  onSelect,
}) => {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!normalizedQuery) return properties;
    return properties.filter((property) => {
      const haystack = [
        property.addressLine1,
        property.address,
        property.city,
        property.name,
        property.nickname,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, properties]);

  const selectedProperty = useMemo(
    () => properties.find((property) => String(property.id) === String(selectedId)) ?? null,
    [properties, selectedId]
  );

  const options = useMemo(() => {
    if (!selectedProperty) return filtered;
    const hasSelected = filtered.some(
      (property) => String(property.id) === String(selectedProperty.id)
    );
    return hasSelected ? filtered : [selectedProperty, ...filtered];
  }, [filtered, selectedProperty]);

  return (
    <div className="rc-property-selector" aria-label="Property selector">
      <div className="rc-property-selector-header">
        <div className="rc-property-selector-title">Property</div>
        <div className="rc-property-selector-count">{properties.length} total</div>
      </div>
      <div className="rc-property-selector-row">
        <label className="rc-property-selector-label" htmlFor="property-search">
          Search
        </label>
        <input
          id="property-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search properties…"
          className="rc-property-selector-input"
          aria-label="Search properties"
        />
        <label className="rc-property-selector-label" htmlFor="property-select">
          Select
        </label>
        <select
          id="property-select"
          className="rc-property-selector-select"
          value={selectedId ?? ""}
          onChange={(event) => {
            if (event.target.value) {
              onSelect(event.target.value);
            }
          }}
          aria-label="Select property"
          disabled={properties.length === 0}
        >
          {properties.length === 0 ? (
            <option value="">No properties</option>
          ) : null}
          {properties.length > 0 && options.length === 0 ? (
            <option value="">No matches</option>
          ) : null}
          {options.map((property) => {
            const unitsCount = getUnitsCount(property);
            const city = property.city?.trim();
            const secondaryParts = [
              city,
              unitsCount > 0 ? `${unitsCount} ${unitsCount === 1 ? "unit" : "units"}` : null,
            ].filter(Boolean);
            const secondary = secondaryParts.length > 0 ? secondaryParts.join(" • ") : "";
            const label = secondary
              ? `${getPrimaryLabel(property)} — ${secondary}`
              : getPrimaryLabel(property);
            return (
              <option key={property.id} value={property.id}>
                {label}
              </option>
            );
          })}
        </select>
      </div>
    </div>
  );
};
