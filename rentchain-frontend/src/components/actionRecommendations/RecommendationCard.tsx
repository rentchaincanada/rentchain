import React from "react";
import { Link } from "react-router-dom";
import { Card } from "../ui/Ui";
import type { LandlordActionRecommendationV1 } from "../../api/landlordActionRecommendationsApi";
import RecommendationPriorityBadge from "./RecommendationPriorityBadge";

export default function RecommendationCard({
  recommendation,
}: {
  recommendation: LandlordActionRecommendationV1;
}) {
  return (
    <Card elevated style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div style={{ display: "grid", gap: 6 }}>
          <h3 style={{ margin: 0, fontSize: "1.05rem" }}>{recommendation.title}</h3>
          <div style={{ color: "#475569" }}>{recommendation.summary}</div>
        </div>
        <RecommendationPriorityBadge priority={recommendation.priority} />
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Why now</div>
          <div style={{ color: "#475569" }}>{recommendation.whyNow}</div>
        </div>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Suggested action</div>
          <div style={{ color: "#0f172a" }}>{recommendation.suggestedAction}</div>
        </div>
      </div>

      {recommendation.navigation?.path && recommendation.navigation?.label ? (
        <div>
          <Link to={recommendation.navigation.path}>{recommendation.navigation.label}</Link>
        </div>
      ) : null}
    </Card>
  );
}
