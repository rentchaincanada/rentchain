import React from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Section } from "../../components/ui/Ui";
import { colors, spacing, text } from "../../styles/tokens";
import { useAuth } from "../../context/useAuth";
import { normalizeTimelinePlan } from "../../features/automation/timeline/timelineEntitlements";

const AccountDataPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const plan = normalizeTimelinePlan(user?.plan);
  const timelineRetention =
    plan === "elite" || plan === "elite_enterprise"
      ? "Automation Timeline: up to 24 months visible."
      : "Automation Timeline: up to 90 days visible.";

  const handleProfileExport = () => {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        account: {
          userId: user?.id || null,
          email: user?.email || null,
          role: user?.actorRole || user?.role || null,
          landlordId: user?.actorLandlordId || user?.landlordId || null,
          plan: plan,
        },
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "rentchain-account-export.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      // export is non-blocking
    }
  };

  return (
    <Section style={{ maxWidth: 860, margin: "0 auto", display: "grid", gap: spacing.md }}>
      <Card elevated style={{ display: "grid", gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800 }}>Data Management</h1>
        <p style={{ margin: 0, color: text.muted }}>
          Export account-level data and review retention policy information.
        </p>
      </Card>

      <Card style={{ display: "grid", gap: spacing.md, border: `1px solid ${colors.border}` }}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Export options</div>
          <div style={{ color: text.muted, fontSize: 14 }}>
            Download a JSON snapshot of your account details for record keeping.
          </div>
          <div>
            <Button type="button" onClick={handleProfileExport}>
              Export account JSON
            </Button>
          </div>
        </div>

        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            background: colors.surfaceAlt,
            padding: "12px 14px",
            display: "grid",
            gap: 6,
          }}
        >
          <div style={{ fontWeight: 700 }}>Retention policy</div>
          <div style={{ color: text.muted, fontSize: 14 }}>{timelineRetention}</div>
          <div style={{ color: text.muted, fontSize: 14 }}>
            Billing receipts and legal records remain available in your billing and legal sections.
          </div>
        </div>

        <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
          <Button type="button" variant="secondary" onClick={() => navigate("/account")}>
            Back to My Account
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate("/billing#receipts")}>
            View receipts
          </Button>
        </div>
      </Card>
    </Section>
  );
};

export default AccountDataPage;
