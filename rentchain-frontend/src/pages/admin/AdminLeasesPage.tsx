import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MacShell } from "../../components/layout/MacShell";
import { Button, Card, Pill, Section } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import { exportAdminLeasesCsv, fetchAdminLeases, type AdminLeaseView } from "../../api/adminApi";
import { AdminSavedFilters } from "../../components/admin/AdminSavedFilters";

function readFilters(search: string) {
  const params = new URLSearchParams(search);
  return {
    q: params.get("q") || "",
    status: params.get("status") || "",
    riskGrade: params.get("riskGrade") || "",
    integrity: params.get("integrity") || "all",
    sortBy: (params.get("sortBy") || "updatedAt") as "createdAt" | "updatedAt" | "startDate" | "monthlyRent",
    sortDir: (params.get("sortDir") || "desc") as "asc" | "desc",
    page: Math.max(1, Number(params.get("page") || 1)),
    pageSize: Math.min(100, Math.max(1, Number(params.get("pageSize") || 25))),
  };
}

function formatValue(value: string | null) {
  return value ? value.replace(/_/g, " ") : "None";
}

function formatMoney(value: number | null) {
  return typeof value === "number" ? `$${value.toLocaleString()}` : "—";
}

function IntegrityPill({ lease }: { lease: AdminLeaseView }) {
  if (lease.integrity.duplicateAgreement) return <Pill tone="danger">Duplicate agreement</Pill>;
  if (lease.integrity.occupancyMismatch) return <Pill tone="accent">Occupancy mismatch</Pill>;
  return <Pill tone="default">Healthy</Pill>;
}

