import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card } from "../../components/ui/Ui";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "./MarketingLayout";
import { RequestAccessModal } from "../../components/marketing/RequestAccessModal";

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [requestOpen, setRequestOpen] = useState(false);

  useEffect(() => {
    document.title = "RentChain — Verified screening. Clear records.";
  }, []);

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          <h1 style={{ margin: 0, fontSize: "2.2rem" }}>RentChain</h1>
          <p style={{ margin: 0, color: text.secondary, fontSize: "1.1rem", fontWeight: 600 }}>
            Verified screening. Clear records. Trusted rental relationships.
          </p>
          <p style={{ margin: 0, color: text.muted, fontSize: "1rem", maxWidth: 720 }}>
            RentChain is a rental screening and management platform built to create transparency and accountability
            between landlords and tenants — through verified information and structured records.
          </p>
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", marginTop: spacing.sm }}>
            <Button type="button" onClick={() => setRequestOpen(true)}>
              Request access
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate("/login")}>
              Sign in
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate("/site/pricing")}>
              See pricing
            </Button>
          </div>
        </div>

        <Card>
          <h2 style={{ marginTop: 0 }}>For Landlords</h2>
          <h3 style={{ marginTop: 0, color: text.secondary }}>
            Make rental decisions with verified information — not guesswork.
          </h3>
          <p style={{ color: text.muted, marginBottom: spacing.md }}>
            RentChain helps landlords screen applicants, manage tenants, and maintain clear, defensible records
            throughout the rental lifecycle. From screening to lease events, everything is documented in a structured,
            time-stamped system designed to support better decisions and fewer disputes.
          </p>
          <p style={{ color: text.muted, margin: 0 }}>
            Whether you manage one unit or a growing portfolio, RentChain gives you a system you can rely on.
          </p>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>For Tenants</h2>
          <h3 style={{ marginTop: 0, color: text.secondary }}>
            A rental process built on clarity and consent.
          </h3>
          <p style={{ color: text.muted, marginBottom: spacing.md }}>
            RentChain gives tenants a transparent way to participate in the rental process. Screening, lease events,
            and recorded interactions are handled clearly — without hidden scoring, informal judgments, or unclear
            records.
          </p>
          <p style={{ color: text.muted, margin: 0 }}>
            Your information is handled with consent, accuracy, and respect for privacy.
          </p>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>What RentChain Does</h2>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted, lineHeight: 1.7 }}>
            <li>Tenant screening and verification</li>
            <li>Property, unit, and lease management</li>
            <li>Secure tenant invitations and onboarding</li>
            <li>Structured rental event records</li>
            <li>Clear documentation for payments, notices, and disputes</li>
          </ul>
          <p style={{ color: text.muted, marginTop: spacing.md, marginBottom: 0 }}>
            RentChain is designed to support fairness, accountability, and long-term clarity for everyone involved.
          </p>
        </Card>
      </div>
      <RequestAccessModal open={requestOpen} onClose={() => setRequestOpen(false)} />
    </MarketingLayout>
  );
};

export default LandingPage;
