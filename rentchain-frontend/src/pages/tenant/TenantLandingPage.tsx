import React from "react";
import { Link } from "react-router-dom";
import { TENANT_DEFAULT_DESTINATION } from "../../lib/authDestination";
import { RentChainLogo } from "../../components/brand/RentChainLogo";
import {
  tenantEntryBadgeStyle,
  tenantEntryBodyStyle,
  tenantEntryContainerStyle,
  tenantEntryInfoCardStyle,
  tenantEntryPalette,
  tenantEntryPrimaryLinkStyle,
  tenantEntrySecondaryLinkStyle,
  tenantEntryShellStyle,
} from "./tenantEntryStyles";

const tenantLoginPath = `/tenant/login?next=${encodeURIComponent(TENANT_DEFAULT_DESTINATION)}`;

export default function TenantLandingPage() {
  return (
    <div style={tenantEntryShellStyle}>
      <div style={tenantEntryContainerStyle}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <RentChainLogo href="/site" size="md" />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link to={tenantLoginPath} style={tenantEntrySecondaryLinkStyle}>
              Log in / Continue
            </Link>
            <Link to={`${tenantLoginPath}&intent=create-profile`} style={tenantEntrySecondaryLinkStyle}>
              Get started
            </Link>
          </div>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 24,
            alignItems: "start",
          }}
        >
          <div style={{ display: "grid", gap: 18 }}>
            <div
              style={tenantEntryBadgeStyle}
            >
              Tenant portal
            </div>
            <div style={{ display: "grid", gap: 14 }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: "clamp(2.2rem, 5vw, 4rem)",
                  lineHeight: 1.04,
                  letterSpacing: "-0.04em",
                  maxWidth: 640,
                  color: tenantEntryPalette.ink,
                }}
              >
                Access your rental workspace.
              </h1>
              <p
                style={{
                  ...tenantEntryBodyStyle,
                  maxWidth: 620,
                  fontSize: "1.05rem",
                }}
              >
                View your lease, payments, messages, requests, and documents in one place. Use the
                link from your landlord or property manager to continue.
              </p>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link to={tenantLoginPath} style={tenantEntryPrimaryLinkStyle}>
                Log in / Continue
              </Link>
              <Link to="/tenant/dashboard" style={tenantEntrySecondaryLinkStyle}>
                Preview dashboard
              </Link>
            </div>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <div style={tenantEntryInfoCardStyle}>
              <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>What you can manage here</div>
              <div style={{ color: tenantEntryPalette.muted, lineHeight: 1.6 }}>
                Keep your profile current, keep documents organized, and return to your rental
                workspace when you need to review the record.
              </div>
            </div>
            <div style={tenantEntryInfoCardStyle}>
              <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>Designed for tenants first</div>
              <div style={{ color: tenantEntryPalette.muted, lineHeight: 1.6 }}>
                Tenant access stays focused on the rental information connected to your current
                invite, application, or tenancy.
              </div>
            </div>
            <div style={tenantEntryInfoCardStyle}>
              <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>When you are ready</div>
              <div style={{ color: tenantEntryPalette.muted, lineHeight: 1.6 }}>
                Continue into your dashboard to review profile details, application progress,
                documents, messages, and account history.
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
