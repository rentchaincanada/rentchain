import React from "react";
import type { SlaEvaluationV1 } from "../../api/adminSlaApi";
import EscalationBadge from "./EscalationBadge";
import SlaStageBadge from "./SlaStageBadge";

function formatAge(ageHours: number) {
  if (ageHours >= 48) return `${Math.round((ageHours / 24) * 10) / 10} days`;
  if (ageHours >= 24) return `${Math.round((ageHours / 24) * 10) / 10} day`;
  return `${ageHours} hours`;
}

export default function SlaSummaryPanel(props: { sla: SlaEvaluationV1 | null }) {
  if (!props.sla) {
    return <div style={{ color: "#64748b" }}>No SLA context is currently available for this resource.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <SlaStageBadge stage={props.sla.sla.stage} />
        <EscalationBadge level={props.sla.sla.escalationLevel} />
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <div>
          <strong>Age</strong>: {formatAge(props.sla.age.ageHours)}
        </div>
        <div>
          <strong>Thresholds</strong>: aging {props.sla.sla.thresholdHours.aging}h • due soon {props.sla.sla.thresholdHours.dueSoon}h • overdue {props.sla.sla.thresholdHours.overdue}h • escalated {props.sla.sla.thresholdHours.escalated}h
        </div>
        <div>
          <strong>Reason</strong>: {props.sla.reason.summary}
        </div>
        {props.sla.reason.details ? (
          <div style={{ color: "#475569" }}>{props.sla.reason.details}</div>
        ) : null}
      </div>
    </div>
  );
}
