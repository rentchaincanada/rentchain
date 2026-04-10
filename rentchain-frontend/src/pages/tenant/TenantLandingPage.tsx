import React from "react";
import { Link } from "react-router-dom";

const primaryLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 46,
  padding: "0 18px",
  borderRadius: 999,
  textDecoration: "none",
  fontWeight: 700,
  background: "#0f172a",
  color: "#f8fafc",
  boxShadow: "0 16px 28px rgba(15, 23, 42, 0.16)",
};

const secondaryLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 46,
  padding: "0 18px",
  borderRadius: 999,
  textDecoration: "none",
  fontWeight: 700,
  border: "1px solid rgba(15, 23, 42, 0.12)",
  color: "#0f172a",
  background: "rgba(255,255,255,0.84)",
};

const infoCardStyle: React.CSSProperties = {
  borderRadius: 20,
  border: "1px solid rgba(148, 163, 184, 0.24)",
  background: "rgba(255,255,255,0.84)",
  boxShadow: "0 20px 48px rgba(148, 163, 184, 0.12)",
  padding: "20px 22px",
  display: "grid",
  gap: 10,
};

export default function TenantLandingPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(14, 165, 233, 0.14) 0, rgba(255,255,255,0.96) 46%, rgba(240,249,255,0.92) 100%)",
        color: "#0f172a",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "clamp(24px, 5vw, 48px) clamp(16px, 4vw, 32px) 56px",
          display: "grid",
          gap: 32,
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <Link
            to="/"
            style={{
              color: "#0f172a",
              textDecoration: "none",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              fontSize: "1.05rem",
            }}
          >
            RentChain
          </Link>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link to="/tenant/login" style={secondaryLinkStyle}>
              Log in / Continue
            </Link>
            <Link to="/signup" style={secondaryLinkStyle}>
              Create profile
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
              style={{
                display: "inline-flex",
                alignItems: "center",
                width: "fit-content",
                borderRadius: 999,
                background: "rgba(255,255,255,0.72)",
                border: "1px solid rgba(148, 163, 184, 0.28)",
                color: "#0369a1",
                padding: "8px 12px",
                fontSize: "0.88rem",
                fontWeight: 700,
              }}
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
                }}
              >
                Your rental profile. Secure, organized, and in your control.
              </h1>
              <p
                style={{
                  margin: 0,
                  maxWidth: 620,
                  fontSize: "1.05rem",
                  lineHeight: 1.7,
                  color: "#334155",
                }}
              >
                Access your rental history, documents, and profile details in one place. Share
                information when needed.
              </p>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link to="/tenant/login" style={primaryLinkStyle}>
                Log in / Continue
              </Link>
              <Link to="/tenant/dashboard" style={secondaryLinkStyle}>
                Preview dashboard
              </Link>
            </div>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <div style={infoCardStyle}>
              <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>What you can manage here</div>
              <div style={{ color: "#475569", lineHeight: 1.6 }}>
                Keep your profile current, keep documents organized, and return to your rental
                history whenever a landlord asks you to share information.
              </div>
            </div>
            <div style={infoCardStyle}>
              <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>Designed for tenants first</div>
              <div style={{ color: "#475569", lineHeight: 1.6 }}>
                No sales prompts, no landlord setup language, and no pressure to navigate a
                property-management workflow just to manage your rental identity.
              </div>
            </div>
            <div style={infoCardStyle}>
              <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>When you are ready</div>
              <div style={{ color: "#475569", lineHeight: 1.6 }}>
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
