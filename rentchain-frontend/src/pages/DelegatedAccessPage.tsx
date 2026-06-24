import React from "react";
import { ShieldCheck, UserPlus } from "lucide-react";
import { Button, Card, EmptyState, Input, Pill, SkeletonBlock } from "../components/ui/Ui";
import { useToast } from "../components/ui/ToastProvider";
import { useAuth } from "../context/useAuth";
import {
  cancelDelegatedAccessInvitation,
  createDelegatedAccessInvitation,
  fetchDelegatedAccessDelegates,
  fetchDelegatedAccessGrants,
  fetchDelegatedAccessInvitations,
  revokeDelegatedAccessGrant,
  type CreateDelegatedAccessInvitationInput,
  type DelegatedAccessDelegateSummary,
  type DelegatedAccessGrant,
  type DelegatedAccessInvitation,
  type DelegatedAccessPermissionAction,
  type DelegatedAccessPropertyScopeMode,
  type DelegatedAccessRole,
  type DelegatedAccessWorkspaceScope,
} from "../api/delegatedAccessApi";
import { colors, radius, spacing, text } from "../styles/tokens";

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
  evidence_exports: "Evidence / Exports",
};

const permissionLabels: Record<DelegatedAccessPermissionAction, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  approve: "Approve",
  export: "Export",
  assign: "Assign",
  message: "Message",
};

const roles = Object.keys(roleLabels) as DelegatedAccessRole[];
const workspaces = Object.keys(workspaceLabels) as DelegatedAccessWorkspaceScope[];
const permissions = Object.keys(permissionLabels) as DelegatedAccessPermissionAction[];

const defaultWorkspaces: DelegatedAccessWorkspaceScope[] = ["dashboard", "operations"];
const defaultPermissions: DelegatedAccessPermissionAction[] = ["view"];
type AccessStatusFilter = "all" | "pending" | "active" | "cancelled" | "expired" | "revoked";
type AccessRow =
  | { kind: "invitation"; status: DelegatedAccessInvitation["status"]; invitation: DelegatedAccessInvitation }
  | { kind: "grant"; status: DelegatedAccessGrant["status"]; grant: DelegatedAccessGrant };

const statusFilters: AccessStatusFilter[] = ["all", "pending", "active", "cancelled", "expired", "revoked"];

function labelList<T extends string>(items: T[], labels: Record<T, string>) {
  if (!items.length) return "None";
  return items.map((item) => labels[item] || item).join(", ");
}

