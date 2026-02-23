import React, { useMemo, useState } from "react";
import type { Property } from "@/api/propertiesApi";
import { setOnboardingStep } from "@/api/onboardingApi";
import { getLeasePackForProvince } from "@/lib/leasePackCatalog";
import { normalizeProvinceCode, provinceLabelFromCode } from "@/lib/provinces";
import { colors, radius, shadows, spacing, text } from "@/styles/tokens";

type Props = {
  open: boolean;
  onClose: () => void;
  properties: Property[];
  initialPropertyId?: string | null;
};

function toAbsoluteUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
  if (typeof window === "undefined") return pathOrUrl;
  return `${window.location.origin}${pathOrUrl}`;
}

export const LeasePackGeneratorModal: React.FC<Props> = ({
  open,
  onClose,
  properties,
  initialPropertyId,
}) => {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(initialPropertyId || "");
  const [copyMessage, setCopyMessage] = useState<string>("");

  const selectedProperty = useMemo(
    () => properties.find((property) => String(property.id) === String(selectedPropertyId)) || null,
    [properties, selectedPropertyId]
  );

  const provinceCode = normalizeProvinceCode(selectedProperty?.province || "UNSET");
  const pack = getLeasePackForProvince(provinceCode);

  React.useEffect(() => {
    if (!open) return;
    if (initialPropertyId) {
      setSelectedPropertyId(initialPropertyId);
      return;
    }
    if (properties.length > 0) {
      setSelectedPropertyId(String(properties[0].id));
    }
  }, [initialPropertyId, open, properties]);

  if (!open) return null;

  const handleCopy = async (url: string) => {
    const absolute = toAbsoluteUrl(url);
    try {
      await navigator.clipboard.writeText(absolute);
      setCopyMessage("Link copied");
      window.setTimeout(() => setCopyMessage(""), 1600);
    } catch {
      setCopyMessage("Copy unavailable");
      window.setTimeout(() => setCopyMessage(""), 1600);
    }
  };

  const handleDownload = async () => {
    try {
      await setOnboardingStep("leasePackGenerated", true);
    } catch {
      // no-op
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 4000,
        background: "rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.md,
      }}
    >
      <div
        style={{
          width: "min(820px, 96vw)",
          maxHeight: "90dvh",
          overflowY: "auto",
          borderRadius: radius.lg,
          border: `1px solid ${colors.border}`,
          background: colors.card,
          boxShadow: shadows.lg,
          padding: spacing.lg,
          display: "grid",
          gap: spacing.md,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>Generate Lease Pack</div>
            <div style={{ color: text.muted, fontSize: "0.92rem", marginTop: 4 }}>
              Choose a property to view province pack contents and download documents.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: radius.pill,
              background: colors.panel,
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 700, fontSize: "0.9rem" }}>Property</label>
          <select
            value={selectedPropertyId}
            onChange={(event) => setSelectedPropertyId(event.target.value)}
            style={{
              width: "100%",
              maxWidth: 420,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.md,
              padding: "10px 12px",
              background: colors.card,
              color: text.primary,
            }}
          >
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name || property.addressLine1 || property.id}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: spacing.md,
            background: colors.panel,
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700 }}>Province:</span>
            <span style={{ color: text.primary }}>{provinceLabelFromCode(provinceCode || "UNSET")}</span>
            <span
              title="Free templates provide standard document downloads. Pro automation adds guided drafting, scheduling, and workflow support."
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 18,
                height: 18,
                borderRadius: "999px",
                border: `1px solid ${colors.border}`,
                fontSize: 12,
                color: text.muted,
              }}
            >
              i
            </span>
            <span style={{ color: text.muted, fontSize: "0.85rem" }}>What this is</span>
          </div>

          {pack ? (
            <>
              <div style={{ fontWeight: 700 }}>{pack.title}</div>
              <div style={{ color: text.muted, fontSize: "0.9rem" }}>
                Version: {pack.version}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                <a
                  href={pack.bundleUrl}
                  download
                  onClick={() => void handleDownload()}
                  style={{
                    borderRadius: radius.pill,
                    border: `1px solid ${colors.accent}`,
                    background: colors.accent,
                    color: "#fff",
                    padding: "8px 12px",
                    textDecoration: "none",
                    fontWeight: 700,
                  }}
                >
                  Download Bundle
                </a>
                <a
                  href="/help/templates"
                  style={{
                    borderRadius: radius.pill,
                    border: `1px solid ${colors.border}`,
                    background: colors.card,
                    color: text.primary,
                    padding: "8px 12px",
                    textDecoration: "none",
                    fontWeight: 600,
                  }}
                >
                  Templates Library
                </a>
              </div>
              <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                {pack.contents.map((doc) => (
                  <div
                    key={doc.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: spacing.sm,
                      flexWrap: "wrap",
                      border: `1px solid ${colors.border}`,
                      borderRadius: radius.md,
                      padding: "8px 10px",
                      background: colors.card,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{doc.name}</div>
                      <div style={{ color: text.muted, fontSize: "0.85rem" }}>{doc.format}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <a
                        href={doc.url}
                        download
                        onClick={() => void handleDownload()}
                        style={{
                          textDecoration: "none",
                          border: `1px solid ${colors.border}`,
                          borderRadius: radius.pill,
                          padding: "6px 10px",
                          color: text.primary,
                          background: colors.panel,
                          fontWeight: 600,
                        }}
                      >
                        Download
                      </a>
                      <button
                        type="button"
                        onClick={() => void handleCopy(doc.url)}
                        style={{
                          border: `1px solid ${colors.border}`,
                          borderRadius: radius.pill,
                          padding: "6px 10px",
                          background: colors.card,
                          color: text.primary,
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Copy link
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ color: text.muted }}>
              Select a property with province set to Ontario or Nova Scotia to generate a pack.
            </div>
          )}
        </div>
        {copyMessage ? <div style={{ color: text.muted, fontSize: "0.85rem" }}>{copyMessage}</div> : null}
      </div>
    </div>
  );
};

