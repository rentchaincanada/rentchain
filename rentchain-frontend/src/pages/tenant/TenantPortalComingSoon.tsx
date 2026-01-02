import React from "react";

export default function TenantPortalComingSoon() {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: "100%",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 12,
          padding: 18,
          background: "white",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
          Tenant portal coming soon
        </div>
        <div style={{ opacity: 0.75 }}>
          We’re preparing the tenant experience. Please check back later or contact your landlord for details.
        </div>
        <div style={{ opacity: 0.6, fontSize: 12, marginTop: 8 }}>
          VITE_TENANT_PORTAL_ENABLED: {String(import.meta.env.VITE_TENANT_PORTAL_ENABLED)}
        </div>
      </div>
    </div>
  );
}