function formatDate(value?: string | null) {
  if (!value) return "Unavailable";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unavailable";
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function defaultExpiryDate() {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return date.toISOString().slice(0, 10);
}

function toIsoDate(value: string) {
  if (!value) return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  return new Date(`${value}T23:59:59.000Z`).toISOString();
}

function propertyScopeLabel(mode: DelegatedAccessPropertyScopeMode, selectedSummary?: string) {
  if (mode === "all_current_properties") return "All current properties";
  if (mode === "selected") return selectedSummary || "Selected properties";
  if (mode === "resource_only") return "Resource-only";
  return "No property scope";
}

function statusTone(status: string): "accent" | "muted" {
  return status === "active" || status === "pending" ? "accent" : "muted";
}

function statusLabel(status: string) {
  return status
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function inviteToastDescription(status?: string | null) {
  if (status === "sent") return "Invitation email was sent to the delegate.";
  if (status === "failed") return "Invitation was saved, but email delivery failed. Use resend after delivery is restored.";
  return "Invitation was saved. Confirm email delivery status before relying on the link.";
}

function filteredEmptyState(status: AccessStatusFilter) {
  if (status === "all") {
    return {
      title: "No delegated access yet",
      body: "Invite delegates when you need staff or external collaborators to use their own account instead of sharing yours.",
    };
  }
  return {
    title: `No ${statusLabel(status).toLowerCase()} records`,
    body: "History is preserved here when records enter this state.",
  };
}

function isOwnerRole(user: any) {
  const role = String(user?.actorRole || user?.role || "").trim().toLowerCase();
  return role === "landlord";
}

function ToggleChip({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: radius.pill,
        border: `1px solid ${checked ? colors.accent : colors.border}`,
        background: checked ? colors.accentSoft : colors.card,
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        style={{ margin: 0 }}
      />
      {label}
    </label>
  );
}

function StatusCard({ label, value }: { label: string; value: number }) {
  return (
    <Card style={{ padding: spacing.md, display: "grid", gap: 4 }}>
      <div style={{ color: text.muted, fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900 }}>{value}</div>
    </Card>
  );
}

export default function DelegatedAccessPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [delegates, setDelegates] = React.useState<DelegatedAccessDelegateSummary[]>([]);
  const [grants, setGrants] = React.useState<DelegatedAccessGrant[]>([]);
  const [invitations, setInvitations] = React.useState<DelegatedAccessInvitation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<AccessStatusFilter>("all");
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<DelegatedAccessRole>("property_manager");
  const [workspaceScopes, setWorkspaceScopes] = React.useState<DelegatedAccessWorkspaceScope[]>(defaultWorkspaces);
  const [permissionFlags, setPermissionFlags] = React.useState<DelegatedAccessPermissionAction[]>(defaultPermissions);
  const [expiresAt, setExpiresAt] = React.useState(defaultExpiryDate());
  const [submitting, setSubmitting] = React.useState(false);
  const [revokingGrantId, setRevokingGrantId] = React.useState<string | null>(null);
  const [confirmingRevokeGrant, setConfirmingRevokeGrant] = React.useState<DelegatedAccessGrant | null>(null);
  const [cancellingInvitationId, setCancellingInvitationId] = React.useState<string | null>(null);
  const [revocationReasons, setRevocationReasons] = React.useState<Record<string, string>>({});
  const canManage = isOwnerRole(user);

  const load = React.useCallback(async () => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [delegateRows, grantRows, inviteRows] = await Promise.all([
        fetchDelegatedAccessDelegates(),
        fetchDelegatedAccessGrants(),
        fetchDelegatedAccessInvitations(),
      ]);
      setDelegates(delegateRows);
      setGrants(grantRows);
      setInvitations(inviteRows);
    } catch (err: any) {
      setError(err?.message || "Unable to load delegated access");
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const pendingInvitations = invitations.filter((invitation) => invitation.status === "pending");
  const cancelledInvitations = invitations.filter((invitation) => invitation.status === "cancelled");
  const expiredInvitations = invitations.filter((invitation) => invitation.status === "expired");
  const activeGrants = grants.filter((grant) => grant.status === "active");
  const revokedGrants = grants.filter((grant) => grant.status === "revoked");
  const allAccessRows: AccessRow[] = [
    ...pendingInvitations.map((invitation) => ({ kind: "invitation" as const, status: invitation.status, invitation })),
    ...cancelledInvitations.map((invitation) => ({ kind: "invitation" as const, status: invitation.status, invitation })),
    ...expiredInvitations.map((invitation) => ({ kind: "invitation" as const, status: invitation.status, invitation })),
    ...grants.map((grant) => ({ kind: "grant" as const, status: grant.status, grant })),
  ];
  const accessRows = allAccessRows.filter((row) => statusFilter === "all" || row.status === statusFilter);
  const activeAccessRows = accessRows.filter((row) => row.kind === "grant" && row.status === "active");
  const invitationHistoryRows = accessRows.filter((row) => row.kind === "invitation");
  const grantHistoryRows = accessRows.filter((row) => row.kind === "grant" && row.status !== "active");
  const statusCounts: Record<AccessStatusFilter, number> = {
    all: allAccessRows.length,
    pending: pendingInvitations.length,
    active: activeGrants.length,
    cancelled: cancelledInvitations.length,
    expired: allAccessRows.filter((row) => row.status === "expired").length,
    revoked: revokedGrants.length,
  };
  const emptyState = filteredEmptyState(statusFilter);

  const resetInvite = () => {
    setInviteEmail("");
    setInviteRole("property_manager");
    setWorkspaceScopes(defaultWorkspaces);
    setPermissionFlags(defaultPermissions);
    setExpiresAt(defaultExpiryDate());
  };

  const toggleWorkspace = (workspace: DelegatedAccessWorkspaceScope, checked: boolean) => {
    setWorkspaceScopes((current) => {
      const next = checked ? [...current, workspace] : current.filter((item) => item !== workspace);
      return Array.from(new Set(next));
    });
  };

  const togglePermission = (permission: DelegatedAccessPermissionAction, checked: boolean) => {
    setPermissionFlags((current) => {
      const next = checked ? [...current, permission] : current.filter((item) => item !== permission);
      return Array.from(new Set(next));
    });
  };

  const updateRevocationReason = (grantId: string, value: string) => {
    setRevocationReasons((current) => ({ ...current, [grantId]: value }));
  };

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (workspaceScopes.length === 0 || permissionFlags.length === 0) {
      showToast({
        message: "Invite needs role scope",
        description: "Choose at least one workspace and one permission.",
        variant: "warning",
      });
      return;
    }
    setSubmitting(true);
    try {
      const input: CreateDelegatedAccessInvitationInput = {
        inviteeEmail: inviteEmail,
        role: inviteRole,
        propertyScope: { mode: "all_current_properties", propertyIds: [] },
        workspaceScopes,
        permissionFlags,
        expiresAt: toIsoDate(expiresAt),
      };
      const result = await createDelegatedAccessInvitation(input);
      showToast({
        message: "Delegate invitation created",
        description: inviteToastDescription(result.emailDispatch?.status || result.invitation.emailDispatch?.status),
        variant: result.emailDispatch?.status === "failed" ? "warning" : "success",
      });
      resetInvite();
      setInviteOpen(false);
      await load();
    } catch (err: any) {
      showToast({
        message: "Could not create invitation",
        description: err?.message || "The invitation was not saved.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmRevoke = async (grant: DelegatedAccessGrant) => {
    if (grant.status !== "active") return;
    setRevokingGrantId(grant.grantId);
    try {
      await revokeDelegatedAccessGrant(grant.grantId, revocationReasons[grant.grantId] || "");
      showToast({
        message: "Access revoked",
        description: "Future delegated actions for this grant are now blocked.",
        variant: "success",
      });
      setRevocationReasons((current) => {
        const next = { ...current };
        delete next[grant.grantId];
        return next;
      });
      setConfirmingRevokeGrant(null);
      await load();
    } catch (err: any) {
      showToast({
        message: "Could not revoke access",
        description: err?.message || "The grant is unchanged.",
        variant: "error",
      });
    } finally {
      setRevokingGrantId(null);
    }
  };

  const handleCancelInvitation = async (invitation: DelegatedAccessInvitation) => {
    if (invitation.status !== "pending") return;
    setCancellingInvitationId(invitation.invitationId);
    try {
      const result = await cancelDelegatedAccessInvitation(invitation.invitationId);
      setInvitations((current) =>
        current.map((item) => (item.invitationId === invitation.invitationId ? result.invitation : item))
      );
      showToast({
        message: "Invitation cancelled",
        description: "The pending invitation can no longer be accepted.",
        variant: "success",
      });
    } catch (err: any) {
      showToast({
        message: "Could not cancel invitation",
        description: err?.message || "The invitation is unchanged.",
        variant: "error",
      });
    } finally {
      setCancellingInvitationId(null);
    }
  };

  const renderInvitationRecord = (invitation: DelegatedAccessInvitation) => (
    <div
      key={`invitation-${invitation.invitationId}`}
      data-testid="delegated-access-record"
      data-status={invitation.status}
      style={{
        display: "grid",
        gap: spacing.xs,
        padding: spacing.md,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.md,
        background: colors.card,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 900 }}>{invitation.inviteeEmail}</div>
          <div style={{ color: text.muted, fontSize: 13 }}>
            {roleLabels[invitation.role]} · {propertyScopeLabel(invitation.propertyScope.mode)}
          </div>
        </div>
        <Pill tone={statusTone(invitation.status)}>{statusLabel(invitation.status)}</Pill>
      </div>
      <div style={{ color: text.secondary, fontSize: 13 }}>
        Workspaces: {labelList(invitation.workspaceScopes, workspaceLabels)} · Permissions:{" "}
        {labelList(invitation.permissionFlags, permissionLabels)}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: spacing.sm,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ color: text.muted, fontSize: 13 }}>Expires {formatDate(invitation.expiresAt)}</div>
        {invitation.status === "pending" ? (
          <Button
            type="button"
            variant="secondary"
            disabled={cancellingInvitationId === invitation.invitationId}
            onClick={() => void handleCancelInvitation(invitation)}
          >
            {cancellingInvitationId === invitation.invitationId ? "Cancelling..." : "Cancel Invitation"}
          </Button>
        ) : null}
      </div>
    </div>
  );

  const renderGrantRecord = (grant: DelegatedAccessGrant) => (
    <div
      key={`grant-${grant.grantId}`}
      data-testid="delegated-access-record"
      data-status={grant.status}
      style={{
        display: "grid",
        gap: spacing.sm,
        padding: spacing.md,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.md,
        background: grant.status === "revoked" ? "#f8fafc" : colors.card,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 900 }}>{grant.delegateEmail || "Delegate account"}</div>
          <div style={{ color: text.muted, fontSize: 13 }}>
            {roleLabels[grant.role]} · {propertyScopeLabel(grant.permissionScope.propertyScope.mode)}
          </div>
        </div>
        <Pill tone={statusTone(grant.status)}>{statusLabel(grant.status)}</Pill>
      </div>
      <div style={{ color: text.secondary, fontSize: 13 }}>
        Workspaces: {labelList(grant.permissionScope.workspaceScopes, workspaceLabels)} · Permissions:{" "}
        {labelList(grant.permissionScope.permissionFlags, permissionLabels)}
      </div>
      <div style={{ color: text.muted, fontSize: 13 }}>
        Accepted {formatDate(grant.acceptedAt)} · Updated {formatDate(grant.updatedAt)}
        {grant.revokedAt ? ` · Revoked ${formatDate(grant.revokedAt)}` : ""}
      </div>
      {grant.status === "active" ? (
        <div style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", alignItems: "center" }}>
            <Input
              aria-label={`Revocation reason for ${grant.delegateEmail || "delegate"}`}
              value={revocationReasons[grant.grantId] || ""}
              onChange={(event) => updateRevocationReason(grant.grantId, event.target.value)}
              placeholder="Optional revocation reason"
              style={{ maxWidth: 320 }}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={Boolean(revokingGrantId)}
              onClick={() => setConfirmingRevokeGrant(grant)}
            >
              Revoke Access
            </Button>
          </div>
          {confirmingRevokeGrant?.grantId === grant.grantId ? (
            <div
              role="alertdialog"
              aria-label={`Confirm revoke access for ${grant.delegateEmail || "delegate"}`}
              style={{
                display: "grid",
                gap: spacing.xs,
                padding: spacing.sm,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.md,
                background: "#fff7ed",
              }}
            >
              <div style={{ fontWeight: 900 }}>
                Are you sure you want to revoke access for {grant.delegateEmail || "this delegate"}?
              </div>
              <div style={{ color: text.secondary, fontSize: 13 }}>
                {roleLabels[grant.role]} · {propertyScopeLabel(grant.permissionScope.propertyScope.mode)} · Revocation blocks future delegated access.
              </div>
              <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={revokingGrantId === grant.grantId}
                  onClick={() => setConfirmingRevokeGrant(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={Boolean(revokingGrantId)}
                  onClick={() => void handleConfirmRevoke(grant)}
                >
                  {revokingGrantId === grant.grantId ? "Revoking..." : "Confirm revoke"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : grant.revocationReason ? (
        <div style={{ color: text.muted, fontSize: 13 }}>Reason: {grant.revocationReason}</div>
      ) : null}
    </div>
  );

  const renderSection = (title: string, body: string, rows: AccessRow[]) => {
    if (rows.length === 0) return null;
    return (
      <section style={{ display: "grid", gap: spacing.sm }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1rem" }}>{title}</h3>
          <div style={{ color: text.muted, fontSize: 13 }}>{body}</div>
        </div>
        <div style={{ display: "grid", gap: spacing.sm }}>
          {rows.map((row) => (row.kind === "invitation" ? renderInvitationRecord(row.invitation) : renderGrantRecord(row.grant)))}
        </div>
      </section>
    );
  };

  if (!canManage) {
    return (
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          width: "calc(100% - 32px)",
          display: "grid",
          gap: spacing.md,
        }}
      >
        <Card elevated>
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Delegate Management</h1>
          <p style={{ margin: "8px 0 0", color: text.muted }}>
            Delegate management is available only to landlord owners.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 1320,
        margin: "0 auto",
        width: "calc(100% - 32px)",
        display: "grid",
        gap: spacing.md,
      }}
    >
      <Card elevated style={{ display: "grid", gap: spacing.md }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.55rem", fontWeight: 900 }}>Delegate Management</h1>
            <p style={{ margin: 0, color: text.muted }}>
              Never share your login. Invite delegates to their own account.
            </p>
          </div>
          <Button type="button" onClick={() => setInviteOpen((open) => !open)}>
            {inviteOpen ? "Hide Invite" : "Invite Delegate"}
          </Button>
        </div>
        <div
          style={{
            display: "flex",
            gap: spacing.sm,
            alignItems: "center",
            color: text.secondary,
            fontSize: 14,
          }}
        >
          <ShieldCheck size={18} />
          <span>Revoking access blocks future delegated actions and preserves the audit history.</span>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: spacing.sm }}>
        <StatusCard label="Pending" value={pendingInvitations.length} />
        <StatusCard label="Active" value={activeGrants.length} />
        <StatusCard label="Revoked" value={revokedGrants.length} />
        <StatusCard label="Cancelled" value={cancelledInvitations.length} />
        <StatusCard label="Expired" value={expiredInvitations.length} />
      </div>

      {inviteOpen ? (
        <Card style={{ display: "grid", gap: spacing.md }}>
          <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
            <UserPlus size={20} />
            <div>
              <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Invite Delegate</h2>
              <div style={{ color: text.muted, fontSize: 13 }}>Creates a pending invitation and sends the acceptance email.</div>
            </div>
          </div>
          <form onSubmit={handleInvite} style={{ display: "grid", gap: spacing.md }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: spacing.sm }}>
              <label style={{ display: "grid", gap: 6, fontWeight: 700 }}>
                Delegate email
                <Input
                  aria-label="Delegate email"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  required
                  placeholder="delegate@example.com"
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontWeight: 700 }}>
                Role
                <select
                  aria-label="Delegate role"
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value as DelegatedAccessRole)}
                  style={{
                    minHeight: 42,
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.md,
                    background: colors.card,
                    padding: "10px 12px",
                    color: text.primary,
                  }}
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ display: "grid", gap: 6, fontWeight: 700 }}>
                Property scope
                <div
                  aria-label="Property scope"
                  style={{
                    minHeight: 42,
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.md,
                    background: "#f8fafc",
                    padding: "10px 12px",
                    color: text.primary,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  All current properties
                </div>
              </div>
              <label style={{ display: "grid", gap: 6, fontWeight: 700 }}>
                Expires
                <Input
                  aria-label="Invitation expiration date"
                  type="date"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                  required
                />
              </label>
            </div>

            <div style={{ display: "grid", gap: spacing.xs }}>
              <div style={{ fontWeight: 800 }}>Workspace scope</div>
              <div style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap" }}>
                {workspaces.map((workspace) => (
                  <ToggleChip
                    key={workspace}
                    checked={workspaceScopes.includes(workspace)}
                    label={workspaceLabels[workspace]}
                    onChange={(checked) => toggleWorkspace(workspace, checked)}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gap: spacing.xs }}>
              <div style={{ fontWeight: 800 }}>Permissions</div>
              <div style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap" }}>
                {permissions.map((permission) => (
                  <ToggleChip
                    key={permission}
                    checked={permissionFlags.includes(permission)}
                    label={permissionLabels[permission]}
                    onChange={(checked) => togglePermission(permission, checked)}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create Invitation"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  resetInvite();
                  setInviteOpen(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card style={{ display: "grid", gap: spacing.md }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Access Overview</h2>
            <div style={{ color: text.muted, fontSize: 13 }}>Who can access this landlord workspace and what state they are in.</div>
          </div>
          <div role="tablist" aria-label="Delegated access status filters" style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap" }}>
            {statusFilters.map((status) => (
              <Button
                key={status}
                type="button"
                role="tab"
                aria-selected={statusFilter === status}
                aria-label={statusLabel(status)}
                variant={statusFilter === status ? "primary" : "secondary"}
                onClick={() => setStatusFilter(status)}
                style={{ padding: "8px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <span>{statusLabel(status)}</span>
                <span aria-hidden="true" style={{ opacity: 0.75 }}>{statusCounts[status]}</span>
              </Button>
            ))}
          </div>
        </div>

        {loading ? <SkeletonBlock lines={4} label="Loading delegated access" /> : null}
        {error ? (
          <EmptyState
            title="Unable to load delegated access"
            body={error}
            action={<Button type="button" variant="secondary" onClick={load}>Retry</Button>}
          />
        ) : null}
        {!loading && !error && accessRows.length === 0 ? (
          <EmptyState
            title={emptyState.title}
            body={emptyState.body}
            action={
              statusFilter === "all" || statusFilter === "pending" ? (
                <Button type="button" onClick={() => setInviteOpen(true)}>Invite Delegate</Button>
              ) : undefined
            }
          />
        ) : null}

        {!loading && !error && accessRows.length > 0 ? (
          <div style={{ display: "grid", gap: spacing.sm }}>
            {renderSection(
              "Active access",
              "Accepted grants that can currently use delegated workspace access.",
              activeAccessRows
            )}
            {renderSection(
              "Invitation history",
              "Pending, cancelled, and expired invitations remain visible for review.",
              invitationHistoryRows
            )}
            {renderSection(
              "Revoked access",
              "Revoked grants stay preserved as historical access records.",
              grantHistoryRows
            )}
          </div>
        ) : null}
      </Card>

      <Card style={{ display: "grid", gap: spacing.sm }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Delegates Summary</h2>
        {delegates.length === 0 ? (
          <div style={{ color: text.muted }}>Delegate summaries will appear after invitations are accepted.</div>
        ) : (
          <div style={{ display: "grid", gap: spacing.sm }}>
            {delegates.map((delegate) => (
              <div
                key={delegate.delegateUserId}
                data-testid="delegate-summary-row"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: spacing.sm,
                  padding: spacing.sm,
                  borderRadius: radius.md,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <div style={{ fontWeight: 900, overflowWrap: "anywhere" }}>
                    {delegate.delegateEmail || "Delegate account"}
                  </div>
                  <div style={{ color: text.muted, fontSize: 13 }}>{labelList(delegate.roles, roleLabels)}</div>
                </div>
                <div style={{ color: text.muted, fontSize: 13, flex: "1 1 140px", minWidth: 0 }}>
                  {delegate.activeGrantCount} active · {delegate.revokedGrantCount} revoked
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
