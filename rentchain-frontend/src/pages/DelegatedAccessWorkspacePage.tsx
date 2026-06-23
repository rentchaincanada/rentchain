import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { BriefcaseBusiness, LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";
import {
  fetchMyDelegatedAccessGrants,
  type DelegatedAccessActiveGrant,
  type DelegatedAccessRole,
  type DelegatedAccessWorkspaceScope,
} from "../api/delegatedAccessApi";
import { Button, Card, Pill } from "../components/ui/Ui";
import { useAuth } from "../context/useAuth";
import { getRoleDefaultDestination } from "../lib/authDestination";
import { colors, text } from "../styles/tokens";

const roleLabels: Record<DelegatedAccessRole, string> = {
  property_manager: "Property Manager",
  assistant_office_admin: "Assistant / Office Admin",
  maintenance_coordinator: "Maintenance Coordinator",
  contractor: "Contractor",
  contractor_admin: "Contractor Admin",
  read_only_auditor: "Read-only Auditor",
};

const workspaceLabels: Record<DelegatedAccessWorkspaceScope, string> = {
  dashboard: "Dashboard",
  operations: "Operations",
  properties: "Properties",
  tenants: "Tenants",
  leases: "Leases",
  payments: "Payments",
  unified_inbox: "Unified Inbox",
  scheduling: "Scheduling",
  work_orders: "Work Orders",
  evidence_exports: "Evidence Exports",
};

function propertyScopeLabel(grant: DelegatedAccessActiveGrant): string {
  const mode = grant.permissionScope.propertyScope.mode;
  if (mode === "all_current_properties") return "All current properties";
  if (mode === "selected") return "Selected properties";
  if (mode === "resource_only") return "Assigned resources only";
  return "No property scope";
}

function uniqueWorkspaces(grants: DelegatedAccessActiveGrant[]): DelegatedAccessWorkspaceScope[] {
  return Array.from(
    new Set(grants.flatMap((grant) => grant.permissionScope.workspaceScopes || []))
  ).filter((scope): scope is DelegatedAccessWorkspaceScope => Boolean(workspaceLabels[scope]));
}

function workspaceSummary(scope: DelegatedAccessWorkspaceScope): string {
  if (scope === "dashboard") return "Assigned portfolio context and delegated activity.";
  if (scope === "operations") return "Assigned operational workflows and follow-up work.";
  return `${workspaceLabels[scope]} access assigned by the landlord owner.`;
}

export default function DelegatedAccessWorkspacePage() {
  const navigate = useNavigate();
  const { user, authStatus, isLoading, ready, logout } = useAuth();
  const role = String((user as any)?.actorRole || user?.role || "").trim().toLowerCase();
  const [grants, setGrants] = React.useState<DelegatedAccessActiveGrant[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [selectedWorkspace, setSelectedWorkspace] = React.useState<DelegatedAccessWorkspaceScope>("dashboard");
  const authLoading = authStatus === "restoring" || isLoading || !ready;

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const rows = await fetchMyDelegatedAccessGrants();
        if (cancelled) return;
        const activeRows = rows.filter((grant) => grant.status === "active");
        setGrants(activeRows);
        const scopes = uniqueWorkspaces(activeRows);
        setSelectedWorkspace(scopes[0] || "dashboard");
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Unable to load delegated access");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (!authLoading && role === "delegate") {
      void load();
    }
    return () => {
      cancelled = true;
    };
  }, [authLoading, role]);

  if (!authLoading && role !== "delegate") {
    return <Navigate to={getRoleDefaultDestination(role as any)} replace />;
  }

  const workspaces = uniqueWorkspaces(grants);
  const selectedLabel = workspaceLabels[selectedWorkspace] || "Workspace";
  const delegateEmail = String(user?.email || "").trim();

  const handleSignOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", color: text.primary }}>
      <div
        style={{
          borderBottom: "1px solid #e2e8f0",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: colors.accent }}>RentChain</div>
            <div style={{ width: 1, height: 22, background: "#cbd5e1" }} aria-hidden="true" />
            <div style={{ color: text.muted, fontSize: 14, fontWeight: 700 }}>Delegated workspace</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Pill tone="accent">Delegate account</Pill>
            {delegateEmail ? <span style={{ color: text.muted, fontSize: 13 }}>{delegateEmail}</span> : null}
            <Button
              type="button"
              onClick={handleSignOut}
              variant="ghost"
              style={{ borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <LogOut size={16} aria-hidden="true" />
              Sign out
            </Button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 18px 48px", display: "grid", gap: 22 }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: colors.accent, fontSize: 13, fontWeight: 800, textTransform: "uppercase" }}>
              Delegated Access
            </div>
            <h1 style={{ margin: "6px 0 0", fontSize: 30, lineHeight: 1.15 }}>Assigned Workspaces</h1>
          </div>
        </header>

        {authLoading || loading ? (
          <Card>
            <p style={{ margin: 0, color: text.muted }}>Loading delegated access...</p>
          </Card>
        ) : error ? (
          <Card>
            <h2 style={{ margin: 0, fontSize: 18 }}>Unable to load delegated access</h2>
            <p role="alert" style={{ margin: "8px 0 0", color: text.muted }}>{error}</p>
          </Card>
        ) : grants.length === 0 ? (
          <Card>
            <h2 style={{ margin: 0, fontSize: 18 }}>No active delegated access</h2>
            <p style={{ margin: "8px 0 0", color: text.muted }}>
              There are no active workspace assignments for this account.
            </p>
          </Card>
        ) : (
          <>
            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {workspaces.map((workspace) => {
                const Icon = workspace === "dashboard" ? LayoutDashboard : BriefcaseBusiness;
                const selected = selectedWorkspace === workspace;
                return (
                  <Button
                    key={workspace}
                    type="button"
                    variant={selected ? "primary" : "secondary"}
                    aria-pressed={selected}
                    onClick={() => setSelectedWorkspace(workspace)}
                    style={{
                      minHeight: 74,
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-start",
                      gap: 10,
                      textAlign: "left",
                    }}
                  >
                    <Icon size={20} aria-hidden="true" />
                    <span>{workspaceLabels[workspace]}</span>
                  </Button>
                );
              })}
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 16 }}>
              <Card style={{ minHeight: 210 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <ShieldCheck size={22} color={colors.accent} aria-hidden="true" />
                  <h2 style={{ margin: 0, fontSize: 22 }}>{selectedLabel}</h2>
                </div>
                <p style={{ margin: "12px 0 0", color: text.muted, lineHeight: 1.6 }}>
                  {workspaceSummary(selectedWorkspace)}
                </p>
              </Card>

              <div style={{ display: "grid", gap: 12 }}>
                {grants.map((grant, index) => (
                  <Card key={`${grant.role}-${grant.acceptedAt || grant.createdAt}-${index}`} style={{ borderRadius: 8 }}>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <strong>{roleLabels[grant.role]}</strong>
                        <Pill tone="accent">Active</Pill>
                      </div>
                      <div style={{ color: text.muted, fontSize: 14 }}>{propertyScopeLabel(grant)}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {grant.permissionScope.workspaceScopes.map((scope) => (
                          <Pill key={scope}>{workspaceLabels[scope] || scope}</Pill>
                        ))}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
