import React from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Input } from "../../components/ui/Ui";
import { fetchProperties } from "../../api/propertiesApi";
import { fetchUnitsForProperty } from "../../api/unitsApi";
import { createWorkOrder, listContractorInvites, type ContractorInvite, type WorkOrderPriority } from "../../api/workOrdersApi";

const priorities: WorkOrderPriority[] = ["low", "medium", "high", "urgent"];

export default function WorkOrderNewPage() {
  const nav = useNavigate();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [properties, setProperties] = React.useState<Array<{ id: string; name: string }>>([]);
  const [units, setUnits] = React.useState<Array<{ id: string; unitNumber?: string }>>([]);
  const [invites, setInvites] = React.useState<ContractorInvite[]>([]);

  const [propertyId, setPropertyId] = React.useState("");
  const [unitId, setUnitId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState("Maintenance");
  const [priority, setPriority] = React.useState<WorkOrderPriority>("medium");
  const [budgetMin, setBudgetMin] = React.useState("");
  const [budgetMax, setBudgetMax] = React.useState("");
  const [notesInternal, setNotesInternal] = React.useState("");
  const [selectedInvites, setSelectedInvites] = React.useState<string[]>([]);
  const [assignedContractorId, setAssignedContractorId] = React.useState("");

  React.useEffect(() => {
    const run = async () => {
      try {
        const propRes = await fetchProperties();
        const propItems = Array.isArray((propRes as any)?.items)
          ? (propRes as any).items
          : Array.isArray((propRes as any)?.properties)
          ? (propRes as any).properties
          : [];
        const normalized = propItems
          .map((p: any) => ({
            id: String(p?.id || ""),
            name: String(p?.name || p?.addressLine1 || "Property"),
          }))
          .filter((p: any) => p.id);
        setProperties(normalized);
        setPropertyId(normalized[0]?.id || "");
      } catch {
        setProperties([]);
      }
      try {
        setInvites(await listContractorInvites());
      } catch {
        setInvites([]);
      }
    };
    void run();
  }, []);

  React.useEffect(() => {
    if (!propertyId) return;
    const load = async () => {
      try {
        const result = await fetchUnitsForProperty(propertyId);
        const normalized = (Array.isArray(result) ? result : []).map((u: any) => ({
          id: String(u?.id || u?.unitId || ""),
          unitNumber: String(u?.unitNumber || u?.unit || ""),
        }));
        setUnits(normalized.filter((u) => u.id));
      } catch {
        setUnits([]);
      }
    };
    void load();
  }, [propertyId]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card>
        <div style={{ fontWeight: 700, fontSize: "1.06rem" }}>Create Work Order</div>
        <div style={{ marginTop: 4, color: "#64748b" }}>
          Create a private work order and invite/assign contractors in your network.
        </div>
      </Card>

      <Card style={{ display: "grid", gap: 12 }}>
        {error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}
        <label style={{ display: "grid", gap: 6 }}>
          Property
          <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} style={{ padding: 10, borderRadius: 8, border: "1px solid #cbd5e1" }}>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          Unit (optional)
          <select value={unitId} onChange={(e) => setUnitId(e.target.value)} style={{ padding: 10, borderRadius: 8, border: "1px solid #cbd5e1" }}>
            <option value="">No unit</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.unitNumber || u.id}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          Title
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Example: Kitchen sink leak" />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", padding: 10, resize: "vertical" }}
          />
        </label>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
          <label style={{ display: "grid", gap: 6 }}>
            Category
            <Input value={category} onChange={(e) => setCategory(e.target.value)} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            Priority
            <select value={priority} onChange={(e) => setPriority(e.target.value as WorkOrderPriority)} style={{ padding: 10, borderRadius: 8, border: "1px solid #cbd5e1" }}>
              {priorities.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            Budget Min (cents)
            <Input value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} inputMode="numeric" />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            Budget Max (cents)
            <Input value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} inputMode="numeric" />
          </label>
        </div>

        <label style={{ display: "grid", gap: 6 }}>
          Assign contractor now (optional user id)
          <Input
            value={assignedContractorId}
            onChange={(e) => setAssignedContractorId(e.target.value)}
            placeholder="contractor user id"
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          Invite contractors
          <select
            multiple
            value={selectedInvites}
            onChange={(e) => {
              const values = Array.from(e.target.selectedOptions).map((o) => o.value);
              setSelectedInvites(values);
            }}
            style={{ minHeight: 110, padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
          >
            {invites
              .filter((i) => i.status === "accepted" && i.acceptedByUserId)
              .map((i) => (
                <option key={i.id} value={String(i.acceptedByUserId)}>
                  {i.email} ({i.acceptedByUserId})
                </option>
              ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          Internal notes
          <textarea
            value={notesInternal}
            onChange={(e) => setNotesInternal(e.target.value)}
            rows={3}
            style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", padding: 10, resize: "vertical" }}
          />
        </label>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button
            disabled={saving}
            onClick={async () => {
              if (!propertyId || !title.trim()) {
                setError("Property and title are required.");
                return;
              }
              setSaving(true);
              setError(null);
              try {
                await createWorkOrder({
                  propertyId,
                  unitId: unitId || null,
                  title: title.trim(),
                  description: description.trim(),
                  category: category.trim(),
                  priority,
                  budgetMinCents: budgetMin ? Number(budgetMin) : null,
                  budgetMaxCents: budgetMax ? Number(budgetMax) : null,
                  assignedContractorId: assignedContractorId || null,
                  invitedContractorIds: selectedInvites,
                  notesInternal: notesInternal.trim(),
                });
                nav("/work-orders");
              } catch (err: any) {
                setError(String(err?.message || "Failed to create work order"));
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving..." : "Create Work Order"}
          </Button>
          <Button variant="secondary" onClick={() => nav("/work-orders")}>
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}
