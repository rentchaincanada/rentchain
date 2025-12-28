import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import "./PropertyDetailsPage.css";
import { getAuthToken, resolveApiUrl } from "../lib/apiClient";
import { useLedgerV2 } from "../hooks/useLedgerV2";
import { LedgerTimeline } from "../components/ledger/LedgerTimeline";
import { LedgerEventDrawer } from "../components/ledger/LedgerEventDrawer";

type PropertyOverview = {
  propertyId: string;
  name: string;
  address: string;
  totalUnits: number;
  occupiedUnits: number;
  occupancyRate: number;
  mtdRentDue: number;
  mtdRentCollected: number;
  mtdCollectionRate: number;
  mtdOutstanding: number;
  riskLevel: "low" | "medium" | "high" | string;
};

type DashboardOverviewResponse = {
  properties: PropertyOverview[];
};

type UnitRow = {
  unit: string;
  tenant: string;
  rent: number;
  status: "On time" | "Late" | "Vacant";
  leaseEnd: string;
  risk: "low" | "medium" | "high";
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function getRiskBadgeClass(risk: string): string {
  switch (risk) {
    case "low":
      return "risk-badge risk-badge--low";
    case "medium":
      return "risk-badge risk-badge--medium";
    case "high":
      return "risk-badge risk-badge--high";
    default:
      return "risk-badge";
  }
}

// Simple mocked units per property for demo / investor walkthrough
function getMockUnitsForProperty(propertyId?: string): UnitRow[] {
  switch (propertyId) {
    case "P001": // Harbour View Apartments
      return [
        {
          unit: "101",
          tenant: "Sarah Thompson",
          rent: 1350,
          status: "On time",
          leaseEnd: "2026-03-31",
          risk: "low",
        },
        {
          unit: "102",
          tenant: "Vacant",
          rent: 0,
          status: "Vacant",
          leaseEnd: "-",
          risk: "medium",
        },
        {
          unit: "203",
          tenant: "Daniel Lee",
          rent: 1450,
          status: "On time",
          leaseEnd: "2025-11-30",
          risk: "low",
        },
        {
          unit: "304",
          tenant: "Alex Martin",
          rent: 1200,
          status: "Late",
          leaseEnd: "2025-08-31",
          risk: "high",
        },
      ];
    case "P002": // Sackville Townhomes
      return [
        {
          unit: "1A",
          tenant: "Brown Family",
          rent: 1600,
          status: "On time",
          leaseEnd: "2026-01-31",
          risk: "low",
        },
        {
          unit: "2B",
          tenant: "Patel Household",
          rent: 1650,
          status: "On time",
          leaseEnd: "2025-12-15",
          risk: "low",
        },
        {
          unit: "3C",
          tenant: "Nguyen Family",
          rent: 1580,
          status: "On time",
          leaseEnd: "2026-05-31",
          risk: "low",
        },
      ];
    case "P003": // Downtown Studios
      return [
        {
          unit: "201",
          tenant: "Vacant",
          rent: 0,
          status: "Vacant",
          leaseEnd: "-",
          risk: "medium",
        },
        {
          unit: "202",
          tenant: "Chris Evans",
          rent: 1100,
          status: "Late",
          leaseEnd: "2025-09-30",
          risk: "high",
        },
        {
          unit: "203",
          tenant: "Taylor Fox",
          rent: 1150,
          status: "On time",
          leaseEnd: "2026-02-28",
          risk: "low",
        },
        {
          unit: "204",
          tenant: "Vacant",
          rent: 0,
          status: "Vacant",
          leaseEnd: "-",
          risk: "medium",
        },
      ];
    default:
      return [];
  }
}

export const PropertyDetailsPage: React.FC = () => {
  const { propertyId } = useParams<{ propertyId: string }>();
  const [property, setProperty] = useState<PropertyOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { items: ledgerItems, loading: ledgerLoading, error: ledgerError, refresh: refreshLedger } =
    useLedgerV2({ propertyId: propertyId || undefined, limit: 10 });
  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null);

  const units = getMockUnitsForProperty(propertyId);

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = getAuthToken();
        const response = await fetch(
          resolveApiUrl("/dashboard/overview"),
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const json = (await response.json()) as DashboardOverviewResponse;
        const found = json.properties.find(
          (p) => p.propertyId === propertyId
        );

        if (!found) {
          setError("Property not found.");
        } else {
          setProperty(found);
        }
      } catch (err: any) {
        console.error("Failed to load property details:", err);
        setError("Failed to load property.");
      } finally {
        setLoading(false);
      }
    };

    fetchProperty();
  }, [propertyId]);

  if (loading) {
    return (
      <main className="property-page">
        <p className="property-page__state">Loading property…</p>
      </main>
    );
  }

  if (error || !property) {
    return (
      <main className="property-page">
        <p className="property-page__state">{error ?? "No property data."}</p>
        <Link to="/" className="property-page__back-link">
          ← Back to dashboard
        </Link>
      </main>
    );
  }

  const occText = `${property.occupiedUnits} / ${property.totalUnits} units`;

  return (
    <main className="property-page">
      <div className="property-page__topbar">
        <Link to="/" className="property-page__back-link">
          ← Back to dashboard
        </Link>
      </div>

      <header className="property-page__header">
        <div>
          <h1 className="property-page__title">{property.name}</h1>
          <p className="property-page__address">{property.address}</p>
        </div>
        <div className="property-page__header-meta">
          <span className={getRiskBadgeClass(property.riskLevel)}>
            {property.riskLevel.charAt(0).toUpperCase() +
              property.riskLevel.slice(1)}
          </span>
        </div>
      </header>

      <section className="property-page__summary-grid">
        <div className="property-summary-card">
          <div className="property-summary-card__label">Occupancy</div>
          <div className="property-summary-card__value">
            {formatPercent(property.occupancyRate)}
          </div>
          <div className="property-summary-card__sublabel">{occText}</div>
        </div>

        <div className="property-summary-card">
          <div className="property-summary-card__label">MTD Rent</div>
          <div className="property-summary-card__value">
            {formatCurrency(property.mtdRentCollected)}
          </div>
          <div className="property-summary-card__sublabel">
            of {formatCurrency(property.mtdRentDue)} due
          </div>
        </div>

        <div className="property-summary-card">
          <div className="property-summary-card__label">MTD Outstanding</div>
          <div className="property-summary-card__value">
            {formatCurrency(property.mtdOutstanding)}
          </div>
        </div>

        <div className="property-summary-card">
          <div className="property-summary-card__label">Collection rate</div>
          <div className="property-summary-card__value">
            {formatPercent(property.mtdCollectionRate)}
          </div>
        </div>
      </section>

      <section className="property-page__section">
        <h2 className="property-page__section-title">Units & tenants</h2>
        <p className="property-page__section-subtitle">
          Current rent roll and high-level tenant status for this property.
        </p>

        {units.length === 0 ? (
          <div className="property-page__placeholder">
            <p>No unit-level data configured yet.</p>
          </div>
        ) : (
          <div className="property-units-table-wrapper">
            <table className="property-units-table">
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Tenant</th>
                  <th>Rent</th>
                  <th>Status</th>
                  <th>Lease end</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.unit}>
                    <td>{u.unit}</td>
                    <td>{u.tenant}</td>
                    <td>
                      {u.rent > 0 ? formatCurrency(u.rent) : <span>-</span>}
                    </td>
                    <td>{u.status}</td>
                    <td>{u.leaseEnd}</td>
                    <td>
                      <span className={getRiskBadgeClass(u.risk)}>
                        {u.risk.charAt(0).toUpperCase() + u.risk.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="property-page__section">
        <h2 className="property-page__section-title">Property Timeline</h2>
        <p className="property-page__section-subtitle">
          Recent ledger activity for this property.
        </p>
        {ledgerError ? (
          <div className="property-page__placeholder">
            <p style={{ color: "red" }}>{ledgerError}</p>
          </div>
        ) : ledgerLoading ? (
          <div className="property-page__placeholder">
            <p>Loading timeline…</p>
          </div>
        ) : (
          <LedgerTimeline
            items={ledgerItems}
            emptyText="No activity yet"
            onSelect={(id) => setSelectedLedgerId(id)}
          />
        )}
        {selectedLedgerId ? (
          <LedgerEventDrawer eventId={selectedLedgerId} onClose={() => setSelectedLedgerId(null)} />
        ) : null}
      </section>

      <section className="property-page__section">
        <h2 className="property-page__section-title">Maintenance & activity</h2>
        <p className="property-page__section-subtitle">
          This section will summarize open maintenance tickets, recent events,
          and property-specific AI insights.
        </p>
        <div className="property-page__placeholder">
          <p>Maintenance + AI insights timeline coming soon.</p>
        </div>
      </section>
    </main>
  );
};
