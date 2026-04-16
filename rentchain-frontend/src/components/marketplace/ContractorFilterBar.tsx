import React from "react";
import { Button, Input } from "../ui/Ui";

export default function ContractorFilterBar({
  serviceCategory,
  serviceArea,
  availabilityStatus,
  onChange,
  onRefresh,
}: {
  serviceCategory: string;
  serviceArea: string;
  availabilityStatus: string;
  onChange: (next: { serviceCategory?: string; serviceArea?: string; availabilityStatus?: string }) => void;
  onRefresh?: () => void;
}) {
  return (
    <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
      <Input value={serviceCategory} onChange={(e) => onChange({ serviceCategory: e.target.value })} placeholder="Service category" />
      <Input value={serviceArea} onChange={(e) => onChange({ serviceArea: e.target.value })} placeholder="Service area" />
      <select value={availabilityStatus} onChange={(e) => onChange({ availabilityStatus: e.target.value })}>
        <option value="">Any availability</option>
        <option value="active">Active</option>
        <option value="limited">Limited</option>
        <option value="inactive">Inactive</option>
      </select>
      {onRefresh ? (
        <Button type="button" variant="secondary" onClick={onRefresh}>
          Refresh
        </Button>
      ) : null}
    </div>
  );
}