export const AdminLeasesPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const filters = useMemo(() => readFilters(location.search), [location.search]);
  const [data, setData] = useState<{
    items: AdminLeaseView[];
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLease, setSelectedLease] = useState<AdminLeaseView | null>(null);

  const currentPresetFilters = useMemo(() => {
    const out: Record<string, string | number | boolean | null> = {};
    if (filters.q) out.q = filters.q;
    if (filters.status) out.status = filters.status;
    if (filters.riskGrade) out.riskGrade = filters.riskGrade;
    if (filters.integrity !== "all") out.integrity = filters.integrity;
    if (filters.sortBy !== "updatedAt") out.sortBy = filters.sortBy;
    if (filters.sortDir !== "desc") out.sortDir = filters.sortDir;
    return out;
  }, [filters]);

  const updateFilters = (patch: Partial<typeof filters>) => {
    const next = new URLSearchParams(location.search);
    const merged = { ...filters, ...patch, page: patch.page ?? 1 };
    Object.entries(merged).forEach(([key, value]) => {
      if (
        value == null ||
        value === "" ||
        (key === "integrity" && value === "all") ||
        (key === "sortBy" && value === "updatedAt") ||
        (key === "sortDir" && value === "desc") ||
        (key === "page" && Number(value) === 1) ||
        (key === "pageSize" && Number(value) === 25)
      ) {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });
    navigate({ pathname: location.pathname, search: next.toString() }, { replace: false });
  };

  const resetFilters = () => navigate({ pathname: location.pathname, search: "" }, { replace: false });

  const applyPreset = (presetFilters: Record<string, string | number | boolean | null>) => {
    const next = new URLSearchParams();
    Object.entries(presetFilters).forEach(([key, value]) => {
      if (value == null || value === "") return;
      next.set(key, String(value));
    });
    navigate({ pathname: location.pathname, search: next.toString() }, { replace: false });
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchAdminLeases(filters);
        if (!active) return;
        setData(result);
      } catch (err: any) {
        if (!active) return;
        setData(null);
        setError(err?.message || "Failed to load admin leases");
        showToast({
          message: "Failed to load admin leases",
          description: err?.message || "",
          variant: "error",
        });
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [
    filters.q,
    filters.status,
    filters.riskGrade,
    filters.integrity,
    filters.sortBy,
    filters.sortDir,
    filters.page,
    filters.pageSize,
    showToast,
  ]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const { blob, filename } = await exportAdminLeasesCsv(filters);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      showToast({
        message: "Failed to export leases CSV",
        description: err?.message || "",
        variant: "error",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <MacShell title="Admin · Leases">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Leases</h1>
                <Pill tone="accent">Admin</Pill>
              </div>
              <div style={{ color: "#475569", maxWidth: 760 }}>
                Review platform-wide lease records through the dedicated admin API with safe view shaping, filters, pagination, and integrity signals.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="secondary" onClick={handleExport} disabled={loading || exporting}>
                {exporting ? "Exporting..." : "Export CSV"}
              </Button>
              <Button variant="secondary" onClick={() => window.location.reload()} disabled={loading}>
                Refresh
              </Button>
            </div>
          </div>
        </Section>

        <Card style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <input
              aria-label="Search leases"
              placeholder="Search lease, property, unit, tenant, or landlord"
              value={filters.q}
              onChange={(e) => updateFilters({ q: e.target.value })}
              style={{
                display: "block",
                width: "100%",
                boxSizing: "border-box",
                minHeight: 42,
                padding: "10px 12px",
                borderRadius: "0.7rem",
                border: "1px solid rgba(15, 23, 42, 0.08)",
                background: "#fff",
                color: "#0f172a",
              }}
            />
            <select
              aria-label="Filter by lease status"
              value={filters.status}
              onChange={(e) => updateFilters({ status: e.target.value })}
              style={{ minHeight: 42, borderRadius: 10, border: "1px solid rgb(203, 213, 225)", padding: "10px 12px" }}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="inactive">Inactive</option>
              <option value="current">Current</option>
            </select>
            <select
              aria-label="Filter by risk grade"
              value={filters.riskGrade}
              onChange={(e) => updateFilters({ riskGrade: e.target.value })}
              style={{ minHeight: 42, borderRadius: 10, border: "1px solid rgb(203, 213, 225)", padding: "10px 12px" }}
            >
              <option value="">All risk grades</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
              <option value="E">E</option>
              <option value="F">F</option>
            </select>
            <select
              aria-label="Filter by integrity"
              value={filters.integrity}
              onChange={(e) => updateFilters({ integrity: e.target.value as any })}
              style={{ minHeight: 42, borderRadius: 10, border: "1px solid rgb(203, 213, 225)", padding: "10px 12px" }}
            >
              <option value="all">All integrity states</option>
              <option value="issues">Issues only</option>
              <option value="duplicateAgreement">Duplicate agreements</option>
              <option value="occupancyMismatch">Occupancy mismatches</option>
            </select>
            <select
              aria-label="Sort leases"
              value={filters.sortBy}
              onChange={(e) => updateFilters({ sortBy: e.target.value as any })}
              style={{ minHeight: 42, borderRadius: 10, border: "1px solid rgb(203, 213, 225)", padding: "10px 12px" }}
            >
              <option value="updatedAt">Updated</option>
              <option value="createdAt">Created</option>
              <option value="startDate">Start date</option>
              <option value="monthlyRent">Monthly rent</option>
            </select>
            <select
              aria-label="Sort direction"
              value={filters.sortDir}
              onChange={(e) => updateFilters({ sortDir: e.target.value as any })}
              style={{ minHeight: 42, borderRadius: 10, border: "1px solid rgb(203, 213, 225)", padding: "10px 12px" }}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
            <select
              aria-label="Page size"
              value={String(filters.pageSize)}
              onChange={(e) => updateFilters({ pageSize: Number(e.target.value) })}
              style={{ minHeight: 42, borderRadius: 10, border: "1px solid rgb(203, 213, 225)", padding: "10px 12px" }}
            >
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
            </select>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={resetFilters}>
              Reset filters
            </Button>
          </div>
        </Card>

        <AdminSavedFilters pageKey="leases" currentFilters={currentPresetFilters} onApplyPreset={applyPreset} />

        <Card style={{ display: "grid", gap: 12 }}>
          {loading ? <div>Loading leases…</div> : null}
          {!loading && error ? <div style={{ color: "#b91c1c" }}>Failed to load leases: {error}</div> : null}
          {!loading && !error && !data?.items?.length ? (
            <div style={{ color: "#475569" }}>No leases match the current admin filters.</div>
          ) : null}
          {!loading && data?.items?.length ? (
            <>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                      {["Lease", "Property / Unit", "Tenant(s)", "Landlord", "Status", "Rent", "Start", "End", "Risk", "Integrity", "Updated"].map((label) => (
                        <th key={label} style={{ padding: "10px 12px", fontSize: 13, color: "#475569" }}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedLease(item)}
                        style={{ cursor: "pointer", borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}
                      >
                        <td style={{ padding: "12px" }}>
                          <div style={{ fontWeight: 600 }}>{item.id}</div>
                        </td>
                        <td style={{ padding: "12px" }}>
                          <div>{item.propertyName || "Unknown property"}</div>
                          <div style={{ color: "#64748b", fontSize: 13 }}>{item.unitNumber ? `Unit ${item.unitNumber}` : "No unit"}</div>
                        </td>
                        <td style={{ padding: "12px" }}>{item.tenantNames.length ? item.tenantNames.join(", ") : "—"}</td>
                        <td style={{ padding: "12px" }}>{item.landlordId || "—"}</td>
                        <td style={{ padding: "12px" }}>
                          <Pill tone="default">{formatValue(item.status)}</Pill>
                        </td>
                        <td style={{ padding: "12px" }}>{formatMoney(item.monthlyRent)}</td>
                        <td style={{ padding: "12px" }}>{item.startDate || "—"}</td>
                        <td style={{ padding: "12px" }}>{item.endDate || "—"}</td>
                        <td style={{ padding: "12px" }}>
                          <Pill tone="accent">{item.riskGrade || "—"}</Pill>
                        </td>
                        <td style={{ padding: "12px" }}>
                          <IntegrityPill lease={item} />
                        </td>
                        <td style={{ padding: "12px" }}>{String(item.updatedAt || "—")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ color: "#475569", fontSize: 14 }}>
                  Page {data.page} · {data.total} total leases
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button
                    variant="secondary"
                    onClick={() => updateFilters({ page: Math.max(1, filters.page - 1) })}
                    disabled={filters.page <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => updateFilters({ page: filters.page + 1 })}
                    disabled={!data.hasMore}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </Card>
      </div>

      {selectedLease ? (
        <div
          role="dialog"
          aria-label="Lease detail drawer"
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            width: "min(420px, 100vw)",
            height: "100vh",
            background: "#fff",
            borderLeft: "1px solid rgba(15, 23, 42, 0.08)",
            boxShadow: "-8px 0 24px rgba(15, 23, 42, 0.12)",
            padding: 20,
            overflowY: "auto",
            zIndex: 60,
            display: "grid",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{selectedLease.id}</div>
              <div style={{ color: "#64748b", fontSize: 14 }}>{selectedLease.propertyName || "Unknown property"}</div>
            </div>
            <Button variant="secondary" onClick={() => setSelectedLease(null)}>
              Close
            </Button>
          </div>

          <Card style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 600 }}>Lease Summary</div>
            <div>Status: {formatValue(selectedLease.status)}</div>
            <div>Monthly rent: {formatMoney(selectedLease.monthlyRent)}</div>
            <div>Risk grade: {selectedLease.riskGrade || "—"}</div>
          </Card>

          <Card style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 600 }}>Property / Unit</div>
            <div>{selectedLease.propertyName || "Unknown property"}</div>
            <div>{selectedLease.propertyId || "No property id"}</div>
            <div>{selectedLease.unitNumber ? `Unit ${selectedLease.unitNumber}` : "No unit number"}</div>
            <div>{selectedLease.unitId || "No unit id"}</div>
            <div>{selectedLease.landlordId || "No landlord id"}</div>
          </Card>

          <Card style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 600 }}>Tenant(s)</div>
            <div>{selectedLease.tenantNames.length ? selectedLease.tenantNames.join(", ") : "No linked tenants"}</div>
            <div>{selectedLease.tenantIds.length ? selectedLease.tenantIds.join(", ") : "No tenant ids"}</div>
          </Card>

          <Card style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 600 }}>Dates</div>
            <div>Start: {selectedLease.startDate || "—"}</div>
            <div>End: {selectedLease.endDate || "—"}</div>
          </Card>

          <Card style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 600 }}>Risk / Integrity</div>
            <div>
              <IntegrityPill lease={selectedLease} />
            </div>
            <div style={{ color: "#475569" }}>Duplicate agreement: {selectedLease.integrity.duplicateAgreement ? "Yes" : "No"}</div>
            <div style={{ color: "#475569" }}>Occupancy mismatch: {selectedLease.integrity.occupancyMismatch ? "Yes" : "No"}</div>
          </Card>
        </div>
      ) : null}
    </MacShell>
  );
};

export default AdminLeasesPage;
