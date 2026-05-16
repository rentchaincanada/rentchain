import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MacShell } from "../../components/layout/MacShell";
import { Button, Card, Pill, Section } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import { exportAdminTenantsCsv, fetchAdminTenants, type AdminTenantView } from "../../api/adminApi";
import { AdminSavedFilters } from "../../components/admin/AdminSavedFilters";

function readFilters(search: string) {
  const params = new URLSearchParams(search);
  return {
    q: params.get("q") || "",
    leaseStatus: params.get("leaseStatus") || "",
    screeningStatus: params.get("screeningStatus") || "",
    moveInStatus: params.get("moveInStatus") || "",
    sortBy: (params.get("sortBy") || "updatedAt") as "createdAt" | "updatedAt" | "fullName",
    sortDir: (params.get("sortDir") || "desc") as "asc" | "desc",
    page: Math.max(1, Number(params.get("page") || 1)),
    pageSize: Math.min(100, Math.max(1, Number(params.get("pageSize") || 25))),
  };
}

function formatStatus(value: string | null) {
  return value ? value.replace(/_/g, " ") : "None";
}

function StatusPill({ value, tone = "default" }: { value: string | null; tone?: "default" | "accent" | "danger" }) {
  return <Pill tone={tone}>{formatStatus(value)}</Pill>;
}

function lifecycleLabel(item: AdminTenantView | null) {
  return item?.lifecycle?.lifecycleLabel || "Unknown";
}

