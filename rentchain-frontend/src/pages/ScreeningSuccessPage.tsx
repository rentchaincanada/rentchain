// src/pages/ScreeningSuccessPage.tsx
import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MacShell } from "../components/layout/MacShell";
import { Card, Section, Button } from "../components/ui/Ui";
import { spacing, text } from "../styles/tokens";

const ScreeningSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const destination = sessionId
    ? `/screening?session_id=${encodeURIComponent(sessionId)}`
    : "/screening";

  const handleContinue = () => navigate(destination, { replace: true });

  return (
    <MacShell title="RentChain · Screening success">
      <Section style={{ maxWidth: 680, margin: "0 auto" }}>
        <Card elevated>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
            <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>
              Payment received — finalizing report…
            </h1>
            <div style={{ color: text.muted, fontSize: "0.95rem" }}>
              We&apos;re finishing your screening report now. Continue to your screening to see the
              latest status. We&apos;ll email you when the report is ready.
            </div>
            <div>
              <Button type="button" onClick={handleContinue}>
                View screening
              </Button>
            </div>
          </div>
        </Card>
      </Section>
    </MacShell>
  );
};

export default ScreeningSuccessPage;

