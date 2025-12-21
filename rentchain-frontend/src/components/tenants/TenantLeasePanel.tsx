import React, { useEffect, useMemo, useState } from "react";
import {
  endLease,
  getLeasesForTenant,
  Lease,
} from "../../api/leasesApi";

interface TenantLeasePanelProps {
  tenantId: string | null;
}

export const TenantLeasePanel: React.FC<TenantLeasePanelProps> = ({ tenantId }) => {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endingLeaseId, setEndingLeaseId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!tenantId) {
      setLeases([]);
      setError(null);
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const load = async () => {
      try {
        setIsLoading(true);
        const data = await getLeasesForTenant(tenantId);
        if (!cancelled) {
          setLeases(data.leases);
          setError(null);
        }
      } catch (err) {
        console.error("[TenantLeasePanel] Failed to load leases", err);
        if (!cancelled) {
          setLeases([]);
          setError("Failed to load leases");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const activeLease = useMemo(
    () => leases.find((l) => l.status === "active") ?? null,
    [leases]
  );

  const endedLeases = useMemo(
    () => leases.filter((l) => l.status === "ended"),
    [leases]
  );

  const formatDate = (value?: string) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString();
  };

  const formatCurrency = (value: number) =>
    `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;

  const handleEndLease = async (leaseId: string) => {
    try {
      setEndingLeaseId(leaseId);
      await endLease(leaseId, new Date().toISOString());
      const refreshed = await getLeasesForTenant(tenantId as string);
      setLeases(refreshed.leases);
    } catch (err) {
      console.error("[TenantLeasePanel] Failed to end lease", err);
    } finally {
      setEndingLeaseId(null);
    }
  };

  let content: React.ReactNode = null;

  if (!tenantId) {
    content = (
      <div style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
        Select a tenant to view lease information.
      </div>
    );
  } else if (isLoading) {
    content = (
      <div style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
        Loading lease information…
      </div>
    );
  } else if (error) {
    content = (
      <div style={{ color: "#f97316", fontSize: "0.9rem" }}>{error}</div>
    );
  } else if (!leases || leases.length === 0) {
    content = (
      <div style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
        No leases recorded for this tenant yet.
      </div>
    );
  } else {
    content = (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {activeLease && (
          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.25)",
              padding: 12,
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 4 }}>
              Current Lease
            </div>
            <div style={{ color: "#e5e7eb", fontWeight: 600 }}>
              Property: {activeLease.propertyId} · Unit {activeLease.unitNumber}
            </div>
            <div style={{ color: "#cbd5f5", fontSize: 13, marginTop: 4 }}>
              Rent: {formatCurrency(activeLease.monthlyRent)} / month
            </div>
            <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>
              {formatDate(activeLease.startDate)} → {" "}
              {activeLease.endDate ? formatDate(activeLease.endDate) : "Ongoing"}
            </div>
            <button
              type="button"
              onClick={() => handleEndLease(activeLease.id)}
              disabled={endingLeaseId === activeLease.id}
              style={{
                marginTop: 8,
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid rgba(148,163,184,0.4)",
                background: "transparent",
                color: "#e5e7eb",
                cursor: endingLeaseId === activeLease.id ? "default" : "pointer",
                opacity: endingLeaseId === activeLease.id ? 0.7 : 1,
                fontSize: 12,
              }}
            >
              {endingLeaseId === activeLease.id ? "Ending…" : "End lease"}
            </button>
          </div>
        )}

        {endedLeases.length > 0 && (
          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.2)",
              padding: 12,
              background: "rgba(255,255,255,0.01)",
            }}
          >
            <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 6 }}>
              Lease History
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {endedLeases.map((lease) => (
                <div
                  key={lease.id}
                  style={{
                    borderRadius: 10,
                    border: "1px solid rgba(148,163,184,0.15)",
                    padding: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    color: "#e5e7eb",
                    fontSize: 13,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {lease.propertyId} · Unit {lease.unitNumber}
                    </div>
                    <div style={{ color: "#9ca3af", fontSize: 12 }}>
                      {formatDate(lease.startDate)} → {formatDate(lease.endDate)}
                    </div>
                  </div>
                  <div style={{ fontWeight: 600 }}>
                    {formatCurrency(lease.monthlyRent)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontWeight: 600, color: "#e5e7eb", fontSize: "1rem" }}>
        Lease Info
      </div>
      {content}
    </div>
  );
};
