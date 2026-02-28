import React from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Section } from "../../components/ui/Ui";
import { colors, spacing, text } from "../../styles/tokens";
import { useAuth } from "../../context/useAuth";

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, color: text.muted, fontWeight: 700 }}>{label}</span>
      <input
        value={value}
        readOnly
        style={{
          border: `1px solid ${colors.border}`,
          borderRadius: 10,
          padding: "10px 12px",
          fontSize: 14,
          background: colors.surface,
          color: text.primary,
        }}
      />
    </label>
  );
}

const AccountProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <Section style={{ maxWidth: 860, margin: "0 auto", display: "grid", gap: spacing.md }}>
      <Card elevated style={{ display: "grid", gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800 }}>Profile</h1>
        <p style={{ margin: 0, color: text.muted }}>
          Account identity and contact details for your workspace.
        </p>
      </Card>

      <Card style={{ display: "grid", gap: spacing.md, border: `1px solid ${colors.border}` }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: spacing.md }}>
          <ReadOnlyField label="Email" value={String(user?.email || "Not available")} />
          <ReadOnlyField label="User ID" value={String(user?.id || "Not available")} />
          <ReadOnlyField label="Role" value={String(user?.actorRole || user?.role || "Not available")} />
          <ReadOnlyField label="Workspace ID" value={String(user?.actorLandlordId || user?.landlordId || "Not available")} />
        </div>
        <div
          style={{
            fontSize: 13,
            color: text.muted,
            background: colors.surfaceAlt,
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            padding: "10px 12px",
          }}
        >
          Profile editing will be enabled in a future release.
        </div>
        <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
          <Button type="button" variant="secondary" onClick={() => navigate("/account")}>
            Back to My Account
          </Button>
          <Button type="button" onClick={() => navigate("/account/security")}>
            Account security
          </Button>
        </div>
      </Card>
    </Section>
  );
};

export default AccountProfilePage;
