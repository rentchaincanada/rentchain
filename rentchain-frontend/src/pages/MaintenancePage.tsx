import React, { useEffect } from "react";

type Props = {
  showHomeButton?: boolean;
};

const SUPPORT_EMAIL = String(import.meta.env.VITE_SUPPORT_EMAIL || "support@rentchain.ai")
  .trim()
  .toLowerCase();

const shellStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: "24px",
  background:
    "radial-gradient(1200px 700px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 600px at 85% 110%, rgba(37,99,235,0.2), transparent 55%), linear-gradient(160deg, #020617 0%, #0b1325 45%, #111c38 100%)",
  color: "#e2e8f0",
  overflow: "hidden",
};

const cardStyle: React.CSSProperties = {
  width: "min(760px, 100%)",
  borderRadius: 20,
  border: "1px solid rgba(148,163,184,0.25)",
  background: "linear-gradient(180deg, rgba(15,23,42,0.72), rgba(15,23,42,0.52))",
  boxShadow: "0 25px 70px rgba(2,6,23,0.55)",
  backdropFilter: "blur(10px)",
  padding: "clamp(20px, 4vw, 40px)",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  borderRadius: 999,
  border: "1px solid rgba(56,189,248,0.45)",
  background: "rgba(8,47,73,0.45)",
  color: "#7dd3fc",
  padding: "7px 12px",
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: "0.02em",
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 22,
};

const primaryButtonStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(125,211,252,0.55)",
  background: "linear-gradient(135deg, #0ea5e9, #2563eb)",
  color: "#ffffff",
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(148,163,184,0.4)",
  background: "rgba(15,23,42,0.45)",
  color: "#dbeafe",
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

const subtleStyle: React.CSSProperties = {
  color: "rgba(226,232,240,0.82)",
  fontSize: 14,
  margin: 0,
  lineHeight: 1.65,
};

const trustItemStyle: React.CSSProperties = {
  fontSize: 12,
  color: "rgba(203,213,225,0.86)",
  border: "1px solid rgba(148,163,184,0.28)",
  borderRadius: 999,
  padding: "6px 10px",
  background: "rgba(15,23,42,0.45)",
};

const MaintenancePage: React.FC<Props> = ({ showHomeButton = true }) => {
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "RentChain | Maintenance";
    }
  }, []);

  return (
    <main style={shellStyle} aria-labelledby="maintenance-title">
      <style>
        {`
          @keyframes rcMaintenanceShift {
            0% { transform: translate3d(0,0,0) scale(1); opacity: .55; }
            50% { transform: translate3d(-1.2%, 1%, 0) scale(1.04); opacity: .68; }
            100% { transform: translate3d(0,0,0) scale(1); opacity: .55; }
          }
          .rc-maintenance-overlay {
            position: absolute;
            inset: -25%;
            pointer-events: none;
            background:
              linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px) 0 0 / 32px 32px,
              linear-gradient(0deg, rgba(148,163,184,0.06) 1px, transparent 1px) 0 0 / 32px 32px;
            mask-image: radial-gradient(circle at 50% 40%, black, transparent 76%);
            animation: rcMaintenanceShift 16s ease-in-out infinite;
          }
        `}
      </style>
      <div className="rc-maintenance-overlay" aria-hidden />
      <section style={{ ...cardStyle, position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(191,219,254,0.9)", fontWeight: 800 }}>
          RentChain
        </div>
        <div style={{ marginTop: 12 }}>
          <span style={badgeStyle} aria-label="Scheduled maintenance status">
            Scheduled Maintenance
          </span>
        </div>
        <h1 id="maintenance-title" style={{ margin: "16px 0 12px", fontSize: "clamp(1.7rem, 3.2vw, 2.4rem)", lineHeight: 1.2, color: "#f8fafc" }}>
          We&apos;re making RentChain better.
        </h1>
        <p style={subtleStyle}>
          RentChain is currently undergoing maintenance to improve performance, reliability, and user experience.
          Your data remains secure. Please check back shortly.
        </p>

        <div style={actionRowStyle}>
          <button
            type="button"
            style={primaryButtonStyle}
            onClick={() => window.location.reload()}
            aria-label="Refresh page"
          >
            Refresh
          </button>
          {showHomeButton ? (
            <button
              type="button"
              style={secondaryButtonStyle}
              onClick={() => {
                window.location.assign("/");
              }}
              aria-label="Return to homepage"
            >
              Return Home
            </button>
          ) : null}
          {SUPPORT_EMAIL ? (
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              style={{ ...secondaryButtonStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
              aria-label="Contact support by email"
            >
              Contact Support
            </a>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
          <span style={trustItemStyle}>Secure platform</span>
          <span style={trustItemStyle}>Data preserved</span>
          <span style={trustItemStyle}>Service resuming shortly</span>
        </div>

        <p style={{ ...subtleStyle, marginTop: 18 }}>Thank you for your patience.</p>

        <footer style={{ marginTop: 22, display: "grid", gap: 5 }}>
          <div style={{ color: "rgba(203,213,225,0.95)", fontSize: 12 }}>© RentChain</div>
          <div style={{ color: "rgba(148,163,184,0.95)", fontSize: 12 }}>
            Professional tools for modern landlords.
          </div>
        </footer>
      </section>
    </main>
  );
};

export default MaintenancePage;
