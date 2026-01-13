// src/components/layout/MacShell.tsx
import React from "react";
import { TopNav } from "./TopNav";
import { layout, spacing, colors, text } from "../../styles/tokens";

interface MacShellProps {
  title?: string;
  children: React.ReactNode;
  showTopNav?: boolean;
}

export const MacShell: React.FC<MacShellProps> = ({
  title = "RentChain",
  children,
  showTopNav = true,
}) => {
  const autoHide =
    typeof window !== "undefined" &&
    /^\/(dashboard|properties|tenants|applications|payments|billing|ledger|screening|account|blockchain)/i.test(
      window.location.pathname || ""
    );
  const renderTopNav = showTopNav && !autoHide;

  return (
    <div
      className="app-root"
      style={{
        minHeight: "100vh",
        backgroundColor: colors.bg,
        backgroundImage: colors.bgAmbient,
      }}
    >
      {renderTopNav ? <TopNav /> : null}
      <main
        style={{
          maxWidth: layout.maxWidth,
          margin: "0 auto",
          padding: `${spacing.lg} ${layout.pagePadding} ${spacing.xxl}`,
        }}
      >
        <header
          style={{
            marginBottom: spacing.lg,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.lg,
            color: text.primary,
          }}
        >
          <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>
            {title}
          </h1>
        </header>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
          {children}
        </div>
      </main>
    </div>
  );
};
