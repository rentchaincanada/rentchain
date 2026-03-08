import React from "react";
import { Link } from "react-router-dom";
import { Button, Card } from "../../components/ui/Ui";
import { addWorkOrderUpdate, listWorkOrderUpdates, listWorkOrders, patchWorkOrder, type WorkOrderRecord, type WorkOrderUpdateRecord } from "../../api/workOrdersApi";

function formatDate(ms?: number | null) {
  if (!ms) return "-";
  return new Date(ms).toLocaleString();
}

export default function WorkOrdersPage() {
  const [items, setItems] = React.useState<WorkOrderRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<WorkOrderRecord | null>(null);
  const [updates, setUpdates] = React.useState<WorkOrderUpdateRecord[]>([]);
  const [newNote, setNewNote] = React.useState("");
  const [savingNote, setSavingNote] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listWorkOrders());
    } catch (err: any) {
      setError(String(err?.message || "Failed to load work orders"));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUpdates = React.useCallback(async (workOrderId: string) => {
    try {
      setUpdates(await listWorkOrderUpdates(workOrderId));
    } catch {
      setUpdates([]);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "1.06rem" }}>Work Orders</div>
          <div style={{ color: "#64748b", marginTop: 4 }}>Create, assign, and track landlord maintenance jobs.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" onClick={() => void load()}>
            Refresh
          </Button>
          <Link to="/work-orders/new">
            <Button>Create Work Order</Button>
          </Link>
        </div>
      </Card>

      {error ? (
        <Card style={{ borderColor: "#ef4444", color: "#991b1b" }}>{error}</Card>
      ) : null}

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(0,1fr)", alignItems: "start" }}>
        <Card style={{ overflowX: "auto" }}>
          {loading ? (
            <div>Loading work orders...</div>
          ) : items.length === 0 ? (
            <div style={{ color: "#64748b" }}>No work orders yet.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 880 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: 8 }}>Title</th>
                  <th style={{ padding: 8 }}>Category</th>
                  <th style={{ padding: 8 }}>Priority</th>
                  <th style={{ padding: 8 }}>Status</th>
                  <th style={{ padding: 8 }}>Assigned</th>
                  <th style={{ padding: 8 }}>Updated</th>
                  <th style={{ padding: 8 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: 8, fontWeight: 600 }}>{item.title}</td>
                    <td style={{ padding: 8 }}>{item.category || "-"}</td>
                    <td style={{ padding: 8 }}>{item.priority}</td>
                    <td style={{ padding: 8 }}>{item.status}</td>
                    <td style={{ padding: 8 }}>{item.assignedContractorId || "-"}</td>
                    <td style={{ padding: 8 }}>{formatDate(item.updatedAtMs)}</td>
                    <td style={{ padding: 8 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setSelected(item);
                            void loadUpdates(item.id);
                          }}
                        >
                          Timeline
                        </Button>
                        {item.status !== "completed" ? (
                          <Button
                            variant="ghost"
                            onClick={async () => {
                              await patchWorkOrder(item.id, { status: "completed" });
                              await load();
                              if (selected?.id === item.id) {
                                setSelected((prev) => (prev ? { ...prev, status: "completed" } : prev));
                                await loadUpdates(item.id);
                              }
                            }}
                          >
                            Mark Completed
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {selected ? (
          <Card>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Timeline: {selected.title}</div>
            <div style={{ display: "grid", gap: 8, maxHeight: 320, overflow: "auto", paddingRight: 4 }}>
              {updates.length === 0 ? (
                <div style={{ color: "#64748b" }}>No updates yet.</div>
              ) : (
                updates.map((u) => (
                  <div key={u.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 8 }}>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {u.updateType} • {formatDate(u.createdAtMs)}
                    </div>
                    <div style={{ marginTop: 4 }}>{u.message || "-"}</div>
                  </div>
                ))
              )}
            </div>
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add landlord note"
                rows={3}
                style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", padding: 8, resize: "vertical" }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <Button
                  disabled={!newNote.trim() || savingNote}
                  onClick={async () => {
                    if (!selected || !newNote.trim()) return;
                    setSavingNote(true);
                    try {
                      await addWorkOrderUpdate(selected.id, { updateType: "note", message: newNote.trim() });
                      setNewNote("");
                      await loadUpdates(selected.id);
                    } finally {
                      setSavingNote(false);
                    }
                  }}
                >
                  Add Note
                </Button>
                <Button variant="ghost" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </div>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
