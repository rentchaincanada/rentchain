import React from "react";
import { Button, Input, Section } from "../ui/Ui";

type Props = {
  values: {
    q: string;
    province: string;
    integrity: string;
    sortBy: string;
    sortDir: string;
    pageSize: string;
  };
  onChange: (patch: Partial<Props["values"]>) => void;
  onReset: () => void;
};

export const AdminFilterBar: React.FC<Props> = ({ values, onChange, onReset }) => {
  return (
    <Section>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <Input
          aria-label="Search properties"
          placeholder="Search property, address, city, or id"
          value={values.q}
          onChange={(event) => onChange({ q: event.target.value })}
        />
        <Input
          aria-label="Filter by province"
          placeholder="Province"
          value={values.province}
          onChange={(event) => onChange({ province: event.target.value.toUpperCase() })}
        />
        <select
          aria-label="Filter by integrity"
          value={values.integrity}
          onChange={(event) => onChange({ integrity: event.target.value })}
          style={{ minHeight: 42, borderRadius: 10, border: "1px solid #cbd5e1", padding: "10px 12px" }}
        >
          <option value="all">All integrity states</option>
          <option value="issues">Issues only</option>
          <option value="orphaned">Orphaned</option>
          <option value="missingOwner">Missing owner</option>
        </select>
        <select
          aria-label="Sort properties"
          value={values.sortBy}
          onChange={(event) => onChange({ sortBy: event.target.value })}
          style={{ minHeight: 42, borderRadius: 10, border: "1px solid #cbd5e1", padding: "10px 12px" }}
        >
          <option value="updatedAt">Updated</option>
          <option value="createdAt">Created</option>
          <option value="name">Name</option>
        </select>
        <select
          aria-label="Sort direction"
          value={values.sortDir}
          onChange={(event) => onChange({ sortDir: event.target.value })}
          style={{ minHeight: 42, borderRadius: 10, border: "1px solid #cbd5e1", padding: "10px 12px" }}
        >
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
        <select
          aria-label="Page size"
          value={values.pageSize}
          onChange={(event) => onChange({ pageSize: event.target.value })}
          style={{ minHeight: 42, borderRadius: 10, border: "1px solid #cbd5e1", padding: "10px 12px" }}
        >
          <option value="25">25 per page</option>
          <option value="50">50 per page</option>
          <option value="100">100 per page</option>
        </select>
      </div>
      <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
        <Button variant="secondary" onClick={onReset}>
          Reset filters
        </Button>
      </div>
    </Section>
  );
};
