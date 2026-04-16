import React from "react";
import { Pill } from "../ui/Ui";
import type { RecommendationPriority } from "../../api/landlordActionRecommendationsApi";

const COLOR_BY_PRIORITY: Record<RecommendationPriority, string> = {
  high: "#b91c1c",
  medium: "#b45309",
  low: "#166534",
};

export default function RecommendationPriorityBadge({
  priority,
}: {
  priority: RecommendationPriority;
}) {
  return (
    <Pill style={{ color: COLOR_BY_PRIORITY[priority], borderColor: `${COLOR_BY_PRIORITY[priority]}33` }}>
      {priority === "high" ? "High priority" : priority === "medium" ? "Medium priority" : "Low priority"}
    </Pill>
  );
}
