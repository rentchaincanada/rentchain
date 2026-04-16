import React from "react";
import { Card, Section } from "../ui/Ui";
import type { LandlordActionRecommendationV1 } from "../../api/landlordActionRecommendationsApi";
import RecommendationCard from "./RecommendationCard";

export default function RecommendationList({
  recommendations,
}: {
  recommendations: LandlordActionRecommendationV1[];
}) {
  if (!recommendations.length) {
    return <Card>No recommended actions are available right now.</Card>;
  }

  return (
    <Section>
      <div style={{ display: "grid", gap: 12 }}>
        {recommendations.map((recommendation) => (
          <RecommendationCard key={recommendation.id} recommendation={recommendation} />
        ))}
      </div>
    </Section>
  );
}
