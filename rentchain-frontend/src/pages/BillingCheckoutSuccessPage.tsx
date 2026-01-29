import React, { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, Section, Button } from "@/components/ui/Ui";
import { spacing, text } from "@/styles/tokens";

function sanitizeRedirectTo(raw: string | null): string | null {
  if (!raw) return null;
  const value = String(raw || "").trim();
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.includes("://")) return null;
  return value;
}

const BillingCheckoutSuccessPage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const redirectTo = useMemo(() => sanitizeRedirectTo(params.get("redirectTo")), [params]);

  useEffect(() => {
    if (!redirectTo) return;
    const t = window.setTimeout(() => {
      navigate(redirectTo);
    }, 900);
    return () => window.clearTimeout(t);
  }, [navigate, redirectTo]);

  return (
    <Section style={{ maxWidth: 560, margin: "0 auto" }}>
      <Card elevated>
        <div style={{ display: "grid", gap: spacing.sm }}>
          <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700 }}>
            Upgrade complete
          </h1>
          <div style={{ color: text.muted, fontSize: "0.95rem" }}>
            {redirectTo
              ? "You're all set. Returning you to where you left off..."
              : "You're all set. Return to your dashboard to continue."}
          </div>
          <div style={{ display: "flex", gap: spacing.sm }}>
            <Button type="button" onClick={() => navigate(redirectTo || "/dashboard")}>
              Continue
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate("/billing")}>
              View billing
            </Button>
          </div>
        </div>
      </Card>
    </Section>
  );
};

export default BillingCheckoutSuccessPage;
