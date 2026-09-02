import React from "react";

const signedDocumentWorkspaceTheme = {
  card: "#fffaf1",
  cardStrong: "#fff6e8",
  border: "rgba(91, 70, 48, 0.18)",
  borderStrong: "rgba(91, 70, 48, 0.32)",
  charcoal: "#211c17",
  muted: "#63594d",
  pine: "#245842",
  pineSoft: "rgba(36, 88, 66, 0.12)",
  amberSoft: "rgba(146, 64, 14, 0.1)",
} as const;

type SignedDocumentWorkspaceAudience = "landlord" | "tenant";

export type SignedDocumentWorkspaceProps = {
  audience: SignedDocumentWorkspaceAudience;
  title?: string;
  statusLabel: string;
  documentLabel?: string | null;
  documentAvailable: boolean;
  sourceLabel?: string | null;
  signedAt?: string | number | null;
  completedAt?: string | number | null;
  evidenceLabel?: string | null;
  warnings?: string[];
  opening?: boolean;
  openError?: string | null;
  onOpenDocument?: () => void;
  unavailableMessage?: string;
  providerMetadataVisible?: boolean;
  documentKind?: "signed" | "generic";
};

function formatWorkspaceDate(value?: string | number | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function SignedDocumentWorkspace({
  audience,
  title,
  statusLabel,
  documentLabel,
  documentAvailable,
  sourceLabel,
  signedAt,
  completedAt,
  evidenceLabel,
  warnings = [],
  opening = false,
  openError = null,
  onOpenDocument,
  unavailableMessage,
  providerMetadataVisible = true,
  documentKind = "signed",
}: SignedDocumentWorkspaceProps) {
  const hasDocument = documentAvailable === true;
  const signedDate = formatWorkspaceDate(signedAt) || formatWorkspaceDate(completedAt);
  const signedDocument = documentKind === "signed";
  const heading = title || (audience === "tenant" ? "Signed document workspace" : "Signed Document Workspace");
  const fallbackMessage =
    unavailableMessage ||
    (hasDocument
      ? `This ${signedDocument ? "signed " : ""}document is available. Use the authorized action below to open a fresh secure copy.`
      : `No ${signedDocument ? "signed " : ""}document is available in this workspace yet.`);

  return (
    <section
      id="signed-document"
      aria-labelledby="signed-document-heading"
      style={{
        border: `1px solid ${signedDocumentWorkspaceTheme.borderStrong}`,
        borderRadius: 14,
        background: `linear-gradient(180deg, ${signedDocumentWorkspaceTheme.cardStrong} 0%, ${signedDocumentWorkspaceTheme.card} 100%)`,
        boxShadow: "0 14px 30px rgba(59, 44, 28, 0.08)",
        padding: 16,
        display: "grid",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 5, minWidth: 240 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: signedDocumentWorkspaceTheme.muted, textTransform: "uppercase", letterSpacing: 0 }}>
            Secure document review
          </div>
          <h2 id="signed-document-heading" style={{ margin: 0, fontSize: 20, color: signedDocumentWorkspaceTheme.charcoal }}>
            {heading}
          </h2>
          <div style={{ color: signedDocumentWorkspaceTheme.muted, lineHeight: 1.5 }}>
            {audience === "tenant"
              ? signedDocument
                ? "Review your tenant-safe signed lease access without exposing landlord-only workflow metadata."
                : "Review this tenant-safe source lease document separately from signing completion."
              : "Review the executed lease document alongside landlord lease context and evidence package readiness."}
          </div>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            whiteSpace: "nowrap",
            borderRadius: 999,
            border: `1px solid ${signedDocumentWorkspaceTheme.borderStrong}`,
            background: hasDocument ? signedDocumentWorkspaceTheme.pineSoft : signedDocumentWorkspaceTheme.amberSoft,
            color: hasDocument ? signedDocumentWorkspaceTheme.pine : "#92400e",
            padding: "7px 10px",
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {statusLabel}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
        }}
      >
        <WorkspaceFact label="Document" value={documentLabel || (hasDocument ? (signedDocument ? "Signed lease document" : "Lease document") : "Unavailable")} />
        <WorkspaceFact label="Signed" value={signedDate || "Pending"} />
        {providerMetadataVisible ? <WorkspaceFact label="Source" value={sourceLabel || (hasDocument ? "Secure document source" : "Pending")} /> : null}
        <WorkspaceFact label="Evidence" value={evidenceLabel || (hasDocument ? "Ready for lease evidence package" : "Awaiting signed document")} />
      </div>

      <div
        style={{
          border: `1px solid ${signedDocumentWorkspaceTheme.border}`,
          borderRadius: 12,
          background: "#fffdf8",
          padding: 14,
          display: "grid",
          gap: 6,
          color: signedDocumentWorkspaceTheme.muted,
        }}
      >
        <div style={{ fontWeight: 800, color: signedDocumentWorkspaceTheme.charcoal }}>
          {hasDocument ? "Secure access available" : "Document unavailable"}
        </div>
        <div>{fallbackMessage}</div>
        {warnings.length ? <div>{warnings[0]}</div> : null}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {onOpenDocument && (audience === "landlord" || hasDocument) ? (
          <button
            type="button"
            onClick={onOpenDocument}
            disabled={opening}
            style={workspaceActionStyle("primary")}
          >
            {opening ? "Opening..." : signedDocument ? "View signed document" : "View lease document"}
          </button>
        ) : null}
      </div>

      {openError ? <div role="alert" style={{ color: "#b91c1c", fontWeight: 700 }}>{openError}</div> : null}
    </section>
  );
}

function WorkspaceFact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${signedDocumentWorkspaceTheme.border}`,
        borderRadius: 10,
        padding: "10px 12px",
        background: "#fffdf8",
        display: "grid",
        gap: 4,
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 12, color: signedDocumentWorkspaceTheme.muted, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0 }}>
        {label}
      </div>
      <div style={{ color: signedDocumentWorkspaceTheme.charcoal, fontWeight: 800, overflowWrap: "anywhere" }}>{value}</div>
    </div>
  );
}

function workspaceActionStyle(variant: "primary" | "secondary"): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
    padding: "8px 12px",
    borderRadius: 10,
    border: `1px solid ${signedDocumentWorkspaceTheme.borderStrong}`,
    background: variant === "primary" ? signedDocumentWorkspaceTheme.pine : signedDocumentWorkspaceTheme.card,
    color: variant === "primary" ? "#fffaf1" : signedDocumentWorkspaceTheme.pine,
    textDecoration: "none",
    fontWeight: 800,
    cursor: "pointer",
  };
}
