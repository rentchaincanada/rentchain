import type { StatusIncident } from "../api/statusApi";

type IncidentListProps = {
  incidents: StatusIncident[];
};

function IncidentList({ incidents }: IncidentListProps) {
  return (
    <div className="card">
      <h2>Incident History</h2>
      {incidents.length === 0 ? (
        <div className="muted">No incidents recorded.</div>
      ) : (
        <ul className="incident-list">
          {incidents.map((item) => (
            <li key={item.id} className="incident-row">
              <div className="incident-title-row">
                <strong>{item.title}</strong>
                <span className={`pill pill-${item.severity}`}>{item.severity}</span>
                <span className="pill">{item.status}</span>
              </div>
              <p>{item.message}</p>
              <div className="muted small">
                Created: {new Date(item.createdAtMs).toLocaleString()}
                {item.resolvedAtMs ? ` · Resolved: ${new Date(item.resolvedAtMs).toLocaleString()}` : ""}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default IncidentList;
