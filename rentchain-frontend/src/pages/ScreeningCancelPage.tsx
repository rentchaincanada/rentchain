// src/pages/ScreeningCancelPage.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { MacShell } from "../components/layout/MacShell";
import { Card, Section, Button } from "../components/ui/Ui";
import { spacing, text } from "../styles/tokens";

const ScreeningCancelPage: React.FC = () => {
  const navigate = useNavigate();

  const handleBack = () => navigate("/applications");

  return (
    <MacShell title="RentChain · Screening cancelled">
      <Section style={{ maxWidth: 680, margin: "0 auto" }}>
        <Card elevated>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
            <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>
              Payment cancelled
            </h1>
            <div style={{ color: text.muted, fontSize: "0.95rem" }}>
              Your screening payment was not completed. You can return to applications to restart
              when ready.
            </div>
            <Button type="button" variant="secondary" onClick={handleBack}>
              Back to applications
            </Button>
          </div>
        </Card>
      </Section>
    </MacShell>
  );
};

export default ScreeningCancelPage;

