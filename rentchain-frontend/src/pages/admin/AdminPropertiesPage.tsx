import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MacShell } from "../../components/layout/MacShell";
import { Card, Section, Button, Pill } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import { fetchAdminProperties, type AdminPropertyView } from "../../api/adminApi";
import { AdminFilterBar } from "../../components/admin/AdminFilterBar";
import { AdminDataTable } from "../../components/admin/AdminDataTable";
import { AdminDetailDrawer } from "../../components/admin/AdminDetailDrawer";

function readFilters(search: string) {
  const params = new URLSearchParams(search);
  return {
    q: params.get("q") || "",
    province: params.get("province") || "",
    integrity: params.get("integrity") || "all",
    sortBy: (params.get("sortBy") || "updatedAt") as "createdAt" | "updatedAt" | "name",
    sortDir: (params.get("sortDir") || "desc") as "asc" | "desc",
    page: Math.max(1, Number(params.get("page") || 1)),
    pageSize: Math.min(100, Math.max(1, Number(params.get("pageSize") || 25))),
  };
}

export const AdminPropertiesPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const filters = useMemo(() => readFilters(location.search), [location.search]);
  const [data, setData] = useState<{ items: AdminPropertyView[]; page: number; pageSize: number; total: number; hasMore: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<AdminPropertyView | null>(null);

  const updateFilters = (patch: Partial<typeof filters>) => {
    const next = new URLSearchParams(location.search);
    const merged = { ...filters, ...patch, page: patch.page ?? 1 };
    Object.entries(merged).forEach(([key, value]) => {
      if (value == null || value === "" || (key === "integrity" && value === "all") || (key === "sortBy" && value === "updatedAt") || (key === "sortDir" && value === "desc") || (key === "page" && Number(value) === 1) || (key === "pageSize" && Number(value) === 25)) {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });
    navigate({ pathname: location.pathname, search: next.toString() }, { replace: false });
  };

  const resetFilters = () => {
    navigate({ pathname: location.pathname, search: "" }, { replace: false });
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchAdminProperties(filters);
        if (!active) return;
        setData(result);
      } catch (err: any) {
        if (!active) return;
        setData(null);
        setError(err?.message || "Failed to load admin properties");
        showToast({
          message: "Failed to load admin properties",
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
  }, [filters.q, filters.province, filters.integrity, filters.sortBy, filters.sortDir, filters.page, filters.pageSize, showToast]);

  return (
    <MacShell title="Admin · Properties">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Properties</h1>
                <Pill tone="accent">Admin</Pill>
              </div>
              <div style={{ color: "#475569", maxWidth: 760 }}>
                Review platform-wide property records through the dedicated admin API with safe view shaping, filters, and pagination.
              </div>
            </div>
            <Button variant="secondary" onClick={() => window.location.reload()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </Section>

        <AdminFilterBar
          values={{
            q: filters.q,
            province: filters.province,
            integrity: filters.integrity,
            sortBy: filters.sortBy,
            sortDir: filters.sortDir,
            pageSize: String(filters.pageSize),
          }}
          onChange={(patch) =>
            updateFilters({
              ...patch,
              pageSize: patch.pageSize ? Number(patch.pageSize) : filters.pageSize,
            })
          }
          onReset={resetFilters}
        />

        <Card style={{ display: "grid", gap: 12 }}>
          {loading ? <div>Loading properties…</div> : null}
          {!loading && error ? <div style={{ color: "#b91c1c" }}>Failed to load properties: {error}</div> : null}
          {!loading && !data?.items?.length ? (
            <div style={{ color: "#475569" }}>No properties match the current admin filters.</div>
          ) : null}
          {!loading && data?.items?.length ? (
            <>
              <AdminDataTable
                items={data.items}
                sortBy={filters.sortBy}
                sortDir={filters.sortDir}
                onSortChange={(sortBy) =>
                  updateFilters({
                    sortBy,
                    sortDir: filters.sortBy === sortBy && filters.sortDir === "desc" ? "asc" : "desc",
                  })
                }
                onSelect={setSelectedProperty}
              />
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ color: "#475569", fontSize: 14 }}>
                  Page {data.page} · {data.total} total properties
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
      <AdminDetailDrawer property={selectedProperty} onClose={() => setSelectedProperty(null)} />
    </MacShell>
  );
};

export default AdminPropertiesPage;
