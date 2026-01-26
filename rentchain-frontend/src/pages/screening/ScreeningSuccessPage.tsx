import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, Section, Button } from "../../components/ui/Ui";
import { spacing, text } from "../../styles/tokens";
import { fetchScreening, type ScreeningPipeline } from "../../api/rentalApplicationsApi";

const ScreeningSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const applicationId = searchParams.get("applicationId") || "";
  const rawReturnTo = searchParams.get("returnTo") || "/dashboard";
  const returnTo = rawReturnTo.startsWith("/") ? rawReturnTo : "/dashboard";
  const [status, setStatus] = useState<ScreeningPipeline | null>(null);

  useEffect(() => {
    if (!applicationId) return;
    let active = true;
    fetchScreening(applicationId)
      .then((res) => {
        if (!active) return;
        if (res.ok) setStatus(res.screening || null);
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, [applicationId]);

  return (
    <Section style={{ maxWidth: 680, margin: "0 auto" }}>
      <Card elevated>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>
            Payment received.
          </h1>
          <div style={{ color: text.muted, fontSize: "0.95rem" }}>
            We’re preparing the screening checks now.
          </div>
          {status?.status ? (
            <div style={{ color: text.subtle, fontSize: "0.9rem" }}>
              Status: {status.status}
            </div>
          ) : null}
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            {applicationId ? (
              <Button
                type="button"
                onClick={() => navigate(`/applications?applicationId=${encodeURIComponent(applicationId)}`)}
              >
                Back to application
              </Button>
            ) : (
              <Button type="button" onClick={() => navigate(returnTo, { replace: true })}>
                Go to dashboard
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={() => navigate("/dashboard")}>
              Go to dashboard
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
