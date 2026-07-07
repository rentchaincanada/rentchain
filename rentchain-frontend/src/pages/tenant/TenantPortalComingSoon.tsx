import React from "react";
import {
  tenantEntryBodyStyle,
  tenantEntryCardStyle,
  tenantEntryPalette,
  tenantEntryShellStyle,
} from "./tenantEntryStyles";

export default function TenantPortalComingSoon() {
  return (
    <div style={tenantEntryShellStyle}>
      <div
        style={{
          ...tenantEntryCardStyle("min(520px, 92vw)"),
          textAlign: "center",
        }}
      >
        <div style={{ color: tenantEntryPalette.ink, fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
          Tenant portal coming soon
        </div>
        <div style={tenantEntryBodyStyle}>
          We're preparing the tenant experience. Please check back later or contact your landlord for details.
        </div>
      </div>
    </div>
  );
}
