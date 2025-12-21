// @ts-nocheck
import React, { useEffect, useState } from "react";
import {
  fetchDashboardProperties,
  DashboardProperty,
} from "../../services/dashboardPropertiesService";
import { TopNav } from "../components/layout/TopNav";
type DashboardPropertyTableProps = {
  // Optional: parent can still pass properties explicitly
  properties?: DashboardProperty[];
};

export function DashboardPropertyTable({
  properties,
}: DashboardPropertyTableProps) {
  const [rows, setRows] = useState<DashboardProperty[]>(properties ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If parent passes properties, use them.
  // Otherwise, fetch from /dashboard/overview once on mount.
  useEffect(() => {
    if (properties && properties.length > 0) {
      setRows(properties);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const result = await fetchDashboardProperties();

        if (!cancelled) {
          setRows(result);
        }
      } catch (err: any) {
        console.error("Failed to load dashboard properties", err);
        if (!cancelled) {
          setError("Unable to load properties.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [properties]);

  const hasRows = rows && rows.length > 0;

  return (
    <div className="dashboard-property-table">
      {loading && <div className="loading-state">Loading properties…</div>}

      {error && <div className="error-text">{error}</div>}

      {!loading && !error && !hasRows && (
        <div className="empty-state">No properties to display.</div>
      )}

      {hasRows && (
        <table className="property-table">
          <thead>
            <tr>
              <th>Property</th>
              <th>City</th>
              <th>Units</th>
              <th>Occupied</th>
              <th>Occupancy</th>
              <th>Avg Rent</th>
              <th>Risk</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((p) => {
              const occupancy =
                p.occupancyRate != null
                  ? Math.round(
                      p.occupancyRate > 1
                        ? p.occupancyRate
                        : p.occupancyRate * 100
                    )
                  : null;

              return (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.city}</td>
                  <td>{p.units}</td>
                  <td>{p.occupiedUnits ?? "-"}</td>
                  <td>{occupancy != null ? `${occupancy}%` : "-"}</td>
                  <td>
                    {p.avgRent != null
                      ? `$${p.avgRent.toLocaleString()}`
                      : "-"}
                  </td>
                  <td>{p.risk ?? "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
