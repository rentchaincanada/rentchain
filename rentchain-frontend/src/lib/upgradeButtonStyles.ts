import type React from "react";
import { colors, shadows } from "../styles/tokens";

export const upgradeStarterButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: `1px solid ${colors.navy}`,
  background: colors.navy,
  color: "#fff",
  cursor: "pointer",
  fontWeight: 700,
  boxShadow: shadows.sm,
};
