import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";

type Props = {
  children: React.ReactNode;
};

export const ContractorNav: React.FC<Props> = ({ children }) => {
  const { logout } = useAuth();
  const nav = useNavigate();

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
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
            maxWidth: 1120,
            margin: "0 auto",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontWeight: 700 }}>RentChain Contractor</div>
          <nav style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <NavLink to="/contractor" style={{ color: "#334155", textDecoration: "none" }}>
              Dashboard
            </NavLink>
            <NavLink to="/contractor/jobs" style={{ color: "#334155", textDecoration: "none" }}>
              Jobs
            </NavLink>
            <NavLink to="/contractor/profile" style={{ color: "#334155", textDecoration: "none" }}>
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
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: 16 }}>{children}</main>
    </div>
  );
};
