import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { PortfolioHealthDimensionV1 } from "../../api/landlordPortfolioHealthApi";
import { Card, Pill } from "../ui/Ui";

type Props = {
  dimensions: PortfolioHealthDimensionV1[];
};

const dimensionActions: Record<PortfolioHealthDimensionV1["key"], { href: string; label: string }> = {
  screening_health: { href: "/applications", label: "Review applications" },
  maintenance_health: { href: "/work-orders", label: "Review work orders" },
  workflow_health: { href: "/operations", label: "Open operations" },
  response_health: { href: "/landlord/inbox", label: "Open inbox" },
};

export default function PortfolioHealthDimensionList({ dimensions }: Props) {
  return (
    <Card style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Health actions</h2>
        <div style={{ color: "#475569", fontSize: 13 }}>Each area opens the workspace that owns follow-through.</div>
      </div>
      {dimensions.length === 0 ? (
        <div style={{ color: "#475569" }}>No health actions are currently available.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 10 }}>
          {dimensions.map((dimension) => {
            const action = dimensionActions[dimension.key];
            return (
              <Link
                key={dimension.key}
                to={action.href}
                style={{
                  display: "grid",
                  gap: 10,
                  minHeight: 132,
                  padding: 14,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  color: "#0f172a",
                  textDecoration: "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ fontWeight: 800 }}>{dimension.label}</div>
                  <Pill>{dimension.status.replace(/_/g, " ")}</Pill>
                </div>
                <div style={{ color: "#475569", lineHeight: 1.4 }}>{dimension.summary}</div>
                <div style={{ marginTop: "auto", display: "inline-flex", gap: 8, alignItems: "center", color: "#1d4ed8", fontWeight: 800 }}>
                  {action.label}
                  <ArrowRight size={16} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}
