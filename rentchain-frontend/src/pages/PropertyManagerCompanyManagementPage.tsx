import React from "react";
import { Building2, CheckCircle2, ShieldAlert, UserPlus, Users } from "lucide-react";
import {
  acceptCompanyPropertyManagerRelationship,
  createLandlordPropertyManagerRelationship,
  createPropertyManagerCompanyStaffAssignment,
  fetchCompanyPropertyManagerRelationships,
  fetchLandlordPropertyManagerRelationshipAssignments,
  fetchLandlordPropertyManagerRelationships,
  fetchMyPropertyManagerCompanies,
  fetchPropertyManagerCompanyMembers,
  fetchPropertyManagerCompanyStaffAssignments,
  reactivateLandlordPropertyManagerRelationship,
  reactivatePropertyManagerCompanyStaffAssignment,
  removePropertyManagerCompanyStaffAssignment,
  searchPropertyManagerCompanies,
  suspendLandlordPropertyManagerRelationship,
  suspendPropertyManagerCompanyStaffAssignment,
  terminateLandlordPropertyManagerRelationship,
  type PropertyManagerCompanyLookup,
  type PropertyManagerCompanyMember,
  type PropertyManagerCompanyPropertyScope,
  type PropertyManagerCompanyRelationship,
  type PropertyManagerCompanyStaffAssignment,
  type PropertyManagerCompanyStaffAssignmentRole,
  type PropertyManagerCompanyWorkspaceScope,
} from "../api/propertyManagerCompanyManagementApi";
import { Button, Card, EmptyState, InlineError, Input, Pill, SkeletonBlock } from "../components/ui/Ui";
import { useToast } from "../components/ui/ToastProvider";
import { useAuth } from "../context/useAuth";
import { colors, radius, shadows, spacing, text } from "../styles/tokens";

const ASSIGNMENT_ROLES: PropertyManagerCompanyStaffAssignmentRole[] = [
  "regional_manager",
  "property_manager",
  "leasing_agent",
  "office_administrator",
  "maintenance_coordinator",
  "read_only_staff",
];

const ROLE_LABELS: Record<PropertyManagerCompanyStaffAssignmentRole | "company_owner" | "company_admin", string> = {
  company_owner: "Company Owner",
  company_admin: "Company Admin",
  regional_manager: "Regional Manager",
  property_manager: "Property Manager",
  leasing_agent: "Leasing Agent",
  office_administrator: "Office Administrator",
  maintenance_coordinator: "Maintenance Coordinator",
  read_only_staff: "Read-only Staff",
};

const WORKSPACE_LABELS: Record<PropertyManagerCompanyWorkspaceScope, string> = {
  dashboard: "Dashboard",
  operations: "Operations",
  properties: "Properties",
  tenants: "Tenants",
  leases: "Leases",
  payments: "Payments",
  unified_inbox: "Inbox",
  scheduling: "Scheduling",
  work_orders: "Work Orders",
  evidence_exports: "Evidence / Exports",
  settings_billing: "Owner-only settings",
};

const RELATIONSHIP_WORKSPACES: PropertyManagerCompanyWorkspaceScope[] = [
  "dashboard",
  "operations",
  "properties",
  "tenants",
  "leases",
  "payments",
  "unified_inbox",
  "scheduling",
  "work_orders",
  "evidence_exports",
];

const DEFAULT_RELATIONSHIP_WORKSPACES: PropertyManagerCompanyWorkspaceScope[] = ["dashboard", "operations"];

type SurfaceMode = "landlord" | "company";

type Confirmation = {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
};

function userIsLandlord(user: any) {
  const role = String(user?.actorRole || user?.role || "").trim().toLowerCase();
  return role === "landlord" || role === "admin";
}

