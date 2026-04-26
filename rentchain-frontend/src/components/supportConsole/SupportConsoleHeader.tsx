import React from "react";
import { Card, Pill } from "../ui/Ui";

type SupportConsoleHeaderProps = {
  resource: {
    type: string;
    id: string;
    title?: string | null;
    subtitle?: string | null;
    status?: string | null;
  };
};

export function SupportConsoleHeader({ resource }: SupportConsoleHeaderProps) {
  return (
    <Card style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>
          {resource.title || `${resource.type} ${resource.id}`}
        </h1>
        <Pill tone="accent">{resource.type}</Pill>
        {resource.status ? <Pill tone="default">{resource.status}</Pill> : null}
      </div>
      <div style={{ color: "#475569" }}>{resource.subtitle || `Resource ID: ${resource.id}`}</div>
      <div style={{ color: "#64748b", fontSize: 13 }}>Debug ID: {resource.id}</div>
    </Card>
  );
}

export default SupportConsoleHeader;

