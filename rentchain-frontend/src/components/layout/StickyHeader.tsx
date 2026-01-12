import React from "react";
import { spacing, colors, text } from "../../styles/tokens";

type StickyHeaderProps = {
  title: string;
  right?: React.ReactNode;
};

export const StickyHeader: React.FC<StickyHeaderProps> = ({ title, right }) => {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 25,
        background: "#fff",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        padding: `${spacing.sm} ${spacing.lg}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: 56,
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 18, color: text.primary }}>{title}</div>
      {right ? <div style={{ marginLeft: "auto" }}>{right}</div> : null}
    </div>
  );
};
