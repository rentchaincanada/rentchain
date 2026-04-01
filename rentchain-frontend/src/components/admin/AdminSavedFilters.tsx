import React, { useEffect, useMemo, useState } from "react";
import { Button, Card } from "../ui/Ui";
import {
  createAdminSavedFilter,
  deleteAdminSavedFilter,
  fetchAdminSavedFilters,
  type AdminSavedFilterPageKey,
  type AdminSavedFilterPreset,
} from "../../api/adminApi";
import { useToast } from "../ui/ToastProvider";

type Props = {
  pageKey: AdminSavedFilterPageKey;
  currentFilters: Record<string, string | number | boolean | null>;
  onApplyPreset: (filters: Record<string, string | number | boolean | null>) => void;
  allowEmptySave?: boolean;
};

export const AdminSavedFilters: React.FC<Props> = ({ pageKey, currentFilters, onApplyPreset, allowEmptySave = false }) => {
  const { showToast } = useToast();
  const [items, setItems] = useState<AdminSavedFilterPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");

  const hasMeaningfulFilters = useMemo(
    () => allowEmptySave || Object.keys(currentFilters).length > 0,
    [allowEmptySave, currentFilters]
  );

  const load = async () => {
    try {
      setLoading(true);
      const result = await fetchAdminSavedFilters(pageKey);
      setItems(result.items);
      setSelectedId((current) => (current && result.items.some((item) => item.id === current) ? current : result.items[0]?.id || ""));
    } catch (err: any) {
      showToast({
        message: "Failed to load saved filters",
        description: err?.message || "",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [pageKey]);

  const handleSave = async () => {
    const name = window.prompt("Name this saved filter");
    if (!name || !name.trim()) return;
    try {
      setSaving(true);
      const result = await createAdminSavedFilter({
        pageKey,
        name,
        filters: currentFilters,
      });
      await load();
      setSelectedId(result.item.id);
      showToast({
        message: "Saved filter created",
        description: name.trim(),
        variant: "success",
      });
    } catch (err: any) {
      showToast({
        message: "Failed to save filter",
        description: err?.message || "",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const preset = items.find((item) => item.id === selectedId);
    if (!preset) return;
    if (!window.confirm(`Delete saved filter "${preset.name}"?`)) return;
    try {
      setDeletingId(selectedId);
      await deleteAdminSavedFilter(selectedId);
      await load();
      showToast({
        message: "Saved filter deleted",
        description: preset.name,
        variant: "success",
      });
    } catch (err: any) {
      showToast({
        message: "Failed to delete filter",
        description: err?.message || "",
        variant: "error",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const selectedPreset = items.find((item) => item.id === selectedId) || null;

  return (
    <Card style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontWeight: 700 }}>Saved filters</div>
          <div style={{ color: "#64748b", fontSize: 14 }}>
            Save and reopen URL-compatible admin filter presets for this page.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={handleSave} disabled={saving || !hasMeaningfulFilters}>
            {saving ? "Saving..." : "Save current filters"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: "#64748b" }}>Loading saved filters…</div>
      ) : !items.length ? (
        <div style={{ color: "#64748b" }}>No saved filters for this page yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(220px, 320px) 1fr auto auto" }}>
          <select
            aria-label="Saved filters"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{ minHeight: 42, borderRadius: 10, border: "1px solid rgb(203, 213, 225)", padding: "10px 12px" }}
          >
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <div style={{ color: "#64748b", fontSize: 14, alignSelf: "center" }}>
            {selectedPreset ? `Updated ${new Date(Number(selectedPreset.updatedAt || 0)).toLocaleString()}` : "Select a saved filter"}
          </div>
          <Button
            variant="secondary"
            onClick={() => selectedPreset && onApplyPreset(selectedPreset.filters)}
            disabled={!selectedPreset}
          >
            Load preset
          </Button>
          <Button
            variant="secondary"
            onClick={handleDelete}
            disabled={!selectedPreset || deletingId === selectedId}
          >
            {deletingId === selectedId ? "Deleting..." : "Delete"}
          </Button>
        </div>
      )}
    </Card>
  );
};

export default AdminSavedFilters;
