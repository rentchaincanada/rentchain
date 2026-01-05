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
} from "../../api/paymentsApi";
import { importUnitsCsv } from "../../api/unitsImportApi";
import { fetchMe } from "../../api/meApi";
import { useUpgrade } from "../../context/UpgradeContext";
import { buildUnitsCsvTemplate, downloadTextFile } from "../../utils/csvTemplates";
import { UnitsCsvPreviewModal } from "./UnitsCsvPreviewModal";
import { parseCsvPreview } from "../../utils/csvPreview";
import { useToast } from "../ui/ToastProvider";
import { setOnboardingStep } from "../../api/onboardingApi";
import { PLANS } from "../../config/plans";

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
  const { openUpgrade } = useUpgrade();
  const { showToast } = useToast();
  const [leases, setLeases] = useState<Lease[]>([]);
  const [isLeasesLoading, setIsLeasesLoading] = useState(false);
  const [leasesError, setLeasesError] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [totalCollectedThisMonth, setTotalCollectedThisMonth] = useState(0);
  const [isPaymentsLoading, setIsPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [me, setMe] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingFilename, setPendingFilename] = useState<string>("");

  const readFileText = useCallback((file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  }, []);

  const confirmImport = useCallback(async () => {
    if (!pendingFile || !property?.id) return;
    try {
      setIsImporting(true);
      const csvText = await readFileText(pendingFile);
      const result = await importUnitsCsv(property.id, csvText);

      const created = result?.createdCount ?? result?.created ?? 0;
      const updated = result?.updatedCount ?? result?.updated ?? 0;
      const skipped = result?.skippedCount ?? result?.skipped ?? 0;
      const errCount = Array.isArray(result?.errors) ? result.errors.length : 0;

      showToast({
        message: "CSV import complete",
        description: `Created ${created}, updated ${updated}, skipped ${skipped}${
          errCount ? ` • ${errCount} error(s)` : ""
        }`,
        variant: errCount ? "warning" : "success",
      });

      setPreviewOpen(false);
      setPendingFile(null);
      setPendingFilename("");
      setImportMessage(
        result?.message ||
          `Created ${created}, updated ${updated}, skipped ${skipped}${
            errCount ? ` • ${errCount} error(s)` : ""
          }`
      );

      if (onRefresh) {
        await onRefresh();
      }

      try {
        await setOnboardingStep("addUnits", true);
      } catch {
        // ignore onboarding errors
      }

      showToast({
        message: "Portfolio ready — dashboard is live.",
        variant: "success",
      });

      navigate("/dashboard?onboarding=ready", { replace: true });
    } catch (e: any) {
      showToast({
        message: "CSV import failed",
        description: e?.message ?? "Import failed",
        variant: "error",
      });
    } finally {
      setIsImporting(false);
    }
  }, [navigate, onRefresh, pendingFile, property?.id, readFileText, showToast]);
  const setLeasesLoadingStates = (loading: boolean, error: string | null) => {
    setIsLeasesLoading(loading);
    setLeasesError(error);
  };

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

  useEffect(() => {
    fetchMe()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

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

  const units = property?.units || [];
  const unitCount =
    units.length > 0
      ? units.length
      : (property as any)?.unitCount ?? 0;
  const plan = me?.plan ?? "starter";
  const maxUnits = PLANS.starter.maxUnits;
  const canImport = unitCount < maxUnits;
  const totalRentConfigured = units.reduce(
    (sum, u) =>
      sum + (typeof (u as any).rent === "number" ? (u as any).rent : 0),
    0
  );

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
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0f172a" }}>
              {displayName}
            </div>
            <div style={{ color: "#1f2937", fontSize: "0.9rem" }}>
              {property.addressLine1}
              {property.addressLine2 ? `, ${property.addressLine2}` : ""}
            </div>
            <div style={{ color: "#475569", fontSize: "0.85rem" }}>
              {[property.city, property.province, property.postalCode]
                .filter(Boolean)
                .join(", ")}
            </div>
            <div style={{ color: "#6b7280", fontSize: "0.8rem" }}>
              Added {formatDate(property.createdAt)}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              title="Edit property (coming soon)"
              disabled
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
            <button
              type="button"
              title={canImport ? "Add units (coming soon)" : "Upgrade to add units"}
              disabled
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.12)",
                background: "rgba(0,0,0,0.02)",
                color: "#6b7280",
                cursor: "not-allowed",
              }}
            >
              Add units
            </button>
            <button
              type="button"
              title={
                canImport
                  ? "Upload CSV"
                  : `Plan limit reached (${maxUnits} units). Upgrade to import.`
              }
              onClick={() => {
                if (!canImport) {
                  openUpgrade("unitsMax");
                  return;
                }
                setImportMessage(null);
                fileInputRef.current?.click();
              }}
              disabled={isImporting || !property}
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.12)",
                background: canImport ? "#0ea5e9" : "rgba(0,0,0,0.02)",
                color: canImport ? "#fff" : "#6b7280",
                cursor: canImport ? "pointer" : "not-allowed",
              }}
            >
              {isImporting ? "Importing…" : "Upload CSV"}
            </button>
            <button
              type="button"
              title="Download a CSV template for units import"
              onClick={() => {
                const csv = buildUnitsCsvTemplate();
                downloadTextFile("rentchain-units-template.csv", csv);
              }}
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
                if (!canImport) {
                  openUpgrade("unitsMax");
                  return;
                }
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
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(148,163,184,0.15)",
          }}
        >
          <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>Total units</div>
          <div style={{ color: "#e5e7eb", fontWeight: 700, fontSize: "1.1rem" }}>
            {unitCount}
          </div>
        </div>
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(148,163,184,0.15)",
          }}
        >
          <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>Leased units</div>
          <div style={{ color: "#e5e7eb", fontWeight: 700, fontSize: "1.1rem" }}>
            {leasedUnits}
          </div>
        </div>
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(148,163,184,0.15)",
          }}
        >
          <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>Occupancy</div>
          <div style={{ color: "#e5e7eb", fontWeight: 700, fontSize: "1.05rem" }}>
            {unitCount === 0 ? "—" : `${occupancy.toFixed(0)}%`}
          </div>
        </div>
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(148,163,184,0.15)",
          }}
        >
          <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>Lease rent roll</div>
          <div style={{ color: "#e5e7eb", fontWeight: 700, fontSize: "1.05rem" }}>
            {formatCurrency(leaseRentRoll)}
          </div>
          <div style={{ color: "#6b7280", fontSize: "0.75rem", marginTop: 2 }}>
            Configured rent roll: {formatCurrency(totalRentConfigured)}
          </div>
        </div>

        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(148,163,184,0.15)",
          }}
        >
          <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>Collected this month</div>
          <div style={{ color: "#e5e7eb", fontWeight: 700, fontSize: "1.05rem" }}>
            {formatCurrency(totalCollectedThisMonth)}
          </div>
        </div>

        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(148,163,184,0.15)",
          }}
        >
          <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>Collection</div>
          <div style={{ color: "#e5e7eb", fontWeight: 700, fontSize: "1.05rem" }}>
            {leaseRentRoll === 0 ? "—" : `${(collectionRate * 100).toFixed(0)}%`}
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
      <div
        style={{
          borderRadius: 12,
          border: "1px solid rgba(148,163,184,0.2)",
          overflow: "hidden",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.9rem",
            color: "#0f172a",
          }}
        >
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.03)", color: "#9ca3af" }}>
              <th style={{ textAlign: "left", padding: "10px 12px" }}>Unit #</th>
              <th style={{ textAlign: "left", padding: "10px 12px" }}>Rent</th>
              <th style={{ textAlign: "left", padding: "10px 12px" }}>Beds</th>
              <th style={{ textAlign: "left", padding: "10px 12px" }}>Baths</th>
              <th style={{ textAlign: "left", padding: "10px 12px" }}>Sqft</th>
              <th style={{ textAlign: "left", padding: "10px 12px" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {units.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    padding: "12px",
                    color: "#1f2937",
                    textAlign: "center",
                  }}
                >
                  No units recorded for this property yet.
                </td>
              </tr>
            ) : (
              units.map((u, idx) => {
                const unitNum = (u as any).unitNumber || "—";
                const isLeased = leasedUnitNumbers.has(unitNum);
                return (
                  <tr
                    key={(u as any).id ?? `${unitNum}-${idx}`}
                    style={{
                      borderTop: "1px solid rgba(148,163,184,0.12)",
                      color: "#e5e7eb",
                    }}
                  >
                    <td style={{ padding: "10px 12px" }}>{unitNum}</td>
                    <td style={{ padding: "10px 12px" }}>
                      {formatCurrency(Number((u as any).rent) || 0)}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {(u as any).bedrooms ?? (u as any).bedrooms === 0
                        ? (u as any).bedrooms
                        : "—"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {(u as any).bathrooms ?? (u as any).bathrooms === 0
                        ? (u as any).bathrooms
                        : "—"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {(u as any).sqft ?? (u as any).sqft === 0
                        ? (u as any).sqft
                        : "—"}
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
                            ? "rgba(34,197,94,0.12)"
                            : "rgba(248,113,113,0.08)",
                          color: isLeased ? "#22c55e" : "#f87171",
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
                        {isLeased ? "Leased" : "Vacant"}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      </div>
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
