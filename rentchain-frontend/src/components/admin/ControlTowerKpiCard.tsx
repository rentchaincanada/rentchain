import React from "react";
import { Card } from "../ui/Ui";
import { spacing, text } from "../../styles/tokens";

type Props = {
  label: string;
  value: string;
  sublabel?: string;
  large?: boolean;
};

const ControlTowerKpiCard: React.FC<Props> = ({ label, value, sublabel, large = false }) => {
  return (
    <Card
      style={{
        padding: large ? spacing.lg : spacing.md,
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ fontSize: large ? "2rem" : "1.5rem", lineHeight: 1.1, fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: 13, color: text.muted }}>{label}</div>
      {sublabel ? <div style={{ fontSize: 12, color: text.muted }}>{sublabel}</div> : null}
    </Card>
  );
};

export default ControlTowerKpiCard;
