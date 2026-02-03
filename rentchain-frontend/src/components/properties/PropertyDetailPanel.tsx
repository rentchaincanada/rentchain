import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { Property } from "../../api/propertiesApi";
import {
  getLeasesForProperty,
  Lease,
} from "../../api/leasesApi";
import {
  getPropertyMonthlyPayments,
  Payment,
} from "@/api/paymentsApi";
import { importUnitsCsv } from "../../api/unitsImportApi";
import { fetchUnitsForProperty } from "../../api/unitsApi";
import { buildUnitsCsvTemplate, downloadTextFile } from "../../utils/csvTemplates";
import { UnitsCsvPreviewModal } from "./UnitsCsvPreviewModal";
import { UnitEditModal } from "./UnitEditModal";
import { SendApplicationModal } from "./SendApplicationModal";
import { parseCsvPreview } from "../../utils/csvPreview";
import { useToast } from "../ui/ToastProvider";
import { setOnboardingStep } from "../../api/onboardingApi";
import "../../styles/propertiesMobile.css";
import { useCapabilities } from "@/hooks/useCapabilities";
import { useUpgrade } from "@/context/UpgradeContext";
import { dispatchUpgradePrompt } from "@/lib/upgradePrompt";

interface PropertyDetailPanelProps {
  property: Property | null;
  onRefresh?: () => Promise<void> | void;
}

import { safeLocaleNumber } from "@/utils/format";

