import React from "react";
import { Button, Card } from "../../components/ui/Ui";
import { acceptWorkOrder, addWorkOrderUpdate, completeWorkOrder, declineWorkOrder, listWorkOrderUpdates, listWorkOrders, startWorkOrder, type WorkOrderRecord, type WorkOrderUpdateRecord } from "../../api/workOrdersApi";

function formatDate(ms?: number | null) {
  if (!ms) return "-";
  return new Date(ms).toLocaleString();
}

export default function ContractorJobsPage() {
  const [items, setItems] = React.useState<WorkOrderRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [updates, setUpdates] = React.useState<WorkOrderUpdateRecord[]>([]);
  const [note, setNote] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listWorkOrders());
    } catch (err: any) {
      setError(String(err?.message || "Failed to load jobs"));
      setItems([]);
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
      <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "1.06rem" }}>Contractor Jobs</div>
          <div style={{ color: "#64748b", marginTop: 4 }}>Accept, decline, and update assigned jobs.</div>
        </div>
        <Button variant="secondary" onClick={() => void load()}>
          Refresh
        </Button>
      </Card>

      {error ? <Card style={{ borderColor: "#ef4444", color: "#991b1b" }}>{error}</Card> : null}

      <Card style={{ overflowX: "auto" }}>
        {loading ? (
          <div>Loading jobs...</div>
        ) : items.length === 0 ? (
          <div style={{ color: "#64748b" }}>No jobs available.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: 8 }}>Title</th>
                <th style={{ padding: 8 }}>Priority</th>
                <th style={{ padding: 8 }}>Status</th>
                <th style={{ padding: 8 }}>Property</th>
                <th style={{ padding: 8 }}>Budget</th>
                <th style={{ padding: 8 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: 8, fontWeight: 600 }}>{item.title}</td>
                  <td style={{ padding: 8 }}>{item.priority}</td>
                  <td style={{ padding: 8 }}>{item.status}</td>
                  <td style={{ padding: 8 }}>{item.propertyId}</td>
                  <td style={{ padding: 8 }}>
                    {item.budgetMinCents || item.budgetMaxCents
                      ? `${item.budgetMinCents ?? "-"} - ${item.budgetMaxCents ?? "-"}`
                      : "-"}
                  </td>
                  <td style={{ padding: 8 }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {item.status === "invited" ? (
                        <>
                          <Button
                            onClick={async () => {
                              await acceptWorkOrder(item.id);
                              await load();
                            }}
                          >
                            Accept
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={async () => {
                              await declineWorkOrder(item.id);
                              await load();
                            }}
                          >
                            Decline
                          </Button>
                        </>
                      ) : null}
                      {(item.status === "accepted" || item.status === "assigned") ? (
                        <Button
                          onClick={async () => {
                            await startWorkOrder(item.id);
                            await load();
                          }}
                        >
                          Start
                        </Button>
                      ) : null}
                      {item.status === "in_progress" ? (
                        <Button
                          onClick={async () => {
                            await completeWorkOrder(item.id);
                            await load();
                          }}
                        >
                          Mark Completed
                        </Button>
                      ) : null}
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setSelectedId(item.id);
                          void loadUpdates(item.id);
                        }}
                      >
                        Updates
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {selectedId ? (
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Job Updates</div>
          <div style={{ display: "grid", gap: 8, maxHeight: 280, overflow: "auto", paddingRight: 4 }}>
            {updates.length === 0 ? (
              <div style={{ color: "#64748b" }}>No updates yet.</div>
            ) : (
              updates.map((u) => (
                <div key={u.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 8 }}>
                  <div style={{ color: "#64748b", fontSize: 12 }}>
                    {u.updateType} • {formatDate(u.createdAtMs)}
                  </div>
                  <div style={{ marginTop: 4 }}>{u.message || "-"}</div>
                </div>
              ))
            )}
          </div>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add progress note"
              style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", padding: 8, resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                disabled={!note.trim()}
                onClick={async () => {
                  if (!note.trim()) return;
                  await addWorkOrderUpdate(selectedId, { updateType: "note", message: note.trim() });
                  setNote("");
                  await loadUpdates(selectedId);
                }}
              >
                Add Update
              </Button>
              <Button variant="ghost" onClick={() => setSelectedId("")}>
                Close
              </Button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
