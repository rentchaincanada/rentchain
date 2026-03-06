import type { PublicStatusLevel } from "../api/statusApi";

const STATUS_META: Record<PublicStatusLevel, { label: string; className: string }> = {
  operational: { label: "Operational", className: "status-ok" },
  degraded: { label: "Degraded Performance", className: "status-warn" },
  partial_outage: { label: "Partial Outage", className: "status-bad" },
  major_outage: { label: "Major Outage", className: "status-critical" },
};

type StatusBadgeProps = {
  status: PublicStatusLevel;
};

function StatusBadge({ status }: StatusBadgeProps) {
  const view = STATUS_META[status] || STATUS_META.operational;
  return <span className={`status-badge ${view.className}`}>{view.label}</span>;
}

export default StatusBadge;