function statusLabel(value: string) {
  return value
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function actionPastTense(action: string) {
  if (action === "reactivate") return "reactivated";
  if (action === "remove") return "removed";
  if (action === "suspend") return "suspended";
  if (action === "terminate") return "terminated";
  return `${action}d`;
}

function statusTone(value: string): "accent" | "muted" {
  return value === "active" || value === "pending" ? "accent" : "muted";
}

function formatDate(value?: string | null) {
  if (!value) return "Unavailable";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unavailable";
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function visibleWorkspaces(workspaces: PropertyManagerCompanyWorkspaceScope[]) {
  return workspaces.filter((workspace) => workspace !== "settings_billing");
}

function workspaceLabelList(workspaces: PropertyManagerCompanyWorkspaceScope[]) {
  const visible = visibleWorkspaces(workspaces);
  if (!visible.length) return "No operational workspace scope";
  return visible.map((workspace) => WORKSPACE_LABELS[workspace]).join(", ");
}

function propertyScopeLabel(scope?: PropertyManagerCompanyPropertyScope | null) {
  if (!scope) return "Unavailable property scope";
  if (scope.mode === "all_current_properties") return "All current properties";
  return "Approved selected properties";
}

function relationshipScopeLabel(relationship: PropertyManagerCompanyRelationship) {
  return `${propertyScopeLabel(relationship.relationshipScope.propertyScope)} · ${workspaceLabelList(
    relationship.relationshipScope.workspaceScopes
  )}`;
}

function activeMembers(members: PropertyManagerCompanyMember[]) {
  return members.filter((member) => member.status === "active");
}

function scopeForAssignment(relationship: PropertyManagerCompanyRelationship): PropertyManagerCompanyPropertyScope {
  const propertyScope = relationship.relationshipScope.propertyScope;
  if (propertyScope.mode === "selected_properties") {
    return { mode: "selected_properties", propertyIds: [...propertyScope.propertyIds] };
  }
  return { mode: "all_current_properties", propertyIds: [] };
}

function relationshipCounts(relationships: PropertyManagerCompanyRelationship[]) {
  return {
    pending: relationships.filter((relationship) => relationship.status === "pending").length,
    active: relationships.filter((relationship) => relationship.status === "active").length,
    suspended: relationships.filter((relationship) => relationship.status === "suspended").length,
    terminated: relationships.filter((relationship) => relationship.status === "terminated").length,
  };
}

function ToggleChip({
  checked,
  label,
  disabled,
  onChange,
}: {
  checked: boolean;
  label: string;
  disabled?: boolean;
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
        color: disabled ? text.muted : text.primary,
        fontSize: 13,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.62 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        style={{ margin: 0 }}
      />
      {label}
    </label>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="pmc-summary-stat">
      <div style={{ color: text.muted, fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

function ConfirmPanel({
  confirmation,
  busy,
  onCancel,
}: {
  confirmation: Confirmation | null;
  busy: boolean;
  onCancel: () => void;
}) {
  if (!confirmation) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={confirmation.title}
      style={{
        position: "sticky",
        top: 12,
        zIndex: 5,
        display: "grid",
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.lg,
        border: "1px solid rgba(180,83,9,0.28)",
        background: "#fff7ed",
        boxShadow: shadows.md,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 900 }}>
        <ShieldAlert size={18} />
        {confirmation.title}
      </div>
      <div style={{ color: text.secondary, lineHeight: 1.5 }}>{confirmation.body}</div>
      <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
        <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={busy}
          onClick={() => {
            void confirmation.onConfirm();
          }}
        >
          {busy ? "Working..." : confirmation.confirmLabel}
        </Button>
      </div>
    </div>
  );
}

function RelationshipCard({
  relationship,
  staffAssignments,
  loadingStaff,
  onLoadStaff,
  onSuspend,
  onReactivate,
  onTerminate,
  companyMode,
  onAccept,
}: {
  relationship: PropertyManagerCompanyRelationship;
  staffAssignments?: PropertyManagerCompanyStaffAssignment[];
  loadingStaff?: boolean;
  onLoadStaff?: () => void;
  onSuspend?: () => void;
  onReactivate?: () => void;
  onTerminate?: () => void;
  companyMode?: boolean;
  onAccept?: () => void;
}) {
  const title = companyMode ? relationship.landlordWorkspaceLabel : relationship.propertyManagerCompanyLabel;
  return (
    <Card data-testid="pmc-relationship-card" style={{ display: "grid", gap: spacing.md }}>
      <div className="pmc-card-header">
        <div style={{ minWidth: 0 }}>
          <div className="pmc-card-title">{title}</div>
          <div style={{ color: text.muted, fontSize: 13, overflowWrap: "anywhere" }}>
            {relationshipScopeLabel(relationship)}
          </div>
        </div>
        <Pill tone={statusTone(relationship.status)}>{statusLabel(relationship.status)}</Pill>
      </div>

      <div className="pmc-meta-grid">
        <div>
          <span>Updated</span>
          <strong>{formatDate(relationship.updatedAt)}</strong>
        </div>
        <div>
          <span>Active staff</span>
          <strong>{relationship.staffAssignmentSummary.active}</strong>
        </div>
        <div>
          <span>Suspended staff</span>
          <strong>{relationship.staffAssignmentSummary.suspended}</strong>
        </div>
      </div>

      {relationship.status === "pending" ? (
        <div className="pmc-note">Access becomes active only after the PM company accepts.</div>
      ) : null}

      <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
        {onLoadStaff ? (
          <Button type="button" variant="secondary" onClick={onLoadStaff}>
            {loadingStaff ? "Loading staff..." : "View assigned staff"}
          </Button>
        ) : null}
        {onAccept && relationship.status === "pending" ? (
          <Button type="button" onClick={onAccept}>
            Accept relationship
          </Button>
        ) : null}
        {onSuspend && relationship.status === "active" ? (
          <Button type="button" variant="secondary" onClick={onSuspend}>
            Suspend
          </Button>
        ) : null}
        {onReactivate && relationship.status === "suspended" ? (
          <Button type="button" variant="secondary" onClick={onReactivate}>
            Reactivate
          </Button>
        ) : null}
        {onTerminate && relationship.status !== "terminated" ? (
          <Button type="button" variant="ghost" onClick={onTerminate}>
            Terminate
          </Button>
        ) : null}
      </div>

      {staffAssignments ? (
        <div style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ fontWeight: 900 }}>Assigned PM company staff</div>
          {staffAssignments.length ? (
            staffAssignments.map((assignment) => <AssignmentRow key={assignment.assignmentId} assignment={assignment} />)
          ) : (
            <EmptyState
              title="No staff assigned"
              body="This relationship has no visible staff assignments yet."
              style={{ background: colors.card }}
            />
          )}
        </div>
      ) : null}
    </Card>
  );
}

function AssignmentRow({
  assignment,
  onSuspend,
  onReactivate,
  onRemove,
}: {
  assignment: PropertyManagerCompanyStaffAssignment;
  onSuspend?: () => void;
  onReactivate?: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="pmc-assignment-row" data-testid="pmc-assignment-row">
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 900, overflowWrap: "anywhere" }}>{assignment.staffLabel}</div>
        <div style={{ color: text.muted, fontSize: 13 }}>
          {ROLE_LABELS[assignment.staffRole]} · {propertyScopeLabel(assignment.propertyScope)} ·{" "}
          {workspaceLabelList(assignment.workspaceScopes)}
        </div>
      </div>
      <div className="pmc-row-actions">
        <Pill tone={statusTone(assignment.status)}>{statusLabel(assignment.status)}</Pill>
        {onSuspend && assignment.status === "active" ? (
          <Button type="button" variant="secondary" onClick={onSuspend}>
            Suspend
          </Button>
        ) : null}
        {onReactivate && assignment.status === "suspended" ? (
          <Button type="button" variant="secondary" onClick={onReactivate}>
            Reactivate
          </Button>
        ) : null}
        {onRemove && assignment.status !== "removed" ? (
          <Button type="button" variant="ghost" onClick={onRemove}>
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function PropertyManagerCompanyManagementPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const canUseLandlordSurface = userIsLandlord(user);
  const [mode, setMode] = React.useState<SurfaceMode>(canUseLandlordSurface ? "landlord" : "company");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [landlordRelationships, setLandlordRelationships] = React.useState<PropertyManagerCompanyRelationship[]>([]);
  const [companyContexts, setCompanyContexts] = React.useState<PropertyManagerCompanyLookup[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = React.useState("");
  const [companyRelationships, setCompanyRelationships] = React.useState<PropertyManagerCompanyRelationship[]>([]);
  const [companyMembers, setCompanyMembers] = React.useState<PropertyManagerCompanyMember[]>([]);
  const [companyAssignments, setCompanyAssignments] = React.useState<PropertyManagerCompanyStaffAssignment[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<PropertyManagerCompanyLookup[]>([]);
  const [selectedLookup, setSelectedLookup] = React.useState<PropertyManagerCompanyLookup | null>(null);
  const [relationshipWorkspaces, setRelationshipWorkspaces] =
    React.useState<PropertyManagerCompanyWorkspaceScope[]>(DEFAULT_RELATIONSHIP_WORKSPACES);
  const [assignmentRelationshipId, setAssignmentRelationshipId] = React.useState("");
  const [assignmentStaffUserId, setAssignmentStaffUserId] = React.useState("");
  const [assignmentRole, setAssignmentRole] = React.useState<PropertyManagerCompanyStaffAssignmentRole>("property_manager");
  const [assignmentWorkspaces, setAssignmentWorkspaces] = React.useState<PropertyManagerCompanyWorkspaceScope[]>([]);
  const [landlordAssignments, setLandlordAssignments] = React.useState<Record<string, PropertyManagerCompanyStaffAssignment[]>>({});
  const [loadingStaffFor, setLoadingStaffFor] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [confirmation, setConfirmation] = React.useState<Confirmation | null>(null);

  const loadLandlord = React.useCallback(async () => {
    if (!canUseLandlordSurface) return;
    const relationships = await fetchLandlordPropertyManagerRelationships();
    setLandlordRelationships(relationships);
  }, [canUseLandlordSurface]);

  const loadCompanyContexts = React.useCallback(async () => {
    const companies = await fetchMyPropertyManagerCompanies();
    setCompanyContexts(companies);
    setSelectedCompanyId((current) => current || companies[0]?.propertyManagerCompanyId || "");
  }, []);

  const loadInitial = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadLandlord(), loadCompanyContexts()]);
    } catch (err: any) {
      setError(err?.message || "Unable to load property manager company management");
    } finally {
      setLoading(false);
    }
  }, [loadCompanyContexts, loadLandlord]);

  React.useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const loadCompany = React.useCallback(async () => {
    if (!selectedCompanyId) {
      setCompanyRelationships([]);
      setCompanyMembers([]);
      setCompanyAssignments([]);
      return;
    }
    setError(null);
    try {
      const [relationships, members, assignments] = await Promise.all([
        fetchCompanyPropertyManagerRelationships(selectedCompanyId),
        fetchPropertyManagerCompanyMembers(selectedCompanyId),
        fetchPropertyManagerCompanyStaffAssignments(selectedCompanyId),
      ]);
      setCompanyRelationships(relationships);
      setCompanyMembers(members);
      setCompanyAssignments(assignments);
    } catch (err: any) {
      setError(err?.message || "Unable to load company management records");
    }
  }, [selectedCompanyId]);

  React.useEffect(() => {
    void loadCompany();
  }, [loadCompany]);

  const selectedAssignmentRelationship = companyRelationships.find(
    (relationship) => relationship.relationshipId === assignmentRelationshipId
  );
  const allowedAssignmentWorkspaces = visibleWorkspaces(
    selectedAssignmentRelationship?.relationshipScope.workspaceScopes || []
  );

  React.useEffect(() => {
    const activeRelationships = companyRelationships.filter((relationship) => relationship.status === "active");
    const nextRelationship = activeRelationships[0];
    setAssignmentRelationshipId((current) =>
      current && activeRelationships.some((relationship) => relationship.relationshipId === current)
        ? current
        : nextRelationship?.relationshipId || ""
    );
  }, [companyRelationships]);

  React.useEffect(() => {
    if (!selectedAssignmentRelationship) {
      setAssignmentWorkspaces([]);
      return;
    }
    setAssignmentWorkspaces((current) => {
      const allowed = visibleWorkspaces(selectedAssignmentRelationship.relationshipScope.workspaceScopes);
      const retained = current.filter((workspace) => allowed.includes(workspace));
      return retained.length ? retained : allowed.slice(0, Math.min(2, allowed.length));
    });
  }, [selectedAssignmentRelationship]);

  React.useEffect(() => {
    const staff = activeMembers(companyMembers);
    setAssignmentStaffUserId((current) =>
      current && staff.some((member) => member.staffUserId === current) ? current : staff[0]?.staffUserId || ""
    );
  }, [companyMembers]);

  const executeConfirmed = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      setConfirmation(null);
    } finally {
      setBusy(false);
    }
  };

  const searchCompanies = async () => {
    setBusy(true);
    try {
      const companies = await searchPropertyManagerCompanies(searchQuery);
      setSearchResults(companies);
    } catch (err: any) {
      showToast({ message: "Company search failed", description: err?.message || "Try again.", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const createRelationship = async () => {
    if (!selectedLookup || !relationshipWorkspaces.length) return;
    setBusy(true);
    try {
      await createLandlordPropertyManagerRelationship({
        propertyManagerCompanyId: selectedLookup.propertyManagerCompanyId,
        propertyScope: { mode: "all_current_properties", propertyIds: [] },
        workspaceScopes: relationshipWorkspaces,
      });
      setSelectedLookup(null);
      setSearchQuery("");
      setSearchResults([]);
      setRelationshipWorkspaces(DEFAULT_RELATIONSHIP_WORKSPACES);
      await loadLandlord();
      showToast({
        message: "Relationship created",
        description: "The relationship is pending PM company acceptance.",
        variant: "success",
      });
    } catch (err: any) {
      showToast({ message: "Relationship creation failed", description: err?.message || "Try again.", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const loadLandlordStaff = async (relationshipId: string) => {
    setLoadingStaffFor(relationshipId);
    try {
      const assignments = await fetchLandlordPropertyManagerRelationshipAssignments(relationshipId);
      setLandlordAssignments((current) => ({ ...current, [relationshipId]: assignments }));
    } catch (err: any) {
      showToast({ message: "Unable to load assigned staff", description: err?.message || "Try again.", variant: "error" });
    } finally {
      setLoadingStaffFor(null);
    }
  };

  const confirmRelationshipAction = (
    relationship: PropertyManagerCompanyRelationship,
    action: "suspend" | "reactivate" | "terminate"
  ) => {
    const actionLabel = statusLabel(action);
    setConfirmation({
      title: `${actionLabel} relationship`,
      body:
        action === "terminate"
          ? `Terminate the relationship with ${relationship.propertyManagerCompanyLabel}? Access will remain blocked and history will be preserved.`
          : `${actionLabel} the relationship with ${relationship.propertyManagerCompanyLabel}?`,
      confirmLabel: actionLabel,
      onConfirm: () =>
        executeConfirmed(async () => {
          if (action === "suspend") await suspendLandlordPropertyManagerRelationship(relationship.relationshipId);
          if (action === "reactivate") await reactivateLandlordPropertyManagerRelationship(relationship.relationshipId);
          if (action === "terminate") await terminateLandlordPropertyManagerRelationship(relationship.relationshipId);
          await loadLandlord();
          showToast({ message: `Relationship ${actionPastTense(action)}`, variant: "success" });
        }),
    });
  };

  const confirmAcceptRelationship = (relationship: PropertyManagerCompanyRelationship) => {
    if (!selectedCompanyId) return;
    setConfirmation({
      title: "Accept relationship",
      body: `Accept the relationship for ${relationship.landlordWorkspaceLabel}? The landlord-approved scope will remain unchanged.`,
      confirmLabel: "Accept relationship",
      onConfirm: () =>
        executeConfirmed(async () => {
          await acceptCompanyPropertyManagerRelationship(selectedCompanyId, relationship.relationshipId);
          await loadCompany();
          showToast({ message: "Relationship accepted", variant: "success" });
        }),
    });
  };

  const createAssignment = async () => {
    if (!selectedCompanyId || !selectedAssignmentRelationship || !assignmentStaffUserId || !assignmentWorkspaces.length) return;
    setBusy(true);
    try {
      await createPropertyManagerCompanyStaffAssignment(selectedCompanyId, {
        relationshipId: selectedAssignmentRelationship.relationshipId,
        staffUserId: assignmentStaffUserId,
        staffRole: assignmentRole,
        propertyScope: scopeForAssignment(selectedAssignmentRelationship),
        workspaceScopes: assignmentWorkspaces,
      });
      await loadCompany();
      showToast({ message: "Staff assignment created", variant: "success" });
    } catch (err: any) {
      showToast({ message: "Assignment creation failed", description: err?.message || "Try again.", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const confirmAssignmentAction = (
    assignment: PropertyManagerCompanyStaffAssignment,
    action: "suspend" | "reactivate" | "remove"
  ) => {
    if (!selectedCompanyId) return;
    const actionLabel = statusLabel(action);
    setConfirmation({
      title: `${actionLabel} assignment`,
      body:
        action === "remove"
          ? `Remove delegated company assignment for ${assignment.staffLabel}? History will be preserved.`
          : `${actionLabel} delegated company assignment for ${assignment.staffLabel}?`,
      confirmLabel: actionLabel,
      onConfirm: () =>
        executeConfirmed(async () => {
          if (action === "suspend") {
            await suspendPropertyManagerCompanyStaffAssignment(selectedCompanyId, assignment.assignmentId);
          }
          if (action === "reactivate") {
            await reactivatePropertyManagerCompanyStaffAssignment(selectedCompanyId, assignment.assignmentId);
          }
          if (action === "remove") {
            await removePropertyManagerCompanyStaffAssignment(selectedCompanyId, assignment.assignmentId);
          }
          await loadCompany();
          showToast({ message: `Assignment ${actionPastTense(action)}`, variant: "success" });
        }),
    });
  };

  const landlordCounts = relationshipCounts(landlordRelationships);
  const companyCounts = relationshipCounts(companyRelationships);
  const hasCompanySurface = companyContexts.length > 0;
  const activeCompanyRelationships = companyRelationships.filter((relationship) => relationship.status === "active");

  return (
    <div className="pmc-page">
      <style>
        {`
          .pmc-page {
            max-width: 1320px;
            margin: 0 auto;
            padding: 0;
            display: grid;
            gap: ${spacing.md};
          }
          .pmc-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: ${spacing.md};
            flex-wrap: wrap;
          }
          .pmc-mode-tabs,
          .pmc-action-row,
          .pmc-chip-row,
          .pmc-row-actions {
            display: flex;
            gap: ${spacing.sm};
            flex-wrap: wrap;
            align-items: center;
          }
          .pmc-grid {
            display: grid;
            grid-template-columns: minmax(320px, 0.8fr) minmax(0, 1.2fr);
            gap: ${spacing.md};
            align-items: start;
          }
          .pmc-card-header,
          .pmc-assignment-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: ${spacing.md};
          }
          .pmc-card-title {
            font-size: 1rem;
            font-weight: 900;
            overflow-wrap: anywhere;
          }
          .pmc-meta-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: ${spacing.sm};
          }
          .pmc-meta-grid > div,
          .pmc-summary-stat {
            display: grid;
            gap: 4px;
            border: 1px solid ${colors.border};
            border-radius: ${radius.md};
            padding: ${spacing.sm};
            background: ${colors.panel};
            min-width: 0;
          }
          .pmc-meta-grid span {
            color: ${text.muted};
            font-size: 12px;
          }
          .pmc-meta-grid strong {
            font-size: 14px;
            overflow-wrap: anywhere;
          }
          .pmc-note {
            padding: ${spacing.sm};
            border-radius: ${radius.md};
            border: 1px solid ${colors.border};
            background: ${colors.accentSoft};
            color: ${text.secondary};
            font-size: 13px;
            line-height: 1.45;
          }
          .pmc-select {
            width: 100%;
            min-height: 42px;
            border: 1px solid ${colors.border};
            border-radius: ${radius.md};
            padding: 10px 12px;
            background: ${colors.card};
            color: ${text.primary};
          }
          .pmc-section-title {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 0;
            font-size: 1.1rem;
            font-weight: 900;
          }
          .pmc-form {
            display: grid;
            gap: ${spacing.sm};
          }
          .pmc-label {
            display: grid;
            gap: 6px;
            font-size: 13px;
            font-weight: 800;
          }
          .pmc-helper {
            color: ${text.muted};
            font-size: 12px;
            line-height: 1.45;
          }
          @media (max-width: 820px) {
            .pmc-page {
              padding: 0;
            }
            .pmc-grid {
              grid-template-columns: 1fr;
            }
            .pmc-card-header,
            .pmc-assignment-row {
              display: grid;
              grid-template-columns: 1fr;
            }
            .pmc-meta-grid {
              grid-template-columns: 1fr;
            }
            .pmc-row-actions {
              width: 100%;
            }
            .pmc-row-actions button {
              flex: 1 1 150px;
            }
          }
        `}
      </style>

      <Card elevated>
        <div className="pmc-header">
          <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: "1.55rem", fontWeight: 900 }}>PM Company Management</h1>
            <div style={{ color: text.muted, overflowWrap: "anywhere" }}>
              {user?.email ? `Signed in as ${user.email}` : "Signed in"}
            </div>
          </div>
          <div className="pmc-mode-tabs" role="tablist" aria-label="Property manager company management surfaces">
            {canUseLandlordSurface ? (
              <Button
                type="button"
                variant={mode === "landlord" ? "primary" : "secondary"}
                role="tab"
                aria-selected={mode === "landlord"}
                onClick={() => setMode("landlord")}
              >
                Landlord owner
              </Button>
            ) : null}
            <Button
              type="button"
              variant={mode === "company" ? "primary" : "secondary"}
              role="tab"
              aria-selected={mode === "company"}
              onClick={() => setMode("company")}
            >
              PM company admin
            </Button>
          </div>
        </div>
      </Card>

      <ConfirmPanel confirmation={confirmation} busy={busy} onCancel={() => setConfirmation(null)} />

      {loading ? <SkeletonBlock lines={5} height={18} /> : null}
      {error ? <InlineError message={error} retry={() => void loadInitial()} /> : null}

      {!loading && mode === "landlord" ? (
        canUseLandlordSurface ? (
          <div className="pmc-grid">
            <Card style={{ display: "grid", gap: spacing.md }}>
              <h2 className="pmc-section-title">
                <Building2 size={18} /> Create pending relationship
              </h2>
              <div className="pmc-form">
                <label className="pmc-label">
                  PM company search
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search by company label"
                  />
                </label>
                <Button type="button" variant="secondary" disabled={busy} onClick={searchCompanies}>
                  Search companies
                </Button>
                {searchResults.length ? (
                  <div style={{ display: "grid", gap: spacing.xs }}>
                    {searchResults.map((company) => (
                      <button
                        key={company.propertyManagerCompanyId}
                        type="button"
                        onClick={() => setSelectedLookup(company)}
                        style={{
                          textAlign: "left",
                          border: `1px solid ${
                            selectedLookup?.propertyManagerCompanyId === company.propertyManagerCompanyId
                              ? colors.accent
                              : colors.border
                          }`,
                          background:
                            selectedLookup?.propertyManagerCompanyId === company.propertyManagerCompanyId
                              ? colors.accentSoft
                              : colors.card,
                          borderRadius: radius.md,
                          padding: spacing.sm,
                          cursor: "pointer",
                          fontWeight: 800,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {company.companyLabel}
                      </button>
                    ))}
                  </div>
                ) : null}
                <label className="pmc-label">
                  Property scope
                  <div className="pmc-note">All current properties</div>
                </label>
                <div className="pmc-label">
                  Workspace scope
                  <div className="pmc-chip-row">
                    {RELATIONSHIP_WORKSPACES.map((workspace) => (
                      <ToggleChip
                        key={workspace}
                        checked={relationshipWorkspaces.includes(workspace)}
                        label={WORKSPACE_LABELS[workspace]}
                        onChange={(checked) =>
                          setRelationshipWorkspaces((current) =>
                            checked ? [...current, workspace] : current.filter((item) => item !== workspace)
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
                <Button type="button" disabled={busy || !selectedLookup || !relationshipWorkspaces.length} onClick={createRelationship}>
                  Create pending relationship
                </Button>
              </div>
            </Card>

            <div style={{ display: "grid", gap: spacing.md }}>
              <Card style={{ display: "grid", gap: spacing.sm }}>
                <h2 className="pmc-section-title">
                  <Users size={18} /> Landlord relationships
                </h2>
                <div className="pmc-meta-grid">
                  <SummaryStat label="Pending" value={landlordCounts.pending} />
                  <SummaryStat label="Active" value={landlordCounts.active} />
                  <SummaryStat label="Suspended" value={landlordCounts.suspended} />
                </div>
              </Card>
              {landlordRelationships.length ? (
                landlordRelationships.map((relationship) => (
                  <RelationshipCard
                    key={relationship.relationshipId}
                    relationship={relationship}
                    staffAssignments={landlordAssignments[relationship.relationshipId]}
                    loadingStaff={loadingStaffFor === relationship.relationshipId}
                    onLoadStaff={() => void loadLandlordStaff(relationship.relationshipId)}
                    onSuspend={() => confirmRelationshipAction(relationship, "suspend")}
                    onReactivate={() => confirmRelationshipAction(relationship, "reactivate")}
                    onTerminate={() => confirmRelationshipAction(relationship, "terminate")}
                  />
                ))
              ) : (
                <EmptyState
                  title="No PM company relationships"
                  body="Pending, active, suspended, and terminated relationships will appear here."
                />
              )}
            </div>
          </div>
        ) : (
          <EmptyState title="Landlord access required" body="This surface is available to landlord owner accounts." />
        )
      ) : null}

      {!loading && mode === "company" ? (
        hasCompanySurface ? (
          <div className="pmc-grid">
            <Card style={{ display: "grid", gap: spacing.md }}>
              <h2 className="pmc-section-title">
                <CheckCircle2 size={18} /> Company admin controls
              </h2>
              <label className="pmc-label">
                Company
                <select
                  className="pmc-select"
                  value={selectedCompanyId}
                  onChange={(event) => setSelectedCompanyId(event.target.value)}
                >
                  {companyContexts.map((company) => (
                    <option key={company.propertyManagerCompanyId} value={company.propertyManagerCompanyId}>
                      {company.companyLabel}
                    </option>
                  ))}
                </select>
              </label>
              <div className="pmc-meta-grid">
                <SummaryStat label="Pending" value={companyCounts.pending} />
                <SummaryStat label="Active" value={companyCounts.active} />
                <SummaryStat label="Suspended" value={companyCounts.suspended} />
              </div>

              <div className="pmc-form">
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 900 }}>Create staff assignment</h3>
                <label className="pmc-label">
                  Active relationship
                  <select
                    className="pmc-select"
                    value={assignmentRelationshipId}
                    onChange={(event) => setAssignmentRelationshipId(event.target.value)}
                  >
                    {activeCompanyRelationships.map((relationship) => (
                      <option key={relationship.relationshipId} value={relationship.relationshipId}>
                        {relationship.landlordWorkspaceLabel}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="pmc-label">
                  Staff member
                  <select
                    className="pmc-select"
                    value={assignmentStaffUserId}
                    onChange={(event) => setAssignmentStaffUserId(event.target.value)}
                  >
                    {activeMembers(companyMembers).map((member) => (
                      <option key={member.staffUserId} value={member.staffUserId}>
                        {member.staffLabel}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="pmc-label">
                  Role template
                  <select
                    className="pmc-select"
                    value={assignmentRole}
                    onChange={(event) => setAssignmentRole(event.target.value as PropertyManagerCompanyStaffAssignmentRole)}
                  >
                    {ASSIGNMENT_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="pmc-label">
                  Assignment scope
                  <div className="pmc-note">
                    {selectedAssignmentRelationship
                      ? propertyScopeLabel(selectedAssignmentRelationship.relationshipScope.propertyScope)
                      : "Select an active relationship"}
                  </div>
                  <div className="pmc-chip-row">
                    {allowedAssignmentWorkspaces.map((workspace) => (
                      <ToggleChip
                        key={workspace}
                        checked={assignmentWorkspaces.includes(workspace)}
                        label={WORKSPACE_LABELS[workspace]}
                        onChange={(checked) =>
                          setAssignmentWorkspaces((current) =>
                            checked ? [...current, workspace] : current.filter((item) => item !== workspace)
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
                <Button
                  type="button"
                  disabled={
                    busy ||
                    !selectedCompanyId ||
                    !selectedAssignmentRelationship ||
                    !assignmentStaffUserId ||
                    !assignmentWorkspaces.length
                  }
                  onClick={createAssignment}
                >
                  <UserPlus size={16} /> Create assignment
                </Button>
                {!activeCompanyRelationships.length || !activeMembers(companyMembers).length ? (
                  <div className="pmc-helper">Active relationships and active company members are required before assignment.</div>
                ) : null}
              </div>
            </Card>

            <div style={{ display: "grid", gap: spacing.md }}>
              <Card style={{ display: "grid", gap: spacing.sm }}>
                <h2 className="pmc-section-title">Company relationships</h2>
                {companyRelationships.length ? (
                  companyRelationships.map((relationship) => (
                    <RelationshipCard
                      key={relationship.relationshipId}
                      relationship={relationship}
                      companyMode
                      onAccept={() => confirmAcceptRelationship(relationship)}
                    />
                  ))
                ) : (
                  <EmptyState
                    title="No company relationships"
                    body="Pending and active landlord relationships will appear here."
                  />
                )}
              </Card>

              <Card style={{ display: "grid", gap: spacing.sm }}>
                <h2 className="pmc-section-title">Staff assignments</h2>
                {companyAssignments.length ? (
                  companyAssignments.map((assignment) => (
                    <AssignmentRow
                      key={assignment.assignmentId}
                      assignment={assignment}
                      onSuspend={() => confirmAssignmentAction(assignment, "suspend")}
                      onReactivate={() => confirmAssignmentAction(assignment, "reactivate")}
                      onRemove={() => confirmAssignmentAction(assignment, "remove")}
                    />
                  ))
                ) : (
                  <EmptyState
                    title="No staff assignments"
                    body="Assignment history will remain visible here after records are suspended or removed."
                  />
                )}
              </Card>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No PM company admin context"
            body="Company Owner/Admin memberships will appear here when available for this account."
          />
        )
      ) : null}
    </div>
  );
}
