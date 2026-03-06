import type { StatusComponent } from "../api/statusApi";
import StatusBadge from "./StatusBadge";

type StatusComponentCardProps = {
  component: StatusComponent;
};

function StatusComponentCard({ component }: StatusComponentCardProps) {
  return (
    <div className="card component-card">
      <div className="component-header">
        <h3>{component.name}</h3>
        <StatusBadge status={component.status} />
      </div>
      {component.message ? <p className="component-message">{component.message}</p> : null}
      <div className="muted small">
        Updated: {component.updatedAtMs ? new Date(component.updatedAtMs).toLocaleString() : "n/a"}
      </div>
    </div>
  );
}

export default StatusComponentCard;
