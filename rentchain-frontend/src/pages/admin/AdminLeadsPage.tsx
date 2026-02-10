import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Card, Button, Section } from "../../components/ui/Ui";
import { spacing, text, colors, radius } from "../../styles/tokens";
import { approveLandlordLead, fetchLandlordLeads, rejectLandlordLead, type LandlordLead } from "../../api/adminLeadsApi";
import { useToast } from "../../components/ui/ToastProvider";
import { useAuth } from "../../context/useAuth";

const formatDate = (value?: number | null) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
};

const maskEmail = (email?: string | null) => {
  const value = String(email || "");
  const [user, domain] = value.split("@");
  if (!user || !domain) return "";
  const maskedUser = user.length <= 1 ? "*" : `${user[0]}***`;
  return `${maskedUser}@${domain}`;
};

const statusLabel = (status?: string | null) => {
  const s = String(status || "pending").toLowerCase();
  if (s === "approved" || s === "invited") return "Approved";
  if (s === "rejected") return "Rejected";
  return "Pending";
};

const AdminLeadsPage: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [leads, setLeads] = useState<LandlordLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { showToast } = useToast();
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const isAdmin = String(user?.role || "").toLowerCase() === "admin";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchLandlordLeads(statusFilter);
      setLeads(next);
      if (import.meta.env.DEV) {
        console.debug("[admin-leads]", { count: next.length, statusFilter });
      }
    } catch (err: any) {
      showToast({
        message: "Failed to load leads",
        description: err?.message || "",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [showToast, statusFilter]);

  useEffect(() => {
    if (!isAdmin) return;
    void load();
  }, [load, isAdmin]);

  const sorted = useMemo(() => {
    const list = [...leads].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return sortOrder === "oldest" ? list.reverse() : list;
  }, [leads, sortOrder]);

  useEffect(() => {
    const leadId = new URLSearchParams(location.search).get("leadId");
    if (!leadId || loading) return;
    const target = document.getElementById(`lead-${leadId}`);
    if (target) {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [location.search, loading, sorted]);

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
    const ok = window.confirm("Reject this access request?");
    if (!ok) return;
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

  if (!isAdmin) {
    return null;
  }

  return (
    <Section style={{ display: "grid", gap: spacing.md }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: spacing.sm }}>
        <div>
          <div style={{ fontSize: "1.2rem", fontWeight: 800 }}>Access Requests</div>
          <div style={{ color: text.muted }}>Leads from Request Access forms.</div>
        </div>
        <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
          <Button type="button" variant="ghost" onClick={() => setSortOrder((prev) => (prev === "newest" ? "oldest" : "newest"))}>
            Sort: {sortOrder === "newest" ? "Newest" : "Oldest"}
          </Button>
          <Button type="button" variant="ghost" onClick={load}>
            Refresh
          </Button>
        </div>
      </div>

      <Card style={{ padding: spacing.md }}>
        <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", marginBottom: spacing.sm }}>
          {(["pending", "approved", "rejected"] as const).map((status) => (
            <Button
              key={status}
              type="button"
              variant={statusFilter === status ? "primary" : "ghost"}
              onClick={() => setStatusFilter(status)}
            >
              {status === "pending" ? "Pending" : status === "approved" ? "Approved" : "Rejected"}
            </Button>
          ))}
        </div>
        {loading ? (
          <div style={{ color: text.muted }}>Loading…</div>
        ) : sorted.length === 0 ? (
          <div style={{ color: text.muted }}>
            {statusFilter === "pending" ? "No access requests yet." : `No ${statusFilter} requests.`}
          </div>
        ) : (
          <div style={{ display: "grid", gap: spacing.sm }}>
            {sorted.map((lead) => {
              const id = lead.id;
              const status = String(lead.status || "pending").toLowerCase();
              const isBusy = busyId === id;
              const isBlocked = busyId !== null;
              const isNew = status === "pending" || status === "new";
              const highlight = new URLSearchParams(location.search).get("leadId") === id;
              const badgeStyle: React.CSSProperties =
                status === "approved" || status === "invited"
                  ? { background: "#dcfce7", color: "#166534" }
                  : status === "rejected"
                  ? { background: "#f1f5f9", color: "#475569" }
                  : { background: "#dbeafe", color: "#1d4ed8" };
              return (
                <div
                  key={id}
                  id={`lead-${id}`}
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    display: "grid",
                    gap: spacing.xs,
                    background: highlight ? "rgba(37,99,235,0.08)" : undefined,
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" }}>
                    <div style={{ fontWeight: 700 }}>{lead.email || "—"}</div>
                    {lead.email ? (
                      <div style={{ color: text.subtle, fontSize: "0.85rem" }}>
                        {maskEmail(lead.email)}
                      </div>
                    ) : null}
                    <div style={{ color: text.muted }}>{lead.firstName || "—"}</div>
                    <div style={{ color: text.muted }}>Portfolio: {lead.portfolioSize || "—"}</div>
                    <div style={{ color: text.subtle }}>Created: {formatDate(lead.createdAt)}</div>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: radius.pill,
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        border: `1px solid ${colors.border}`,
                        ...badgeStyle,
                      }}
                    >
                      {statusLabel(status)}
                    </span>
                  </div>
                  {lead.note ? <div style={{ color: text.muted }}>Note: {lead.note}</div> : null}
                  <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
                    <Button
                      type="button"
                      onClick={() => handleApprove(id)}
                      disabled={isBlocked || !isNew}
                    >
                      Approve & Send Invite
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleReject(id)}
                      disabled={isBlocked || !isNew}
                    >
                      Reject Request
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
