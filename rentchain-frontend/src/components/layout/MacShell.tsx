// src/components/layout/MacShell.tsx
import React from "react";
import TopNav from "./TopNav";
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
  const renderTopNav = showTopNav;

  return (
    <div
      className="app-root"
      style={{
        minHeight: "100vh",
        backgroundColor: colors.bg,
        backgroundImage: colors.bgAmbient,
      }}
    >
      {renderTopNav ? (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 2000,
            backgroundColor: "#fff",
          }}
        >
          <TopNav />
        </div>
      ) : null}
      <main
        style={{
          maxWidth: layout.maxWidth,
          margin: "0 auto",
          padding: `${spacing.lg} ${layout.pagePadding} ${spacing.xxl}`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
          {children}
        </div>
      </main>
    </div>
  );
};
