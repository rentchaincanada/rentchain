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
import { text } from "../../styles/tokens";
import { safeLocaleNumber } from "@/utils/format";

interface PropertyDetailPanelProps {
  property: Property | null;
  onRefresh?: () => Promise<void> | void;
}

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
        await setOnboardingStep("addUnits", true);
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
        showToast({
          message: "Import unsuccessful",
          description: data?.message || "Plan limit reached. Please try again later.",
          variant: "error",
        });
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
  }, [property?.id, property?.units]);

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

  const occupancyText = unitCount === 0 ? "--" : `${occupancy.toFixed(0)}%`;
  const collectionText = leaseRentRoll === 0 ? "--" : `${(collectionRate * 100).toFixed(0)}%`;

  const displayName = property?.name || property?.addressLine1 || "Property";
  const showEmpty = !property;
  const showLoading = !!property && (isLeasesLoading || isPaymentsLoading);
  const showLeasesError = !!leasesError;
  const showPaymentsError = !!paymentsError;

  if (showEmpty) {
    return (
      <div style={{ color: text.muted, fontSize: "0.9rem" }}>
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
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: text.primary }}>
              {displayName}
            </div>
            <div style={{ color: text.secondary, fontSize: "0.9rem" }}>
              {property.addressLine1}
              {property.addressLine2 ? `, ${property.addressLine2}` : ""}
            </div>
            <div style={{ color: text.muted, fontSize: "0.85rem" }}>
              {[property.city, property.province, property.postalCode]
                .filter(Boolean)
                .join(", ")}
            </div>
            <div style={{ color: text.muted, fontSize: "0.8rem" }}>
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
                color: text.muted,
                cursor: "not-allowed",
              }}
            >
              Edit
            </button>
            <button
              type="button"
              title="Use Upload CSV to add units"
              onClick={() => {
                // No manual modal exists; direct to CSV flow (open file picker)
                setImportMessage(null);
                fileInputRef.current?.click();
              }}
              onMouseEnter={(e) => {
                if (e.currentTarget.disabled) return;
                e.currentTarget.style.background = "rgba(15,23,42,0.06)";
              }}
              onMouseLeave={(e) => {
                if (e.currentTarget.disabled) return;
                e.currentTarget.style.background = "#fff";
              }}
              disabled={!property}
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.12)",
                background: "#fff",
                color: text.primary,
                cursor: "pointer",
                transition: "background 150ms ease",
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
              onMouseEnter={(e) => {
                if (e.currentTarget.disabled) return;
                e.currentTarget.style.background = "rgba(15,23,42,0.06)";
              }}
              onMouseLeave={(e) => {
                if (e.currentTarget.disabled) return;
                e.currentTarget.style.background = "#fff";
              }}
              disabled={isImporting || !property}
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.12)",
                background: "#fff",
                color: text.primary,
                cursor: "pointer",
                transition: "background 150ms ease",
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
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(15,23,42,0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#fff";
              }}
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.12)",
                background: "#fff",
                color: text.primary,
                cursor: "pointer",
                transition: "background 150ms ease",
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
          </div>
        </div>
        {showLoading && (
          <div style={{ color: text.subtle, fontSize: "0.85rem" }}>
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
          <div style={{ color: text.subtle, fontSize: "0.8rem" }}>Total units</div>
          <div style={{ color: text.primary, fontWeight: 700, fontSize: "1.1rem" }}>
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
          <div style={{ color: text.subtle, fontSize: "0.8rem" }}>Leased units</div>
          <div style={{ color: text.primary, fontWeight: 700, fontSize: "1.1rem" }}>
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
          <div style={{ color: text.subtle, fontSize: "0.8rem" }}>Occupancy</div>
          <div style={{ color: text.primary, fontWeight: 700, fontSize: "1.05rem" }}>
            {unitCount === 0 ? <span style={{ color: text.subtle }}>{occupancyText}</span> : occupancyText}
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
          <div style={{ color: text.subtle, fontSize: "0.8rem" }}>Lease rent roll</div>
          <div style={{ color: text.primary, fontWeight: 700, fontSize: "1.05rem" }}>
            {formatCurrency(leaseRentRoll)}
          </div>
          <div style={{ color: text.subtle, fontSize: "0.75rem", marginTop: 2 }}>
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
          <div style={{ color: text.subtle, fontSize: "0.8rem" }}>Collected this month</div>
          <div style={{ color: text.primary, fontWeight: 700, fontSize: "1.05rem" }}>
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
          <div style={{ color: text.subtle, fontSize: "0.8rem" }}>Collection</div>
          <div style={{ color: text.primary, fontWeight: 700, fontSize: "1.05rem" }}>
            {leaseRentRoll === 0 ? <span style={{ color: text.subtle }}>{collectionText}</span> : collectionText}
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
            color: text.primary,
            fontSize: "0.9rem",
          }}
        >
          {importMessage}
        </div>
      )}

      {activeLeases.length === 0 && (
        <div style={{ color: text.subtle, fontSize: "0.85rem" }}>
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
            color: text.primary,
          }}
        >
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.03)", color: text.secondary }}>
              <th style={{ textAlign: "left", padding: "10px 12px" }}>Unit #</th>
              <th style={{ textAlign: "left", padding: "10px 12px" }}>Rent</th>
              <th style={{ textAlign: "left", padding: "10px 12px" }}>Beds</th>
              <th style={{ textAlign: "left", padding: "10px 12px" }}>Baths</th>
              <th style={{ textAlign: "left", padding: "10px 12px" }}>Sqft</th>
              <th style={{ textAlign: "left", padding: "10px 12px" }}>Status</th>
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
                    color: text.subtle,
                    textAlign: "center",
                  }}
                >
                  Loading units...
                </td>
              </tr>
                );
              }

              const derivedUnits =
                units.length === 0 && unitCount > 0
                  ? Array.from({ length: unitCount }, (_, i) => ({
                      id: `placeholder-${i}`,
                      unitNumber: String(i + 1),
                    }))
                  : [];
              const displayedUnits = units.length > 0 ? units : derivedUnits;

              if (displayedUnits.length === 0) {
                return (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: "12px",
                    color: text.subtle,
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
                  (u as any).bedrooms ?? (u as any).beds ?? (u as any).bedroomsCount ?? null;
                const bathsVal =
                  (u as any).bathrooms ?? (u as any).baths ?? (u as any).bathroomsCount ?? null;
                const sqftVal =
                  (u as any).sqft ?? (u as any).squareFeet ?? (u as any).sqFeet ?? null;
                const rentVal =
                  (u as any).rent ??
                  (u as any).marketRent ??
                  (u as any).askingRent ??
                  (u as any).monthlyRent ??
                  null;
                const statusVal = (u as any).status || (leasedUnitNumbers.has(unitNum) ? "occupied" : "vacant");
                const isLeased = String(statusVal || "").toLowerCase() === "occupied";
                return (
                  <tr
                    key={(u as any).id ?? `${unitNum}-${idx}`}
                    style={{
                      borderTop: "1px solid rgba(148,163,184,0.12)",
                      color: text.primary,
                    }}
                  >
                    <td style={{ padding: "10px 12px" }}>
                      {unitNum === "--" ? <span style={{ color: text.subtle }}>{unitNum}</span> : unitNum}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {rentVal !== null && rentVal !== undefined ? (
                        formatCurrency(Number(rentVal) || 0)
                      ) : (
                        <span style={{ color: text.subtle }}>--</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {bedsVal ?? bedsVal === 0 ? (
                        bedsVal
                      ) : (
                        <span style={{ color: text.subtle }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {bathsVal ?? bathsVal === 0 ? (
                        bathsVal
                      ) : (
                        <span style={{ color: text.subtle }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {sqftVal ?? sqftVal === 0 ? (
                        sqftVal
                      ) : (
                        <span style={{ color: text.subtle }}>-</span>
                      )}
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
                      <button
                        type="button"
                        onClick={() => setEditingUnit(u)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(15,23,42,0.06)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "#fff";
                        }}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #e5e7eb",
                          background: "#fff",
                          color: text.primary,
                          cursor: "pointer",
                          fontSize: "0.85rem",
                          transition: "background 150ms ease",
                        }}
                      >
                        Edit
                      </button>
                      {(u as any)?.id ? (
                        <button
                          type="button"
                          onClick={() => setSendAppUnit(u)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(15,23,42,0.06)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#fff";
                          }}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 8,
                            border: "1px solid #e5e7eb",
                            background: "#fff",
                            color: text.primary,
                            cursor: "pointer",
                            fontSize: "0.85rem",
                            marginLeft: 8,
                            transition: "background 150ms ease",
                          }}
                        >
                          Send application
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
      </div>
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



