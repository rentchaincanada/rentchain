import React from "react";
import { Card } from "../ui/Ui";

type SupportConsoleSectionProps = {
  title: string;
  children: React.ReactNode;
};

export function SupportConsoleSection({ title, children }: SupportConsoleSectionProps) {
  return (
    <Card style={{ display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{title}</h2>
      {children}
    </Card>
  );
}

export default SupportConsoleSection;

