import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, Button, Section } from "../../components/ui/Ui";
import { spacing, text, colors, radius } from "../../styles/tokens";
import { approveLandlordLead, fetchLandlordLeads, rejectLandlordLead, type LandlordLead } from "../../api/adminLeadsApi";
import { showToast } from "../../components/ui/toast";

const formatDate = (value?: number | null) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
};

const statusLabel = (status?: string | null) => {
  const s = String(status || "new").toLowerCase();
  if (s === "invited") return "Invited";
  if (s === "rejected") return "Rejected";
  return "New";
};

const AdminLeadsPage: React.FC = () => {
  const [leads, setLeads] = useState<LandlordLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchLandlordLeads();
      setLeads(next);
    } catch (err: any) {
      showToast({
        message: "Failed to load leads",
        description: err?.message || "",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(() => {
    return [...leads].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [leads]);

  const handleApprove = async (id: string) => {
    setBusyId(id);
    try {
      const res = await approveLandlordLead(id);
      if (!res?.ok) throw new Error(res?.error || "Approve failed");
      showToast({ message: "Invite sent", variant: "success" });
      await load();
    } catch (err: any) {
      showToast({
        message: "Failed to approve lead",
        description: err?.message || "",
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id: string) => {
    setBusyId(id);
    try {
      const res = await rejectLandlordLead(id);
      if (!res?.ok) throw new Error(res?.error || "Reject failed");
      showToast({ message: "Lead rejected", variant: "success" });
      await load();
    } catch (err: any) {
      showToast({
        message: "Failed to reject lead",
        description: err?.message || "",
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Section style={{ display: "grid", gap: spacing.md }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: spacing.sm }}>
        <div>
          <div style={{ fontSize: "1.2rem", fontWeight: 800 }}>Access Requests</div>
          <div style={{ color: text.muted }}>Leads from Request Access forms.</div>
        </div>
        <Button type="button" variant="ghost" onClick={load}>
          Refresh
        </Button>
      </div>

      <Card style={{ padding: spacing.md }}>
        {loading ? (
          <div style={{ color: text.muted }}>Loading…</div>
        ) : sorted.length === 0 ? (
          <div style={{ color: text.muted }}>No requests yet.</div>
        ) : (
          <div style={{ display: "grid", gap: spacing.sm }}>
            {sorted.map((lead) => {
              const id = lead.id;
              const status = String(lead.status || "new").toLowerCase();
              const isBusy = busyId === id;
              return (
                <div
                  key={id}
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    display: "grid",
                    gap: spacing.xs,
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" }}>
                    <div style={{ fontWeight: 700 }}>{lead.email || "—"}</div>
                    <div style={{ color: text.muted }}>{lead.firstName || "—"}</div>
                    <div style={{ color: text.muted }}>Portfolio: {lead.portfolioSize || "—"}</div>
                    <div style={{ color: text.subtle }}>Created: {formatDate(lead.createdAt)}</div>
                    <div style={{ color: text.primary, fontWeight: 700 }}>Status: {statusLabel(status)}</div>
                  </div>
                  {lead.note ? <div style={{ color: text.muted }}>Note: {lead.note}</div> : null}
                  <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
                    <Button
                      type="button"
                      onClick={() => handleApprove(id)}
                      disabled={isBusy || status === "invited"}
                    >
                      Approve & send invite
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleReject(id)}
                      disabled={isBusy || status === "rejected"}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </Section>
  );
};

export default AdminLeadsPage;
