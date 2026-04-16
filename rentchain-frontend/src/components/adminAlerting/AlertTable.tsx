import React from "react";
import { Link } from "react-router-dom";
import type { AdminAlertV1 } from "../../api/adminAlertingApi";
import AlertSeverityBadge from "./AlertSeverityBadge";

export default function AlertTable(props: {
  alerts: AdminAlertV1[];
  onAcknowledge: (alert: AdminAlertV1) => void;
}) {
  if (!props.alerts.length) return <div style={{ color: "#64748b" }}>No alerts are active right now.</div>;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {props.alerts.map((alert) => (
        <article key={alert.id} style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <AlertSeverityBadge severity={alert.severity} />
                <span style={{ fontSize: 12, color: "#475569", textTransform: "uppercase" }}>
                  {alert.category.replace(/_/g, " ")}
                </span>
                {alert.tags?.includes("watched") ? <span style={{ fontSize: 12, color: "#1d4ed8" }}>Watched</span> : null}
              </div>
              <strong>{alert.resource.title || `${alert.resource.type} ${alert.resource.id}`}</strong>
              <div>{alert.reason.summary}</div>
              <div style={{ color: "#64748b", fontSize: 13 }}>
                {alert.resource.type} • {alert.resource.id}
                {alert.resource.status ? ` • ${alert.resource.status}` : ""}
              </div>
            </div>
            <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
              <button type="button" onClick={() => props.onAcknowledge(alert)}>
                {alert.state.isAcknowledged ? "Acknowledged" : "Acknowledge"}
              </button>
              {alert.navigation.supportConsolePath ? <Link to={alert.navigation.supportConsolePath}>Open support console</Link> : null}
              {alert.navigation.portfolioScorePath ? <Link to={alert.navigation.portfolioScorePath}>Open portfolio score</Link> : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