export const AdminTenantsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const filters = useMemo(() => readFilters(location.search), [location.search]);
  const [data, setData] = useState<{
    items: AdminTenantView[];
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<AdminTenantView | null>(null);

  const currentPresetFilters = useMemo(() => {
    const out: Record<string, string | number | boolean | null> = {};
    if (filters.q) out.q = filters.q;
    if (filters.leaseStatus) out.leaseStatus = filters.leaseStatus;
    if (filters.screeningStatus) out.screeningStatus = filters.screeningStatus;
    if (filters.moveInStatus) out.moveInStatus = filters.moveInStatus;
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
        const result = await fetchAdminTenants(filters);
        if (!active) return;
        setData(result);
      } catch (err: any) {
        if (!active) return;
        setData(null);
        setError(err?.message || "Failed to load admin tenants");
        showToast({
          message: "Failed to load admin tenants",
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
    filters.leaseStatus,
    filters.screeningStatus,
    filters.moveInStatus,
    filters.sortBy,
    filters.sortDir,
    filters.page,
    filters.pageSize,
    showToast,
  ]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const { blob, filename } = await exportAdminTenantsCsv(filters);
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
        message: "Failed to export tenants CSV",
        description: err?.message || "",
        variant: "error",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <MacShell title="Admin · Tenants">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Tenants</h1>
                <Pill tone="accent">Admin</Pill>
              </div>
              <div style={{ color: "#475569", maxWidth: 760 }}>
                Review platform-wide tenant records through the dedicated admin API with safe view shaping, filters, and pagination.
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
              aria-label="Search tenants"
              placeholder="Search tenant, email, phone, property, or unit"
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
              value={filters.leaseStatus}
              onChange={(e) => updateFilters({ leaseStatus: e.target.value })}
              style={{ minHeight: 42, borderRadius: 10, border: "1px solid rgb(203, 213, 225)", padding: "10px 12px" }}
            >
              <option value="">All lease statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="inactive">Inactive</option>
              <option value="current">Current</option>
            </select>
            <select
              aria-label="Filter by screening status"
              value={filters.screeningStatus}
              onChange={(e) => updateFilters({ screeningStatus: e.target.value })}
              style={{ minHeight: 42, borderRadius: 10, border: "1px solid rgb(203, 213, 225)", padding: "10px 12px" }}
            >
              <option value="">All screening states</option>
              <option value="complete">Complete</option>
              <option value="processing">Processing</option>
              <option value="requested">Requested</option>
              <option value="failed">Failed</option>
            </select>
            <select
              aria-label="Filter by move-in status"
              value={filters.moveInStatus}
              onChange={(e) => updateFilters({ moveInStatus: e.target.value })}
              style={{ minHeight: 42, borderRadius: 10, border: "1px solid rgb(203, 213, 225)", padding: "10px 12px" }}
            >
              <option value="">All move-in states</option>
              <option value="ready">Ready</option>
              <option value="pending">Pending</option>
              <option value="complete">Complete</option>
            </select>
            <select
              aria-label="Sort tenants"
              value={filters.sortBy}
              onChange={(e) => updateFilters({ sortBy: e.target.value as any })}
              style={{ minHeight: 42, borderRadius: 10, border: "1px solid rgb(203, 213, 225)", padding: "10px 12px" }}
            >
              <option value="updatedAt">Updated</option>
              <option value="createdAt">Created</option>
              <option value="fullName">Name</option>
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

        <AdminSavedFilters pageKey="tenants" currentFilters={currentPresetFilters} onApplyPreset={applyPreset} />

        <Card style={{ display: "grid", gap: 12 }}>
          {loading ? <div>Loading tenants…</div> : null}
          {!loading && error ? <div style={{ color: "#b91c1c" }}>Failed to load tenants: {error}</div> : null}
          {!loading && !error && !data?.items?.length ? (
            <div style={{ color: "#475569" }}>No tenants match the current admin filters.</div>
          ) : null}
          {!loading && data?.items?.length ? (
            <>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                      {["Tenant", "Email", "Phone", "Property / Unit", "Landlord", "Lifecycle", "Lease Status", "Screening", "Move-In", "Updated"].map((label) => (
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
                        onClick={() => setSelectedTenant(item)}
                        style={{ cursor: "pointer", borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}
                      >
                        <td style={{ padding: "12px" }}>
                          <div style={{ fontWeight: 600 }}>{item.fullName || "Unnamed tenant"}</div>
                          <div style={{ color: "#64748b", fontSize: 13 }}>{item.id}</div>
                        </td>
                        <td style={{ padding: "12px" }}>{item.email || "—"}</td>
                        <td style={{ padding: "12px" }}>{item.phone || "—"}</td>
                        <td style={{ padding: "12px" }}>
                          <div>{item.propertyName || "Unknown property"}</div>
                          <div style={{ color: "#64748b", fontSize: 13 }}>{item.unitNumber ? `Unit ${item.unitNumber}` : "No unit"}</div>
                        </td>
                        <td style={{ padding: "12px" }}>{item.landlordId || "—"}</td>
                        <td style={{ padding: "12px" }}>
                          <StatusPill value={lifecycleLabel(item)} tone={item.lifecycle?.flags?.hasStateConflict ? "danger" : "accent"} />
                        </td>
                        <td style={{ padding: "12px" }}>
                          <StatusPill value={item.leaseStatus} />
                        </td>
                        <td style={{ padding: "12px" }}>
                          <StatusPill value={item.screeningStatus} tone={item.flags.hasScreening ? "accent" : "default"} />
                        </td>
                        <td style={{ padding: "12px" }}>
                          <StatusPill value={item.moveInStatus} />
                        </td>
                        <td style={{ padding: "12px" }}>{String(item.updatedAt || "—")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ color: "#475569", fontSize: 14 }}>
                  Page {data.page} · {data.total} total tenants
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

      {selectedTenant ? (
        <div
          role="dialog"
          aria-label="Tenant detail drawer"
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
              <div style={{ fontWeight: 700, fontSize: 18 }}>{selectedTenant.fullName || "Unnamed tenant"}</div>
              <div style={{ color: "#64748b", fontSize: 14 }}>{selectedTenant.id}</div>
            </div>
            <Button variant="secondary" onClick={() => setSelectedTenant(null)}>
              Close
            </Button>
          </div>

          <Card style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 600 }}>Identity</div>
            <div>{selectedTenant.email || "No email"}</div>
            <div>{selectedTenant.phone || "No phone"}</div>
          </Card>

          <Card style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 600 }}>Current Placement</div>
            <div>{selectedTenant.propertyName || "Unknown property"}</div>
            <div>{selectedTenant.propertyId || "No property id"}</div>
            <div>{selectedTenant.unitNumber ? `Unit ${selectedTenant.unitNumber}` : "No unit number"}</div>
            <div>{selectedTenant.unitId || "No unit id"}</div>
            <div>{selectedTenant.landlordId || "No landlord id"}</div>
          </Card>

          <Card style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 600 }}>Lease Summary</div>
            <div>{selectedTenant.leaseId || "No lease id"}</div>
            <div>{formatStatus(selectedTenant.leaseStatus)}</div>
            <div>{selectedTenant.currentLeaseStartDate || "No start date"}</div>
            <div>{selectedTenant.currentLeaseEndDate || "No end date"}</div>
          </Card>

          <Card style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 600 }}>Status</div>
            <div>
              <StatusPill
                value={lifecycleLabel(selectedTenant)}
                tone={selectedTenant.lifecycle?.flags?.hasStateConflict ? "danger" : "accent"}
              />
            </div>
            <div>
              <StatusPill value={selectedTenant.screeningStatus} tone={selectedTenant.flags.hasScreening ? "accent" : "default"} />
            </div>
            <div>
              <StatusPill value={selectedTenant.moveInStatus} />
            </div>
            <div style={{ display: "grid", gap: 6, color: "#475569" }}>
              <div>Missing lease link: {selectedTenant.flags.missingLeaseLink ? "Yes" : "No"}</div>
              <div>Missing property link: {selectedTenant.flags.missingPropertyLink ? "Yes" : "No"}</div>
            </div>
          </Card>
        </div>
      ) : null}
    </MacShell>
  );
};

export default AdminTenantsPage;
