      {/* View in ledger link */}
      <div
        style={{
          marginTop: "0.5rem",
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={handleMarkCollected}
          style={{
            fontSize: "0.85rem",
            padding: "0.45rem 0.95rem",
            borderRadius: radius.md,
            border: `1px solid ${colors.border}`,
            background: colors.card,
            color: text.primary,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: shadows.sm,
          }}
        >
          Mark as collected
        </button>
        <button
          type="button"
          onClick={handleIssueRentCharge}
          style={{
            fontSize: "0.85rem",
            padding: "0.45rem 0.95rem",
            borderRadius: radius.md,
            border: `1px solid ${colors.border}`,
            background: colors.card,
            color: text.primary,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: shadows.sm,
          }}
        >
          Issue rent charge
        </button>
        <button
          type="button"
          onClick={handleRecordChargePayment}
          style={{
            fontSize: "0.85rem",
            padding: "0.45rem 0.95rem",
            borderRadius: radius.md,
            border: `1px solid ${colors.border}`,
            background: colors.card,
            color: text.primary,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: shadows.sm,
          }}
        >
          Record charge payment
        </button>
        <button
          type="button"
          onClick={handleViewInLedger}
          style={{
            fontSize: "0.8rem",
            padding: "0.4rem 0.85rem",
            borderRadius: radius.pill,
            border: `1px solid ${colors.border}`,
            background: colors.panel,
            color: text.primary,
            cursor: "pointer",
            boxShadow: shadows.sm,
          }}
        >
          View all ledger events ?
        </button>
        <button
          type="button"
          onClick={handleImpersonateTenant}
          style={{
            fontSize: "0.8rem",
            padding: "0.4rem 0.85rem",
            borderRadius: radius.pill,
            border: `1px solid ${colors.border}`,
            background: colors.card,
            color: text.primary,
            cursor: "pointer",
            boxShadow: shadows.sm,
          }}
        >
          View as tenant
        </button>
      </div>

      {/* If no extra data at all */}
      {!lease && payments.length === 0 && ledgerEntries.length === 0 && (
        <div
          style={{
            marginTop: "0.5rem",
            fontSize: "0.8rem",
            opacity: 0.7,
          }}
        >
          No lease, payment, or ledger detail available yet for this tenant.
        </div>
      )}
    </div>
  );
};

const DetailField: React.FC<{ label: string; value: React.ReactNode }> = ({
  label,
  value,
}) => (
  <div>
    <div style={{ color: text.muted, marginBottom: "0.1rem" }}>{label}</div>
    <div style={{ color: text.primary }}>{value}</div>
  </div>
);
