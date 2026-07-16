import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { RentChainLogo } from "../brand/RentChainLogo";

type Props = {
  children: React.ReactNode;
};

export const ContractorNav: React.FC<Props> = ({ children }) => {
  const { logout } = useAuth();
  const nav = useNavigate();

  return (
    <div style={{ minHeight: "100vh", background: "#f4efe6" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          borderBottom: "1px solid #e2e8f0",
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(6px)",
        }}
      >
        <div
          style={{
            maxWidth: 960,
            margin: "0 auto",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <RentChainLogo href="/contractor" variant="lockup" size="md" />
            <span style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>Contractor</span>
          </div>
          <nav style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <NavLink to="/contractor" end style={contractorLinkStyle}>
              Dashboard
            </NavLink>
            <NavLink to="/contractor/inbox" style={contractorLinkStyle}>
              Inbox
            </NavLink>
            <NavLink to="/contractor/jobs" style={contractorLinkStyle}>
              Jobs
            </NavLink>
            <NavLink to="/contractor/profile" style={contractorLinkStyle}>
              Profile
            </NavLink>
            <button
              type="button"
              onClick={() => {
                void logout();
              }}
              style={{
                border: "1px solid #e2e8f0",
                background: "#fff",
                borderRadius: 8,
                padding: "6px 10px",
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>
      <main data-testid="contractor-content" style={{ width: "100%", maxWidth: 960, margin: "0 auto", padding: 16, boxSizing: "border-box" }}>{children}</main>
    </div>
  );
};

const contractorLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
  color: isActive ? "#1e5f4e" : "#334155",
  background: isActive ? "rgba(30,95,78,0.12)" : "transparent",
  border: isActive ? "1px solid rgba(30,95,78,0.28)" : "1px solid transparent",
  borderRadius: 999,
  padding: "7px 10px",
  fontWeight: 700,
  textDecoration: "none",
});
