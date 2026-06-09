import React from "react";
import { RefreshCcw } from "lucide-react";
import { fetchUnifiedInbox, type UnifiedInboxResponse, type UnifiedInboxRole } from "../api/unifiedInboxApi";
import { UnifiedInboxList } from "../components/UnifiedInbox/UnifiedInboxList";
import { Button, Card } from "../components/ui/Ui";
import { colors, spacing, text } from "../styles/tokens";

type Props = {
  role: UnifiedInboxRole;
};

function titleForRole(role: UnifiedInboxRole) {
  if (role === "tenant") return "Tenant inbox";
  if (role === "contractor") return "Contractor inbox";
  return "Unified inbox";
}

function subtitleForRole(role: UnifiedInboxRole) {
  if (role === "tenant") {
    return "Viewing updates, notices, applications, maintenance, screening, lease, and message activity for your tenant workspace.";
  }
  if (role === "contractor") {
    return "Assigned work orders and property manager messages for your contractor workspace.";
  }
  return "Applications, screenings, leases, maintenance, messages, notices, viewings, and work orders for your landlord workspace.";
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Unable to load the unified inbox.";
}

export default function UnifiedInboxPage({ role }: Props) {
  const [data, setData] = React.useState<UnifiedInboxResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchUnifiedInbox(role);
      setData(response);
    } catch (err) {
      setError(errorMessage(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [role]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const records = data?.records || data?.items || [];

  return (
    <div style={{ display: "grid", gap: spacing.md }}>
      <Card elevated style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 6, maxWidth: 760 }}>
          <h1 style={{ margin: 0, color: text.primary, fontSize: "1.55rem" }}>{titleForRole(role)}</h1>
          <div style={{ color: text.muted, lineHeight: 1.55 }}>{subtitleForRole(role)}</div>
        </div>
        <Button type="button" variant="ghost" onClick={() => void load()} disabled={loading} style={{ alignSelf: "flex-start" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <RefreshCcw size={16} aria-hidden="true" />
            Refresh
          </span>
        </Button>
      </Card>

      {loading ? (
        <Card elevated style={{ color: text.muted }}>
          Loading inbox updates...
        </Card>
      ) : null}

      {!loading && error ? (
        <Card elevated style={{ borderColor: colors.danger, color: colors.danger, display: "grid", gap: spacing.sm }}>
          <div style={{ fontWeight: 800 }}>We couldn't load this inbox.</div>
          <div>{error}</div>
          <Button type="button" variant="ghost" onClick={() => void load()} style={{ justifySelf: "start" }}>
            Try again
          </Button>
        </Card>
      ) : null}

      {!loading && !error ? (
        <>
          <Card style={{ display: "flex", gap: spacing.md, flexWrap: "wrap", color: text.muted }}>
            <span>Total visible records: {data?.total || records.length}</span>
            <span>Returned: {records.length}</span>
            <span>Role: {role}</span>
          </Card>
          <UnifiedInboxList records={records} role={role} />
        </>
      ) : null}
    </div>
  );
}
