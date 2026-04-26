import React from "react";
import type { PortfolioScoreShareRecordV1 } from "../../api/landlordPortfolioScoreSharingApi";
import { Card, Pill } from "../ui/Ui";

function labelForVisibility(visibility: PortfolioScoreShareRecordV1["visibility"]) {
  if (visibility === "shareable_link") return "Shareable link";
  if (visibility === "landlord_visible") return "Landlord visible";
  return "Private";
}

export default function PortfolioScoreVisibilityCard({
  sharing,
}: {
  sharing: PortfolioScoreShareRecordV1 | null;
}) {
  const visibility = sharing?.visibility || "private";
  return (
    <Card elevated style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div style={{ display: "grid", gap: 6 }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Sharing visibility</h2>
          <div style={{ color: "#475569" }}>
            Control whether your Portfolio Score™ stays private or is available through a tokenized shared link.
          </div>
        </div>
        <Pill>{labelForVisibility(visibility)}</Pill>
      </div>
      {sharing?.shareEnabledAt ? (
        <div style={{ color: "#64748b", fontSize: "0.95rem" }}>
          Sharing enabled: {new Date(sharing.shareEnabledAt).toLocaleString()}
        </div>
      ) : null}
      {sharing?.revokedAt ? (
        <div style={{ color: "#64748b", fontSize: "0.95rem" }}>
          Last revoked: {new Date(sharing.revokedAt).toLocaleString()}
        </div>
      ) : null}
    </Card>
  );
}
