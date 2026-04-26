import React from "react";
import type {
  PortfolioScoreShareRecordV1,
  PortfolioScoreVisibility,
} from "../../api/landlordPortfolioScoreSharingApi";
import { Button, Card } from "../ui/Ui";

export default function PortfolioScoreShareControls({
  sharing,
  shareUrl,
  updating,
  onChangeVisibility,
  onRotate,
}: {
  sharing: PortfolioScoreShareRecordV1 | null;
  shareUrl?: string | null;
  updating?: boolean;
  onChangeVisibility: (visibility: PortfolioScoreVisibility) => void;
  onRotate: () => void;
}) {
  const visibility = sharing?.visibility || "private";
  return (
    <Card elevated style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Share controls</h2>
        <div style={{ color: "#475569" }}>
          Sharing stays private by default. Enable a tokenized link only when you want to share this score outside your landlord account.
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {[
          { key: "private", label: "Private", summary: "Visible only inside your landlord account." },
          { key: "landlord_visible", label: "Landlord visible", summary: "Explicit in-app visibility preference for future use." },
          { key: "shareable_link", label: "Shareable link", summary: "Generate a tokenized link that can be revoked or rotated." },
        ].map((option) => (
          <label
            key={option.key}
            style={{
              display: "flex",
              gap: 8,
              padding: 12,
              borderRadius: 12,
              border: `1px solid ${visibility === option.key ? "rgba(37,99,235,0.55)" : "rgba(15,23,42,0.12)"}`,
              background: visibility === option.key ? "rgba(37,99,235,0.05)" : "#fff",
            }}
          >
            <input
              type="radio"
              checked={visibility === option.key}
              disabled={updating}
              onChange={() => onChangeVisibility(option.key as PortfolioScoreVisibility)}
            />
            <div style={{ display: "grid", gap: 4 }}>
              <strong>{option.label}</strong>
              <span style={{ color: "#64748b", fontSize: "0.92rem" }}>{option.summary}</span>
            </div>
          </label>
        ))}
      </div>

      {visibility === "shareable_link" && shareUrl ? (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Share URL</div>
          <code style={{ padding: 12, borderRadius: 12, background: "rgba(15,23,42,0.05)", overflowWrap: "anywhere" }}>
            {shareUrl}
          </code>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button type="button" onClick={onRotate} disabled={updating}>
              Rotate link
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
