// @ts-nocheck
// src/components/dashboard/DashboardKpiStrip.tsx

import React, { useEffect, useRef, useState } from "react";
import {
  fetchDashboardOverview,
  type DashboardOverviewKpis as DashboardOverview,
} from "@/api/dashboardApi";
import { useToast } from "../ui/ToastProvider";
import { colors, spacing, radius, shadows, text } from "../../styles/tokens";
import { safeNumber as fmtNumber } from "@/utils/format";
import { unitsForProperty } from "@/lib/propertyCounts";

interface DashboardKpiStripProps {
  overview?: DashboardOverview | null;
}

export function DashboardKpiStrip({ overview: overviewProp }: DashboardKpiStripProps) {
  const [overview, setOverview] = useState<DashboardOverview | null>(overviewProp ?? null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<number | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (overviewProp) {
      setOverview(overviewProp);
      setLastUpdated(new Date());
      return;
    }

    let cancelled = false;
    const load = async (showErrorToast = false) => {
      try {
        if (!overview) setLoading(true);
        setError(null);
        const data = await fetchDashboardOverview();
        if (!cancelled) {
          setOverview(data);
          setLastUpdated(new Date());
        }
      } catch (err: any) {
        console.error("[DashboardKpiStrip] Failed to load dashboard overview", err);
        if (!cancelled) {
          setError("Unable to load KPIs");
          if (showErrorToast) {
            showToast({
              title: "KPI refresh failed",
              description: err?.message || "We kept your previous numbers.",
              variant: "warning",
            });
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    intervalRef.current = window.setInterval(() => {
      void load(true);
    }, 60_000);

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overviewProp]);

  const properties: any[] = Array.isArray(overview?.properties)
    ? overview!.properties
    : [];

  const k = overview?.kpis ?? {};

  // ----- helpers -----
  const safeNumber = (value: any): number | null => {
    if (typeof value === "number" && !Number.isNaN(value)) return value;
    if (typeof value === "string") {
      const n = Number(value);
      return Number.isNaN(n) ? null : n;
    }
    return null;
  };

  // totalProperties
  const derivedTotalProperties = properties.length || 0;
  let totalProperties = derivedTotalProperties;

  // totalUnits
  const derivedTotalUnits = properties.reduce((sum, p) => sum + unitsForProperty(p), 0);
  let totalUnits = derivedTotalUnits;

  // occupancyRate %
  let occupancyRate: number | null = null;
  const kpiOcc = safeNumber(k.occupancyRate);
  if (kpiOcc !== null) {
    // backend might send 0–1 or 0–100
    occupancyRate = kpiOcc <= 1 ? kpiOcc * 100 : kpiOcc;
  } else if (properties.length > 0) {
    let occupied = 0;
    let units = 0;
    for (const p of properties) {
      const unitsVal = safeNumber(p.units) ?? 0;
      const occRate = safeNumber(p.occupancyRate);
      if (occRate !== null) {
        const occ = occRate <= 1 ? occRate : occRate / 100;
        occupied += occ * unitsVal;
        units += unitsVal;
      }
    }
    if (units > 0) {
      occupancyRate = (occupied / units) * 100;
    }
  }

  // monthlyRentRoll – fallback: avgRent * units
  let monthlyRentRoll = safeNumber(k.monthlyRentRoll);
  if (monthlyRentRoll === null && properties.length > 0) {
    monthlyRentRoll = properties.reduce((sum, p) => {
      const units = safeNumber(p.units) ?? 0;
      const avgRent = safeNumber(p.avgRent) ?? 0;
      return sum + units * avgRent;
    }, 0);
  }

  // monthlyRentRoll
  const monthlyCollected = safeNumber(k.monthlyCollected) ?? 0;

  // monthlyDelinquent
  const monthlyDelinquent = safeNumber(k.monthlyDelinquent) ?? Math.max(0, (monthlyRentRoll ?? 0) - monthlyCollected);

  const formatMoney = (value: number | null) => {
    if (value === null) return "—";
    return `$${fmtNumber(value)}`;
  };

  const formatPercent = (value: number | null) => {
    if (value === null) return "—";
    const rounded = Math.round(value);
    return `${rounded}%`;
  };

  const showZeroHint = (totalUnits ?? 0) === 0;

  return (
    <section
      style={{
        marginTop: spacing.lg,
        marginBottom: spacing.lg,
      }}
    >
      {loading && !overview && (
        <p style={{ color: text.muted, margin: 0 }}>Loading portfolio KPIs…</p>
      )}

      {error && !loading && (
        <p style={{ color: colors.danger, fontWeight: 600 }}>{error}</p>
      )}

      {showZeroHint && !loading && !error && (
        <div
          style={{
            padding: `${spacing.sm} ${spacing.md}`,
            borderRadius: radius.md,
            border: `1px dashed ${colors.border}`,
            color: text.muted,
            marginBottom: spacing.sm,
            background: "rgba(148,163,184,0.08)",
          }}
        >
          Add units to activate KPIs.
        </div>
      )}

      {!loading && !error && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: spacing.md,
          }}
        >
          <div
            style={{
              background: colors.card,
              borderRadius: radius.md,
              padding: `${spacing.sm} ${spacing.md}`,
              border: `1px solid ${colors.border}`,
              boxShadow: shadows.sm,
            }}
          >
            <div style={{ fontSize: "0.8rem", color: text.muted, marginBottom: 4 }}>
              TOTAL PROPERTIES
            </div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>
              {totalProperties ?? 0}
            </div>
          </div>

          <div
            style={{
              background: colors.card,
              borderRadius: radius.md,
              padding: `${spacing.sm} ${spacing.md}`,
              border: `1px solid ${colors.border}`,
              boxShadow: shadows.sm,
            }}
          >
            <div style={{ fontSize: "0.8rem", color: text.muted, marginBottom: 4 }}>TOTAL UNITS</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>
              {totalUnits ?? 0}
            </div>
          </div>

          <div
            style={{
              background: colors.card,
              borderRadius: radius.md,
              padding: `${spacing.sm} ${spacing.md}`,
              border: `1px solid ${colors.border}`,
              boxShadow: shadows.sm,
            }}
          >
            <div style={{ fontSize: "0.8rem", color: text.muted, marginBottom: 4 }}>
              OCCUPANCY RATE
            </div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>
              {formatPercent(occupancyRate)}
            </div>
          </div>

          <div
            style={{
              background: colors.card,
              borderRadius: radius.md,
              padding: `${spacing.sm} ${spacing.md}`,
              border: `1px solid ${colors.border}`,
              boxShadow: shadows.sm,
            }}
          >
            <div style={{ fontSize: "0.8rem", color: text.muted, marginBottom: 4 }}>
              MONTHLY RENT ROLL
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>
              {formatMoney(monthlyRentRoll)}
            </div>
          </div>

          <div
            style={{
              background: colors.card,
              borderRadius: radius.md,
              padding: `${spacing.sm} ${spacing.md}`,
              border: `1px solid ${colors.border}`,
              boxShadow: shadows.sm,
            }}
          >
            <div style={{ fontSize: "0.8rem", color: text.muted, marginBottom: 4 }}>
              COLLECTED THIS MONTH
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>
              {formatMoney(monthlyCollected)}
            </div>
          </div>

          <div
            style={{
              background: colors.card,
              borderRadius: radius.md,
              padding: `${spacing.sm} ${spacing.md}`,
              color: text.primary,
              border: `1px solid ${colors.border}`,
              boxShadow: shadows.sm,
            }}
          >
            <div style={{ fontSize: "0.8rem", color: text.muted, marginBottom: 4 }}>
              MONTHLY DELINQUENT
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>
              {formatMoney(monthlyDelinquent)}
            </div>
          </div>
        </div>
      )}

      {lastUpdated && (
        <div
          style={{
            marginTop: 8,
            fontSize: "0.8rem",
            color: text.muted,
          }}
        >
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </section>
  );
}

export default DashboardKpiStrip;