const formatCurrency = (value: number): string => `$${safeLocaleNumber(value)}`;

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const PropertyDetailPanel: React.FC<PropertyDetailPanelProps> = ({
  property,
  onRefresh,
}) => {
  const propertyId = property?.id;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { caps, features, loading: capsLoading } = useCapabilities();
  const { openUpgrade } = useUpgrade();
  const unitsEnabled = features?.unitsTable !== false;
  const applicationsEnabled = features?.applications !== false;
  const [leases, setLeases] = useState<Lease[]>([]);
  const [isLeasesLoading, setIsLeasesLoading] = useState(false);
  const [leasesError, setLeasesError] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [totalCollectedThisMonth, setTotalCollectedThisMonth] = useState(0);
  const [isPaymentsLoading, setIsPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingFilename, setPendingFilename] = useState<string>("");
  const [units, setUnits] = useState<any[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any | null>(null);
  const [sendAppUnit, setSendAppUnit] = useState<any | null>(null);

  const readFileText = useCallback((file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? "--"));
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  }, []);

  const confirmImport = useCallback(async () => {
    if (!pendingFile || !property?.id) return;
    try {
      setIsImporting(true);
      const csvText = await readFileText(pendingFile);
      console.log("[units-import] file=", pendingFile?.name, pendingFile?.size, pendingFile?.type);
      console.log("[units-import] csvText.len=", csvText?.length);
      console.log("[units-import] csvText.head=", String(csvText ?? "--").slice(0, 120));

      if (!csvText || !String(csvText).trim()) {
        showToast({
          message: "CSV import failed",
          description: "CSV file appears empty or unreadable.",
          variant: "error",
        });
        return;
      }
      const idempotencyKey = `${property.id}:${pendingFile.name}:${pendingFile.size}:${pendingFile.lastModified}`;
      const result = await importUnitsCsv(property.id, csvText, "partial", idempotencyKey);
      const created = result?.createdCount ?? result?.created ?? 0;
      const updated = result?.updatedCount ?? result?.updated ?? 0;
      const skipped = result?.skippedCount ?? result?.skipped ?? 0;
      const errCount = Array.isArray(result?.errors) ? result.errors.length : 0;
      showToast({
        message: "Units imported",
        description: `Created ${created} | Updated ${updated} | Skipped ${skipped}${
          errCount ? ` | ${errCount} issue(s)` : ""
        }`,
        variant: errCount ? "warning" : undefined,
      });
      setPreviewOpen(false);
      setPendingFile(null);
      setPendingFilename("");
      setImportMessage(
        result?.message ||
          `Created ${created} | Updated ${updated} | Skipped ${skipped}${
            errCount ? ` | ${errCount} issue(s)` : ""
          }`
      );
      if (onRefresh) {
        await onRefresh();
      }
      try {
        await setOnboardingStep("unitAdded", true);
      } catch {
        // ignore onboarding errors
      }
      // stay on page; no additional navigation/toasts
    } catch (e: any) {
      const status = e?.response?.status;
      const data = e?.response?.data;
      const code = data?.code;
      const errMsg = String(data?.error || e?.message || "");
      const isPlanLimit =
        (status === 403 && data?.error === "PLAN_LIMIT") ||
        (status === 409 && code === "LIMIT_REACHED") ||
        /plan limit/i.test(errMsg);

      if (isPlanLimit) {
        // UpgradePromptModal is dispatched via API error handlers.
        return;
      }

      showToast({
        message: "Import unsuccessful",
        description: e?.message ?? "--",
        variant: "error",
      });
    } finally {
      setIsImporting(false);
    }
  }, [navigate, onRefresh, pendingFile, property?.id, readFileText, showToast]);

  const handleSendApplication = useCallback(
    (u: any) => {
      if (!applicationsEnabled) {
        const redirectTo =
          typeof window !== "undefined"
            ? `${window.location.pathname}${window.location.search}`
            : "/properties";
        dispatchUpgradePrompt({
          featureKey: "applications",
          currentPlan: caps?.plan,
          source: "property_detail_panel",
          redirectTo,
        });
        return;
      }
      setSendAppUnit(u);
    },
    [applicationsEnabled, caps?.plan]
  );
  const setLeasesLoadingStates = (loading: boolean, error: string | null) => {
    setIsLeasesLoading(loading);
    setLeasesError(error);
  };

  useEffect(() => {
    let cancelled = false;
    setUnits(property?.units || []);

    const loadUnits = async () => {
      const pid = property?.id;
      if (!pid) {
        setUnits([]);
        return;
      }
      if (!unitsEnabled) {
        setUnits([]);
        return;
      }
      try {
        setUnitsLoading(true);
        const res = await fetchUnitsForProperty(pid);
        if (cancelled) return;
        if (Array.isArray(res) && res.length > 0) {
          setUnits(res);
          return;
        }
        const count = (property as any)?.unitCount ?? 0;
        if (count > 0) {
          setUnits(
            Array.from({ length: count }, (_, i) => ({
              id: `placeholder-${i}`,
              unitNumber: String(i + 1),
            }))
          );
        }
      } catch (e) {
        if (cancelled) return;
        const count = (property as any)?.unitCount ?? 0;
        if (count > 0) {
          setUnits(
            Array.from({ length: count }, (_, i) => ({
              id: `placeholder-${i}`,
              unitNumber: String(i + 1),
            }))
          );
        }
      } finally {
        if (!cancelled) setUnitsLoading(false);
      }
    };

    void loadUnits();
    return () => {
      cancelled = true;
    };
  }, [property?.id, property?.units, unitsEnabled]);

  useEffect(() => {
    let cancelled = false;
    const currentId = propertyId;
    if (!property) {
      setLeases([]);
      setLeasesLoadingStates(false, null);
      setPayments([]);
      setTotalCollectedThisMonth(0);
      setIsPaymentsLoading(false);
      setPaymentsError(null);
      return;
    }

    const load = async () => {
      try {
        setIsLeasesLoading(true);
        const data = await getLeasesForProperty(property.id);
        if (!cancelled) {
          if (currentId === propertyId) {
            setLeases(data.leases);
            setLeasesError(null);
          }
        }
      } catch (err) {
        console.error("[PropertyDetailPanel] Failed to load leases", err);
        if (!cancelled) {
          setLeases([]);
          setLeasesError("Leases could not be loaded");
        }
      } finally {
        if (!cancelled) {
          if (currentId === propertyId) {
            setIsLeasesLoading(false);
          }
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  // no plan fetch needed; starter supports unlimited units

  useEffect(() => {
    let cancelled = false;
    const currentId = propertyId;
    if (!property) {
      setPayments([]);
      setTotalCollectedThisMonth(0);
      setIsPaymentsLoading(false);
      setPaymentsError(null);
      return;
    }

    const loadPayments = async () => {
      try {
        setIsPaymentsLoading(true);
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const resp = await getPropertyMonthlyPayments(property.id, year, month);
        if (!cancelled) {
          if (currentId === propertyId) {
            setPayments(resp.payments);
            setTotalCollectedThisMonth(resp.total);
            setPaymentsError(null);
          }
        }
      } catch (err) {
        console.error("[PropertyDetailPanel] Failed to load payments", err);
        if (!cancelled) {
          setPayments([]);
          setTotalCollectedThisMonth(0);
          setPaymentsError("Payments could not be loaded");
        }
      } finally {
        if (!cancelled) {
          if (currentId === propertyId) {
            setIsPaymentsLoading(false);
          }
        }
      }
    };

    void loadPayments();

    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  
  const unitCount =
    Array.isArray(units) && units.length > 0
      ? units.length
      : Number((property as any)?.unitsCount ?? (property as any)?.unitCount ?? 0) || 0;
  const totalRentConfigured = units.reduce(
    (sum, u) =>
      sum + (typeof (u as any).rent === "number" ? (u as any).rent : 0),
    0
  );
  const displayedUnits = useMemo(() => {
    if (Array.isArray(units) && units.length > 0) return units;
    if (unitCount > 0) {
      return Array.from({ length: unitCount }, (_, i) => ({
        id: `placeholder-${i}`,
        unitNumber: String(i + 1),
      }));
    }
    return [];
  }, [units, unitCount]);

  const activeLeases = useMemo(
    () => leases.filter((l) => l.status === "active"),
    [leases]
  );
  const leasedUnits = activeLeases.length;
  const occupancy = unitCount > 0 ? (leasedUnits / unitCount) * 100 : 0;
  const leaseRentRoll = activeLeases.reduce(
    (sum, l) => sum + (typeof l.monthlyRent === "number" ? l.monthlyRent : 0),
    0
  );
  const collectionRate =
    leaseRentRoll > 0 ? totalCollectedThisMonth / leaseRentRoll : 0;

  const leasedUnitNumbers = useMemo(
    () => new Set(activeLeases.map((lease) => lease.unitNumber)),
    [activeLeases]
  );

  const displayName = property?.name || property?.addressLine1 || "Property";
  const showEmpty = !property;
  const showLoading = !!property && (isLeasesLoading || isPaymentsLoading);
  const showLeasesError = !!leasesError;
  const showPaymentsError = !!paymentsError;

  if (showEmpty) {
    return (
      <div style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
        Select a property to view details and rent roll.
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header */}
      <div className="rc-property-header" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div className="rc-property-title" style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0f172a" }}>
              {displayName}
            </div>
            <div className="rc-property-address" style={{ color: "#1f2937", fontSize: "0.9rem" }}>
              {property.addressLine1}
              {property.addressLine2 ? `, ${property.addressLine2}` : ""}
            </div>
            <div className="rc-property-city" style={{ color: "#475569", fontSize: "0.85rem" }}>
              {[property.city, property.province, property.postalCode]
                .filter(Boolean)
                .join(", ")}
            </div>
            <div className="rc-property-unit-count" style={{ color: "#0f172a", fontSize: "0.8rem", fontWeight: 600 }}>
              Units: {unitCount}
            </div>
            <div className="rc-property-meta" style={{ color: "#6b7280", fontSize: "0.8rem" }}>
              Added {formatDate(property.createdAt)}
            </div>
          </div>
          <div className="rc-units-actions" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              type="button"
              title="Edit property (coming soon)"
              disabled
              className="rc-units-action"
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.12)",
                background: "rgba(0,0,0,0.02)",
                color: "#6b7280",
                cursor: "not-allowed",
              }}
            >
              Edit
            </button>
            {capsLoading || unitsEnabled ? (
              <>
                <button
                  type="button"
                  title="Use Upload CSV to add units"
                  onClick={() => {
                    setImportMessage(null);
                    fileInputRef.current?.click();
                  }}
                  disabled={!property}
                  className="rc-units-action"
                  style={{
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(15,23,42,0.12)",
                    background: "#fff",
                    color: "#111827",
                    cursor: "pointer",
                  }}
                >
                  Add units
                </button>
                <button
                  type="button"
                  title="Upload units CSV"
                  onClick={() => {
                    setImportMessage(null);
                    fileInputRef.current?.click();
                  }}
                  disabled={isImporting || !property}
                  className="rc-units-action"
                  style={{
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(15,23,42,0.12)",
                    background: "#fff",
                    color: "#0f172a",
                    cursor: "pointer",
                  }}
                >
                  {isImporting ? "Uploading…" : "Upload CSV"}
                </button>
                <button
                  type="button"
                  title="Download a CSV template for units import"
                  onClick={() => {
                    const csv = buildUnitsCsvTemplate();
                    downloadTextFile("rentchain-units-template.csv", csv);
                  }}
                  className="rc-units-action rc-units-download"
                  style={{
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(15,23,42,0.12)",
                    background: "#fff",
                    color: "#0f172a",
                    cursor: "pointer",
                  }}
                >
                  Download CSV template
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file || !property) return;
                    try {
                      const text = await readFileText(file);
                      const { headers, rows } = parseCsvPreview(text, 10);
                      setPendingFile(file);
                      setPendingFilename(file.name);
                      setPreviewHeaders(headers);
                      setPreviewRows(rows);
                      setPreviewOpen(true);
                    } catch (err: any) {
                      showToast({
                        message: "Failed to read CSV file",
                        description: err?.message,
                        variant: "error",
                      });
                    }
                  }}
                />
              </>
            ) : (
              <button
                type="button"
                className="rc-units-action"
                onClick={() =>
                  openUpgrade({
                    reason: "screening",
                    plan: "Screening",
                    copy: {
                      title: "Upgrade to manage your rentals",
                      body: "RentChain Screening is free. Rental management starts on Starter.",
                    },
                    ctaLabel: "Upgrade to Starter",
                  })
                }
                style={{
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(59,130,246,0.35)",
                  background: "rgba(59,130,246,0.12)",
                  color: "#2563eb",
                  cursor: "pointer",
                }}
              >
                Upgrade to add units
              </button>
            )}
          </div>
        </div>
        {showLoading && (
          <div style={{ color: "#6b7280", fontSize: "0.85rem" }}>
            Loading leases/payments…
          </div>
        )}
        {(showLeasesError || showPaymentsError) && (
          <div style={{ color: "#b91c1c", fontSize: "0.85rem" }}>
            {leasesError || paymentsError}
          </div>
        )}
      </div>

    {/* KPI strip */}
      <div
        className="rc-kpi-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <div
          className="rc-kpi-card"
          style={{
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(148,163,184,0.15)",
          }}
        >
          <div className="rc-kpi-label" style={{ color: "#94a3b8", fontSize: "0.8rem" }}>
            Total units
          </div>
          <div className="rc-kpi-value" style={{ color: "#e5e7eb", fontWeight: 700, fontSize: "1.1rem" }}>
            {unitCount}
          </div>
        </div>
        <div
          className="rc-kpi-card"
          style={{
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(148,163,184,0.15)",
          }}
        >
          <div className="rc-kpi-label" style={{ color: "#94a3b8", fontSize: "0.8rem" }}>
            Leased units
          </div>
          <div className="rc-kpi-value" style={{ color: "#e5e7eb", fontWeight: 700, fontSize: "1.1rem" }}>
            {leasedUnits}
          </div>
        </div>
        <div
          className="rc-kpi-card"
          style={{
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(148,163,184,0.15)",
          }}
        >
          <div className="rc-kpi-label" style={{ color: "#94a3b8", fontSize: "0.8rem" }}>
            Occupancy
          </div>
          <div className="rc-kpi-value" style={{ color: "#e5e7eb", fontWeight: 700, fontSize: "1.05rem" }}>
            {unitCount === 0 ? "--" : `${occupancy.toFixed(0)}%`}
          </div>
        </div>
        <div
          className="rc-kpi-card"
          style={{
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(148,163,184,0.15)",
          }}
        >
          <div className="rc-kpi-label" style={{ color: "#94a3b8", fontSize: "0.8rem" }}>
            Lease rent roll
          </div>
          <div className="rc-kpi-value" style={{ color: "#e5e7eb", fontWeight: 700, fontSize: "1.05rem" }}>
            {formatCurrency(leaseRentRoll)}
          </div>
          <div className="rc-kpi-subtext" style={{ color: "#6b7280", fontSize: "0.75rem", marginTop: 2 }}>
            Configured rent roll: {formatCurrency(totalRentConfigured)}
          </div>
        </div>

        <div
          className="rc-kpi-card"
          style={{
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(148,163,184,0.15)",
          }}
        >
          <div className="rc-kpi-label" style={{ color: "#94a3b8", fontSize: "0.8rem" }}>
            Collected this month
          </div>
          <div className="rc-kpi-value" style={{ color: "#e5e7eb", fontWeight: 700, fontSize: "1.05rem" }}>
            {formatCurrency(totalCollectedThisMonth)}
          </div>
        </div>

        <div
          className="rc-kpi-card"
          style={{
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(148,163,184,0.15)",
          }}
        >
          <div className="rc-kpi-label" style={{ color: "#94a3b8", fontSize: "0.8rem" }}>
            Collection
          </div>
          <div className="rc-kpi-value" style={{ color: "#e5e7eb", fontWeight: 700, fontSize: "1.05rem" }}>
            {leaseRentRoll === 0 ? "--" : `${(collectionRate * 100).toFixed(0)}%`}
          </div>
        </div>
      </div>

      {importMessage && (
        <div
          style={{
            padding: 10,
            borderRadius: 10,
            border: "1px solid rgba(59,130,246,0.35)",
            background: "rgba(59,130,246,0.08)",
            color: "#0f172a",
            fontSize: "0.9rem",
          }}
        >
          {importMessage}
        </div>
      )}

      {activeLeases.length === 0 && (
        <div style={{ color: "#6b7280", fontSize: "0.85rem" }}>
          No active leases recorded for this property yet.
        </div>
      )}

      {/* Units table */}
      {!capsLoading && !unitsEnabled ? (
        <div
          style={{
            borderRadius: 12,
            border: "1px solid rgba(59,130,246,0.35)",
            background: "rgba(59,130,246,0.08)",
            padding: 12,
            color: "#0f172a",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Upgrade to manage your rentals</div>
          <div style={{ fontSize: "0.9rem", color: "#475569", marginBottom: 10 }}>
            RentChain Screening is free. Rental management starts on Starter.
          </div>
          <button
            type="button"
            onClick={() =>
              openUpgrade({
                reason: "screening",
                plan: "Screening",
                copy: {
                  title: "Upgrade to manage your rentals",
                  body: "RentChain Screening is free. Rental management starts on Starter.",
                },
                ctaLabel: "Upgrade to Starter",
              })
            }
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid rgba(59,130,246,0.45)",
              background: "rgba(59,130,246,0.12)",
              color: "#2563eb",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Upgrade to Starter
          </button>
        </div>
      ) : (
        <>
          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.2)",
              overflow: "hidden",
            }}
          >
            <div className="rc-units-table-wrap" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <table
                className="rc-units-table"
                style={{
                  width: "100%",
                  minWidth: 720,
                  borderCollapse: "collapse",
                  fontSize: "0.9rem",
                  color: "#0f172a",
                }}
              >
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)", color: "#9ca3af" }}>
                <th style={{ textAlign: "left", padding: "10px 12px", whiteSpace: "nowrap" }}>Unit #</th>
                <th style={{ textAlign: "right", padding: "10px 12px", whiteSpace: "nowrap" }}>Rent</th>
                <th style={{ textAlign: "center", padding: "10px 12px", whiteSpace: "nowrap" }}>Beds</th>
                <th style={{ textAlign: "center", padding: "10px 12px", whiteSpace: "nowrap" }}>Baths</th>
                <th style={{ textAlign: "center", padding: "10px 12px", whiteSpace: "nowrap" }}>Sqft</th>
                <th style={{ textAlign: "left", padding: "10px 12px", whiteSpace: "nowrap" }}>Status</th>
                <th style={{ textAlign: "left", padding: "10px 12px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                if (unitsLoading) {
                  return (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          padding: "12px",
                          color: "#1f2937",
                          textAlign: "center",
                        }}
                      >
                        Loading units...
                      </td>
                    </tr>
                  );
                }

                if (displayedUnits.length === 0) {
                  return (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          padding: "12px",
                          color: "#1f2937",
                          textAlign: "center",
                        }}
                      >
                        No units recorded for this property yet.
                      </td>
                    </tr>
                  );
                }

                return displayedUnits.map((u, idx) => {
                  const unitNum = (u as any).unitNumber || "--";
                  const bedsVal =
                    (u as any).beds ?? (u as any).bedrooms ?? (u as any).bedroomsCount ?? null;
                  const bathsVal =
                    (u as any).baths ?? (u as any).bathrooms ?? (u as any).bathroomsCount ?? null;
                  const rentVal =
                    (u as any).rent ??
                    (u as any).marketRent ??
                    (u as any).askingRent ??
                    (u as any).monthlyRent ??
                    null;
                  const sqftVal = (u as any).sqft ?? null;
                  const statusVal = (u as any).status || (leasedUnitNumbers.has(unitNum) ? "occupied" : "vacant");
                  const isLeased = String(statusVal || "").toLowerCase() === "occupied";
                  const rentDisplay =
                    rentVal !== null && rentVal !== undefined
                      ? formatCurrency(Number(rentVal) || 0)
                      : "--";
                  const bedsDisplay =
                    (u as any).bedrooms ?? (u as any).bedrooms === 0
                      ? (u as any).bedrooms
                      : "-";
                  const bathsDisplay =
                    (u as any).bathrooms ?? (u as any).bathrooms === 0
                      ? (u as any).bathrooms
                      : "-";
                  const sqftDisplay =
                    sqftVal ?? sqftVal === 0
                      ? sqftVal
                      : "-";
                  return (
                    <tr
                      key={(u as any).id ?? `${unitNum}-${idx}`}
                      style={{
                        borderTop: "1px solid rgba(148,163,184,0.12)",
                        color: "#e5e7eb",
                      }}
                    >
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{unitNum}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <span className={rentVal !== null && rentVal !== undefined ? "" : "rc-unit-placeholder"}>
                          {rentDisplay}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                        <span className={bedsVal !== null && bedsVal !== undefined ? "" : "rc-unit-placeholder"}>
                          {bedsDisplay}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                        <span className={bathsVal !== null && bathsVal !== undefined ? "" : "rc-unit-placeholder"}>
                          {bathsDisplay}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                        <span className={sqftVal !== null && sqftVal !== undefined ? "" : "rc-unit-placeholder"}>
                          {sqftDisplay}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 10px",
                            borderRadius: 999,
                            border: "1px solid rgba(148,163,184,0.35)",
                            background: isLeased
                              ? "rgba(34,197,94,0.1)"
                              : "rgba(248,113,113,0.08)",
                            color: isLeased ? "#166534" : "#f87171",
                            fontSize: "0.8rem",
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "999px",
                              backgroundColor: isLeased ? "#22c55e" : "#f87171",
                            }}
                          />
                          {isLeased ? "Occupied" : "Vacant"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => setEditingUnit(u)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid #e5e7eb",
                              background: "#fff",
                              cursor: "pointer",
                              fontSize: "0.85rem",
                            }}
                          >
                            Edit
                          </button>
                          {(u as any)?.id ? (
                            <button
                              type="button"
                            onClick={() => handleSendApplication(u)}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 8,
                                border: "1px solid #e5e7eb",
                                background: "#fff",
                                cursor: "pointer",
                                fontSize: "0.85rem",
                              }}
                            >
                              Send application
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rc-units-stack">
        {unitsLoading ? (
          <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>Loading units...</div>
        ) : displayedUnits.length === 0 ? (
          <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>
            No units recorded for this property yet.
          </div>
        ) : (
          displayedUnits.map((u, idx) => {
            const unitNum = (u as any).unitNumber || "--";
            const bedsVal =
              (u as any).beds ?? (u as any).bedrooms ?? (u as any).bedroomsCount ?? null;
            const bathsVal =
              (u as any).baths ?? (u as any).bathrooms ?? (u as any).bathroomsCount ?? null;
            const rentVal =
              (u as any).rent ??
              (u as any).marketRent ??
              (u as any).askingRent ??
              (u as any).monthlyRent ??
              null;
            const sqftVal = (u as any).sqft ?? null;
            const statusVal = (u as any).status || (leasedUnitNumbers.has(unitNum) ? "occupied" : "vacant");
            const isLeased = String(statusVal || "").toLowerCase() === "occupied";
            const rentDisplay =
              rentVal !== null && rentVal !== undefined
                ? formatCurrency(Number(rentVal) || 0)
                : "--";
            const bedsDisplay =
              (u as any).bedrooms ?? (u as any).bedrooms === 0
                ? (u as any).bedrooms
                : "-";
            const bathsDisplay =
              (u as any).bathrooms ?? (u as any).bathrooms === 0
                ? (u as any).bathrooms
                : "-";
            const sqftDisplay =
              sqftVal ?? sqftVal === 0
                ? sqftVal
                : "-";
            return (
              <div key={(u as any).id ?? `${unitNum}-${idx}`} className="rc-unit-card">
                <div className="rc-unit-card-row">
                  <div>
                    <div className="rc-unit-label">Unit #</div>
                    <div className="rc-unit-value">{unitNum}</div>
                  </div>
                  <div>
                    <div className="rc-unit-label">Status</div>
                    <div className="rc-unit-value">{isLeased ? "Occupied" : "Vacant"}</div>
                  </div>
                </div>
                <div className="rc-unit-card-row rc-unit-card-specs" style={{ marginTop: 8 }}>
                  <div>
                    <div className="rc-unit-label">Rent</div>
                    <div className={`rc-unit-value ${rentVal !== null && rentVal !== undefined ? "" : "rc-unit-placeholder"}`}>
                      {rentDisplay}
                    </div>
                  </div>
                  <div>
                    <div className="rc-unit-label">Beds</div>
                    <div className={`rc-unit-value ${bedsVal !== null && bedsVal !== undefined ? "" : "rc-unit-placeholder"}`}>
                      {bedsDisplay}
                    </div>
                  </div>
                  <div>
                    <div className="rc-unit-label">Baths</div>
                    <div className={`rc-unit-value ${bathsVal !== null && bathsVal !== undefined ? "" : "rc-unit-placeholder"}`}>
                      {bathsDisplay}
                    </div>
                  </div>
                  <div>
                    <div className="rc-unit-label">Sqft</div>
                    <div className={`rc-unit-value ${sqftVal !== null && sqftVal !== undefined ? "" : "rc-unit-placeholder"}`}>
                      {sqftDisplay}
                    </div>
                  </div>
                </div>
                <div className="rc-unit-actions">
                  <button
                    type="button"
                    onClick={() => setEditingUnit(u)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      background: "#fff",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    Edit
                  </button>
                  {(u as any)?.id ? (
                    <button
                      type="button"
                    onClick={() => handleSendApplication(u)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                      }}
                    >
                      Send application
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
        </>
      )}
      </div>
      <UnitEditModal
        open={!!editingUnit}
        unit={editingUnit}
        onClose={() => setEditingUnit(null)}
        onSaved={(updated) => {
          setUnits((prev) => prev.map((u) => (u?.id === updated?.id ? { ...u, ...updated } : u)));
        }}
      />
      <SendApplicationModal
        open={!!sendAppUnit}
        propertyId={property?.id || null}
        unit={sendAppUnit}
        onClose={() => setSendAppUnit(null)}
      />
      <UnitsCsvPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onConfirm={confirmImport}
        filename={pendingFilename}
        headers={previewHeaders}
        rows={previewRows}
        isImporting={isImporting}
      />
    </>
  );
};



