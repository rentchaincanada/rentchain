import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, Section, Button } from "../../components/ui/Ui";
import { spacing, text } from "../../styles/tokens";

const ScreeningSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const applicationId = searchParams.get("applicationId") || "";
  const rawReturnTo = searchParams.get("returnTo") || "/dashboard";
  const returnTo = rawReturnTo.startsWith("/") ? rawReturnTo : "/dashboard";

  return (
    <Section style={{ maxWidth: 680, margin: "0 auto" }}>
      <Card elevated>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>
            Payment received — screening started
          </h1>
          <div style={{ color: text.muted, fontSize: "0.95rem" }}>
            We’re finalizing your screening report. You’ll see updates in the application and
            receive an email when it’s ready.
          </div>
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            <Button type="button" onClick={() => navigate(returnTo, { replace: true })}>
              Back to dashboard
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate("/applications", { replace: true })}
            >
              View applications
            </Button>
          </div>
          {applicationId ? (
            <div style={{ color: text.subtle, fontSize: "0.85rem" }}>
              Application ID: {applicationId}
            </div>
          ) : null}
        </div>
      </Card>
    </Section>
  );
};

export default ScreeningSuccessPage;
