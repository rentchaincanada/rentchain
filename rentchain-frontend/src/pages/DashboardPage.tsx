import React from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  ListChecks,
  Mail,
  Route,
  Users,
  WalletCards,
  Wrench,
} from "lucide-react";
import { MacShell } from "../components/layout/MacShell";
import { Card, SkeletonBlock } from "../components/ui/Ui";
import { colors, spacing, text } from "../styles/tokens";
import {
  fetchLandlordDecisionQueue,
  type LandlordDecisionQueueItem,
  type LandlordDecisionQueueResponse,
  type LandlordDecisionQueueSeverity,
  type LandlordDecisionQueueWorkspace,
} from "@/api/landlordDecisionQueueApi";
import {
  fetchLandlordPortfolioStatusFinancial,
  type LandlordPortfolioStatusFinancialResponse,
  type PortfolioDataQualityFlag,
  type PortfolioMetricConfidence,
} from "@/api/landlordPortfolioStatusFinancialApi";
import { fetchApplications } from "@/api/applicationsApi";
import { fetchTenants } from "@/api/tenantsApi";
import { fetchUnifiedInbox } from "@/api/unifiedInboxApi";
import { listWorkOrders } from "@/api/workOrdersApi";
import { listLandlordMaintenance } from "@/api/maintenanceWorkflowApi";

type Loadable<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

type MetricState = "trusted" | "degraded" | "unavailable";

type PortfolioCounts = {
  applicationsPending: number | null;
  tenants: number | null;
  maintenanceRequests: number | null;
  workOrders: number | null;
  unifiedMessages: number | null;
};

const sectionCard: React.CSSProperties = {
  display: "grid",
  gap: spacing.md,
  minWidth: 0,
};

const compactButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  minHeight: 38,
  padding: "8px 12px",
  borderRadius: 8,
  border: `1px solid ${colors.borderStrong}`,
  background: "#fff",
  color: text.primary,
  fontWeight: 750,
  textDecoration: "none",
  fontSize: 14,
};

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function metricState(confidence: PortfolioMetricConfidence | null | undefined): MetricState {
  if (confidence === "high") return "trusted";
  if (confidence === "medium" || confidence === "low") return "degraded";
  return "unavailable";
}

function stateLabel(state: MetricState) {
  if (state === "trusted") return "Trusted";
  if (state === "degraded") return "Degraded";
  return "Unavailable";
}

function stateStyle(state: MetricState): React.CSSProperties {
  if (state === "trusted") {
    return { background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0" };
  }
  if (state === "degraded") {
    return { background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" };
  }
  return { background: "#f8fafc", color: "#64748b", border: "1px solid #cbd5e1" };
}

function severityStyle(severity: LandlordDecisionQueueSeverity): React.CSSProperties {
  if (severity === "critical") return { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" };
  if (severity === "warning" || severity === "needs_review") {
    return { background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa" };
  }
  if (severity === "upcoming") return { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" };
  return { background: "#f8fafc", color: "#475569", border: "1px solid #cbd5e1" };
}

function workspaceLabel(workspace: LandlordDecisionQueueWorkspace): string {
  const labels: Record<LandlordDecisionQueueWorkspace, string> = {
    dashboard: "Dashboard",
    operations: "Operations",
    tenant: "Tenant",
    lease: "Lease",
    property: "Property",
    maintenance: "Maintenance",
    payments: "Payments",
    notices: "Notices",
    evidence_compliance: "Evidence",
  };
  return labels[workspace] || "Operations";
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "Unavailable";
  return `${Math.round(value * 100)}%`;
}

function formatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "Unavailable";
  return new Intl.NumberFormat().format(value);
}

function formatMoney(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return "Unavailable";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function formatShortWeekday(value: Date): string {
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(value);
}

function formatShortMonthDay(value: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(value);
}

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(value.getDate() + days);
  return next;
}

function isSameCalendarDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function isSameCalendarMonth(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function cleanFlags(flags: PortfolioDataQualityFlag[] | null | undefined): string[] {
  return (flags || []).slice(0, 3).map((flag) => flag.replace(/_/g, " "));
}

function isPendingApplication(application: { status?: unknown; applicationStatus?: unknown }): boolean {
  const status = String(application.status || application.applicationStatus || "").trim().toLowerCase();
  if (!status) return true;
  return !["approved", "accepted", "rejected", "declined", "converted", "withdrawn", "cancelled", "canceled"].includes(status);
}

function isOpenWorkOrder(workOrder: { status?: unknown }): boolean {
  const status = String(workOrder.status || "").trim().toLowerCase();
  if (!status) return true;
  return !["done", "closed", "completed", "cancelled", "canceled", "resolved"].includes(status);
}

function isOpenMaintenanceRequest(request: { status?: unknown }): boolean {
  const status = String(request.status || "").trim().toLowerCase();
  if (!status) return true;
  return !["completed", "cancelled", "canceled", "resolved", "closed"].includes(status);
}

function useNarrowDashboardLayout(): boolean {
  const [isNarrow, setIsNarrow] = React.useState(false);

  React.useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const update = () => setIsNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isNarrow;
}

function operationalHref(item: LandlordDecisionQueueItem): string {
  const href = String(item.recommendedActionHref || "").trim();
  return href.startsWith("/") ? href : "/operations";
}

function StatusPill({ state }: { state: MetricState }) {
  return (
    <span
      style={{
        ...stateStyle(state),
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        width: "fit-content",
        borderRadius: 8,
        padding: "4px 8px",
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      {state === "trusted" ? <CheckCircle2 size={14} /> : state === "degraded" ? <AlertCircle size={14} /> : <Clock3 size={14} />}
      {stateLabel(state)}
    </span>
  );
}

function MiniStateLabel({ state }: { state: MetricState }) {
  return (
    <span
      style={{
        ...stateStyle(state),
        display: "inline-flex",
        alignItems: "center",
        width: "fit-content",
        borderRadius: 8,
        padding: "3px 7px",
        fontSize: 11,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {stateLabel(state)}
    </span>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 10, minWidth: 0 }}>
        <div
          aria-hidden="true"
          style={{
            width: 36,
            height: 36,
            flex: "0 0 auto",
            borderRadius: 8,
            display: "grid",
            placeItems: "center",
            background: "#eef2ff",
            color: "#1d4ed8",
          }}
        >
          {icon}
        </div>
        <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 18, letterSpacing: 0 }}>{title}</h2>
          {subtitle ? <div style={{ color: text.muted, fontSize: 14, lineHeight: 1.45 }}>{subtitle}</div> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

function LoadingSection({ title }: { title: string }) {
  return (
    <Card style={sectionCard}>
      <SectionHeader icon={<Clock3 size={18} />} title={title} subtitle="Loading current operational state." />
      <SkeletonBlock lines={4} label={`Loading ${title}`} />
    </Card>
  );
}

function ErrorSection({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <Card style={sectionCard}>
      <SectionHeader icon={<AlertCircle size={18} />} title={title} subtitle="This section could not load. Other dashboard sections remain available." />
      <div style={{ color: text.muted, lineHeight: 1.5 }}>{message}</div>
      <button type="button" onClick={onRetry} style={{ ...compactButton, width: "fit-content" }}>
        Retry section
      </button>
    </Card>
  );
}

function PortfolioHealthSection({ portfolio }: { portfolio: LandlordPortfolioStatusFinancialResponse }) {
  const status = portfolio.portfolioStatus;
  const state = metricState(portfolio.confidence.occupancy);
  const flags = cleanFlags(status.dataQualityFlags);
  return (
    <Card style={sectionCard} data-testid="portfolio-status-section">
      <SectionHeader
        icon={<Building2 size={18} />}
        title="Portfolio Health"
        subtitle="Quick view of portfolio occupancy and health."
        action={
          <Link to="/portfolio-health" style={compactButton}>
            Portfolio detail <ArrowRight size={16} />
          </Link>
        }
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 132px), 1fr))",
          gap: 10,
          alignItems: "stretch",
        }}
      >
        <HeroKpi label="Properties" value={formatCount(status.totalProperties)} />
        <HeroKpi label="Units" value={formatCount(status.totalUnits)} />
        <HeroKpi label="Occupied" value={formatCount(status.occupiedUnits)} emphasis />
        <HeroKpi label="Vacant" value={formatCount(status.vacantUnits)} />
        <HeroKpi label="Occupancy" value={formatPercent(status.occupancyRate)} emphasis />
      </div>
      {flags.length > 0 ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", color: text.muted, fontSize: 13 }}>
          <MiniStateLabel state={state} />
          <span>Data quality: {flags.join(", ")}</span>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "center", color: "#047857", fontSize: 13 }}>
          <MiniStateLabel state={state} />
          <span>Occupied / total units: {formatCount(status.occupiedUnits)} / {formatCount(status.totalUnits)}</span>
        </div>
      )}
    </Card>
  );
}

function HeroKpi({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div
      style={{
        display: "grid",
        gap: 6,
        padding: "12px 14px",
        borderRadius: 8,
        border: `1px solid ${emphasis ? "rgba(37,99,235,0.32)" : colors.border}`,
        background: emphasis ? "#eff6ff" : "#fff",
        minWidth: 0,
      }}
    >
      <div style={{ color: text.muted, fontSize: 13, fontWeight: 800, whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ color: text.primary, fontSize: 30, lineHeight: 1, fontWeight: 900, whiteSpace: "nowrap" }}>{value}</div>
    </div>
  );
}

function PortfolioCountsRow({
  portfolio,
  counts,
}: {
  portfolio: LandlordPortfolioStatusFinancialResponse | null;
  counts: Loadable<PortfolioCounts>;
}) {
  const status = portfolio?.portfolioStatus;
  const cards = [
    { label: "Properties", value: status?.totalProperties ?? null, href: "/properties", icon: <Building2 size={18} /> },
    { label: "Units", value: status?.totalUnits ?? null, href: "/properties", icon: <Route size={18} /> },
    { label: "Applications Pending", value: counts.data?.applicationsPending ?? null, href: "/applications", icon: <FileText size={18} /> },
    { label: "Tenants", value: counts.data?.tenants ?? null, href: "/tenants", icon: <Users size={18} /> },
    { label: "Maintenance Requests", value: counts.data?.maintenanceRequests ?? null, href: "/maintenance", icon: <Wrench size={18} /> },
    { label: "Work Orders", value: counts.data?.workOrders ?? null, href: "/work-orders", icon: <Wrench size={18} /> },
    { label: "Unified Messages", value: counts.data?.unifiedMessages ?? null, href: "/landlord/inbox", icon: <Mail size={18} /> },
    { label: "Leases", value: status?.currentLeaseCount ?? null, href: "/leases", icon: <ClipboardList size={18} /> },
  ];

  return (
    <div
      data-testid="portfolio-counts-row"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 136px), 1fr))",
        gap: 10,
      }}
    >
      {cards.map((card) => {
        const isUnavailable = card.value == null || counts.loading;
        return (
          <Link
            key={card.label}
            to={card.href}
            style={{
              display: "grid",
              gap: 8,
              minHeight: 90,
              padding: 12,
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              background: "#fff",
              color: text.primary,
              textDecoration: "none",
              minWidth: 0,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <span style={{ color: "#1d4ed8", lineHeight: 0 }}>{card.icon}</span>
              <ArrowRight size={15} color={text.subtle} />
            </div>
            <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
              <div style={{ color: text.muted, fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{card.label}</div>
              <div style={{ fontSize: 26, lineHeight: 1, fontWeight: 900, whiteSpace: "nowrap" }}>{isUnavailable ? "—" : formatCount(card.value)}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function FinancialSnapshotSection({ portfolio }: { portfolio: LandlordPortfolioStatusFinancialResponse }) {
  const financial = portfolio.financialSnapshot;
  const state = metricState(portfolio.confidence.financial);
  const flags = cleanFlags(financial.dataQualityFlags);
  const collected = Math.max(0, financial.collectedCurrentMonthCents || 0);
  const outstanding = Math.max(0, financial.outstandingCurrentMonthCents || 0);
  const vacancy = Math.max(0, financial.vacancyImpactCents || 0);
  const total = collected + outstanding + vacancy;
  const collectedDegrees = total > 0 ? (collected / total) * 360 : 0;
  const outstandingDegrees = total > 0 ? (outstanding / total) * 360 : 0;
  return (
    <Card style={sectionCard} data-testid="financial-snapshot-section">
      <SectionHeader
        icon={<Banknote size={18} />}
        title="Financial Snapshot"
        subtitle={`Current rent collection and outstanding balance overview for ${financial.period.month}.`}
        action={
          <Link to="/payments" style={compactButton}>
            Payments Workspace <ArrowRight size={16} />
          </Link>
        }
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: spacing.md, alignItems: "center" }}>
        <div style={{ display: "grid", placeItems: "center", gap: 10 }}>
          <div
            aria-label="Collection mix"
            style={{
              width: 150,
              height: 150,
              borderRadius: "50%",
              background:
                total > 0
                  ? `conic-gradient(#2563eb 0 ${collectedDegrees}deg, #f59e0b ${collectedDegrees}deg ${collectedDegrees + outstandingDegrees}deg, #cbd5e1 ${collectedDegrees + outstandingDegrees}deg 360deg)`
                  : "#e2e8f0",
              display: "grid",
              placeItems: "center",
            }}
          >
            <div style={{ width: 92, height: 92, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center", textAlign: "center", padding: 8 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{formatPercent(financial.rentCollectionRate)}</div>
                <div style={{ color: text.muted, fontSize: 12, fontWeight: 800 }}>Collected</div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", color: text.muted, fontSize: 12 }}>
            <LegendDot color="#2563eb" label="Collected" />
            <LegendDot color="#f59e0b" label="Outstanding" />
            <LegendDot color="#cbd5e1" label="Vacancy" />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 145px), 1fr))", gap: spacing.sm }}>
          <FinancialValue label="Expected" value={formatMoney(financial.expectedMonthlyRentCents)} />
          <FinancialValue label="Collected" value={formatMoney(financial.collectedCurrentMonthCents)} />
          <FinancialValue label="Outstanding" value={formatMoney(financial.outstandingCurrentMonthCents)} />
          <FinancialValue label="Vacancy Impact" value={formatMoney(financial.vacancyImpactCents)} />
        </div>
      </div>
      {flags.length > 0 ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", color: text.muted, fontSize: 13 }}>
          <MiniStateLabel state={state} />
          <span>Data quality: {flags.join(", ")}</span>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "center", color: "#047857", fontSize: 13 }}>
          <MiniStateLabel state={state} />
          <span>Financial source is available.</span>
        </div>
      )}
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", gap: 5, alignItems: "center", whiteSpace: "nowrap" }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 99, background: color }} />
      {label}
    </span>
  );
}

function FinancialValue({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gap: 6, padding: 12, borderRadius: 8, border: `1px solid ${colors.border}`, background: "#fff", minWidth: 0 }}>
      <div style={{ color: text.muted, fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ color: text.primary, fontSize: 20, fontWeight: 900, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
    </div>
  );
}

function DecisionQueuePreview({ queue }: { queue: LandlordDecisionQueueResponse }) {
  const items = queue.items.slice(0, 4);
  return (
    <Card style={sectionCard} data-testid="decision-queue-section">
      <SectionHeader
        icon={<ClipboardList size={18} />}
        title="Decision Queue Preview"
        subtitle="Highest-priority decisions needing attention."
        action={
          <Link to="/operations" style={compactButton}>
            View Full Queue <ArrowRight size={16} />
          </Link>
        }
      />
      {items.length === 0 ? (
        <div style={{ border: `1px solid ${colors.border}`, borderRadius: 8, padding: 14, color: text.muted }}>
          No open decisions. New operational decisions will appear here before routing to their owning workspace.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((item) => (
            <DecisionRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </Card>
  );
}

function DecisionRow({ item }: { item: LandlordDecisionQueueItem }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "center",
        flexWrap: "wrap",
        padding: 12,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        background: "#fff",
      }}
    >
      <div style={{ display: "grid", gap: 5, minWidth: 0, flex: "1 1 240px" }}>
        <div style={{ fontWeight: 850, color: text.primary, overflowWrap: "anywhere" }}>{item.title || "Review required"}</div>
        <div style={{ color: text.muted, fontSize: 13, lineHeight: 1.35, overflowWrap: "anywhere" }}>
          {workspaceLabel(item.workspace)} workspace · {formatDate(item.dueAt)}
        </div>
        <span style={{ ...severityStyle(item.severity), borderRadius: 8, padding: "3px 8px", fontSize: 12, fontWeight: 850, width: "fit-content", whiteSpace: "nowrap" }}>
          {item.severity.replace(/_/g, " ")}
        </span>
      </div>
      <Link to={operationalHref(item)} style={{ ...compactButton, width: "fit-content" }}>
        Open
      </Link>
    </div>
  );
}

function UpcomingActions({ queue }: { queue: LandlordDecisionQueueResponse | null }) {
  const actions = (queue?.items || [])
    .filter((item) => item.dueAt || item.severity === "upcoming")
    .slice(0, 4);
  return (
    <Card style={sectionCard} data-testid="upcoming-actions-section">
      <SectionHeader
        icon={<ListChecks size={18} />}
        title="Upcoming Actions"
        subtitle="Time-sensitive next steps from the operations queue."
        action={
          <Link to="/operations?status=open_state" style={compactButton}>
            Open Operations <ArrowRight size={16} />
          </Link>
        }
      />
      {actions.length === 0 ? (
        <div style={{ border: `1px solid ${colors.border}`, borderRadius: 8, padding: 14, color: text.muted }}>
          No dated actions are due right now. When lease, payment, notice, or maintenance decisions have dates, they appear here.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {actions.map((item) => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, borderBottom: `1px solid ${colors.border}`, paddingBottom: 10, alignItems: "center" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, overflowWrap: "anywhere" }}>{item.title}</div>
                <div style={{ color: text.muted, fontSize: 13 }}>{workspaceLabel(item.workspace)} · {formatDate(item.dueAt)}</div>
              </div>
              <Link to={operationalHref(item)} aria-label={`Open ${item.title}`} style={{ ...compactButton, flex: "0 0 auto" }}>
                <ArrowRight size={16} />
              </Link>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function CalendarPreviewPanel({ queue }: { queue: LandlordDecisionQueueResponse | null }) {
  const [view, setView] = React.useState<"week" | "month">("week");
  const today = React.useMemo(() => startOfDay(new Date()), []);
  const weekDays = React.useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(today, index)), [today]);
  const monthDays = React.useMemo(() => {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    return Array.from({ length: new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() }, (_, index) => addDays(monthStart, index));
  }, [today]);
  const datedItems = React.useMemo(
    () =>
      (queue?.items || [])
        .map((item) => {
          const date = item.dueAt ? new Date(item.dueAt) : null;
          return date && !Number.isNaN(date.getTime()) ? { item, date } : null;
        })
        .filter((entry): entry is { item: LandlordDecisionQueueItem; date: Date } => Boolean(entry))
        .sort((left, right) => left.date.getTime() - right.date.getTime()),
    [queue]
  );
  const days = view === "week" ? weekDays : monthDays;
  const visibleItems = datedItems.filter(({ date }) =>
    view === "week"
      ? date >= today && date < addDays(today, 7)
      : isSameCalendarMonth(date, today)
  );

  return (
    <Card style={sectionCard} data-testid="calendar-preview-section">
      <SectionHeader
        icon={<CalendarDays size={18} />}
        title="Calendar Preview"
        subtitle="Quick weekly view of dated operational follow-up."
        action={
          <Link to="/scheduling" style={compactButton}>
            Open Full Schedule <ArrowRight size={16} />
          </Link>
        }
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} aria-label="Calendar view">
        {(["week", "month"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setView(option)}
            style={{
              ...compactButton,
              minHeight: 34,
              padding: "6px 10px",
              background: view === option ? "#eff6ff" : "#fff",
              borderColor: view === option ? "#bfdbfe" : colors.borderStrong,
              color: view === option ? "#1d4ed8" : text.primary,
            }}
          >
            {option === "week" ? "7-day view" : "Month view"}
          </button>
        ))}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: view === "week" ? "repeat(7, minmax(78px, 1fr))" : "repeat(auto-fit, minmax(46px, 1fr))",
          gap: 8,
          overflowX: view === "week" ? "auto" : "visible",
          paddingBottom: view === "week" ? 4 : 0,
        }}
      >
        {days.map((day) => {
          const dayItems = datedItems.filter(({ date }) => isSameCalendarDay(date, day)).slice(0, view === "week" ? 2 : 1);
          return (
            <div
              key={day.toISOString()}
              style={{
                display: "grid",
                gap: 6,
                alignContent: "start",
                minHeight: view === "week" ? 96 : 58,
                minWidth: view === "week" ? 78 : 0,
                padding: view === "week" ? 10 : 8,
                borderRadius: 8,
                border: `1px solid ${isSameCalendarDay(day, today) ? "#bfdbfe" : colors.border}`,
                background: isSameCalendarDay(day, today) ? "#eff6ff" : "#fff",
              }}
            >
              <div style={{ display: "grid", gap: 2 }}>
                <div style={{ color: text.muted, fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>{formatShortWeekday(day)}</div>
                <div style={{ color: text.primary, fontSize: view === "week" ? 16 : 13, fontWeight: 900, whiteSpace: "nowrap" }}>
                  {view === "week" ? formatShortMonthDay(day) : day.getDate()}
                </div>
              </div>
              {dayItems.map(({ item }) => (
                <Link
                  key={item.id}
                  to={operationalHref(item)}
                  style={{
                    color: "#1d4ed8",
                    fontSize: 12,
                    fontWeight: 800,
                    lineHeight: 1.25,
                    textDecoration: "none",
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: view === "week" ? 2 : 1,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {item.title || "Review item"}
                </Link>
              ))}
              {view === "month" && dayItems.length > 0 ? (
                <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 99, background: "#2563eb" }} />
              ) : null}
            </div>
          );
        })}
      </div>
      {visibleItems.length === 0 ? (
        <div style={{ border: `1px solid ${colors.border}`, borderRadius: 8, padding: 12, color: text.muted }}>
          No dated schedule items are visible for this {view === "week" ? "week" : "month"}. Upcoming dated decisions will appear here.
        </div>
      ) : null}
    </Card>
  );
}

function WorkspaceRoutingSection() {
  const routes = [
    { label: "Operations full queue", href: "/operations", icon: <ClipboardList size={17} />, helper: "Execution workspace" },
    { label: "Properties", href: "/properties", icon: <Building2 size={17} />, helper: "Portfolio records" },
    { label: "Leases", href: "/leases", icon: <Route size={17} />, helper: "Lease workspace" },
    { label: "Payments", href: "/payments", icon: <WalletCards size={17} />, helper: "Financial workspace" },
  ];
  return (
    <Card style={sectionCard} data-testid="workspace-routing-section">
      <SectionHeader
        icon={<Route size={18} />}
        title="Portfolio Detail / Workspace Routing"
        subtitle="Open the workspace that owns the next action."
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))", gap: spacing.sm }}>
        {routes.map((route) => (
          <Link
            key={route.href}
            to={route.href}
            style={{
              display: "grid",
              gap: 8,
              minHeight: 88,
              padding: 14,
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              background: "#fff",
              color: text.primary,
              textDecoration: "none",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <span style={{ color: "#1d4ed8" }}>{route.icon}</span>
              <ArrowRight size={16} color={text.subtle} />
            </div>
            <div>
              <div style={{ fontWeight: 850 }}>{route.label}</div>
              <div style={{ color: text.muted, fontSize: 13, marginTop: 3 }}>{route.helper}</div>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const isNarrow = useNarrowDashboardLayout();
  const [portfolio, setPortfolio] = React.useState<Loadable<LandlordPortfolioStatusFinancialResponse>>({
    data: null,
    loading: true,
    error: null,
  });
  const [queue, setQueue] = React.useState<Loadable<LandlordDecisionQueueResponse>>({
    data: null,
    loading: true,
    error: null,
  });
  const [counts, setCounts] = React.useState<Loadable<PortfolioCounts>>({
    data: null,
    loading: true,
    error: null,
  });
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    const periodMonth = getCurrentMonth();

    setPortfolio((current) => ({ ...current, loading: true, error: null }));
    setQueue((current) => ({ ...current, loading: true, error: null }));
    setCounts((current) => ({ ...current, loading: true, error: null }));

    void fetchLandlordPortfolioStatusFinancial({ periodMonth })
      .then((data) => {
        if (alive) setPortfolio({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (alive) setPortfolio({ data: null, loading: false, error: errorMessage(error, "Portfolio status could not load.") });
      });

    void fetchLandlordDecisionQueue({ status: "open_state", limit: 6 })
      .then((data) => {
        if (alive) setQueue({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (alive) setQueue({ data: null, loading: false, error: errorMessage(error, "Decision queue could not load.") });
      });

    void Promise.allSettled([
      fetchApplications(),
      fetchTenants(),
      listWorkOrders(),
      listLandlordMaintenance(),
      fetchUnifiedInbox("landlord"),
    ])
      .then(([applicationsResult, tenantsResult, workOrdersResult, maintenanceResult, inboxResult]) => {
        if (!alive) return;
        const applications = applicationsResult.status === "fulfilled" && Array.isArray(applicationsResult.value) ? applicationsResult.value : null;
        const tenants = tenantsResult.status === "fulfilled" && Array.isArray(tenantsResult.value) ? tenantsResult.value : null;
        const workOrders = workOrdersResult.status === "fulfilled" && Array.isArray(workOrdersResult.value) ? workOrdersResult.value : null;
        const maintenanceRequests =
          maintenanceResult.status === "fulfilled" && Array.isArray(maintenanceResult.value?.items)
            ? maintenanceResult.value.items
            : maintenanceResult.status === "fulfilled" && Array.isArray(maintenanceResult.value?.data)
              ? maintenanceResult.value.data
              : null;
        const inbox = inboxResult.status === "fulfilled" ? inboxResult.value : null;

        setCounts({
          data: {
            applicationsPending: applications ? applications.filter(isPendingApplication).length : null,
            tenants: tenants ? tenants.length : null,
            maintenanceRequests: maintenanceRequests ? maintenanceRequests.filter(isOpenMaintenanceRequest).length : null,
            workOrders: workOrders ? workOrders.filter(isOpenWorkOrder).length : null,
            unifiedMessages: typeof inbox?.total === "number" ? inbox.total : Array.isArray(inbox?.items) ? inbox.items.length : null,
          },
          loading: false,
          error:
            applicationsResult.status === "rejected" ||
            tenantsResult.status === "rejected" ||
            workOrdersResult.status === "rejected" ||
            maintenanceResult.status === "rejected" ||
            inboxResult.status === "rejected"
              ? "Some portfolio counts could not load."
              : null,
        });
      })
      .catch((error) => {
        if (alive) setCounts({ data: null, loading: false, error: errorMessage(error, "Portfolio counts could not load.") });
      });

    return () => {
      alive = false;
    };
  }, [refreshKey]);

  const generatedAt = portfolio.data?.generatedAt || queue.data?.generatedAt || null;
  const portfolioState = metricState(portfolio.data?.confidence.occupancy);
  const financialState = metricState(portfolio.data?.confidence.financial);

  return (
    <MacShell title="RentChain · Dashboard 2.0" showTopNav={false} maxWidth={1320}>
      <div style={{ display: "grid", gap: spacing.lg, minWidth: 0 }}>
        <div
          data-testid="dashboard-operational-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: spacing.lg,
          }}
        >
          {portfolio.loading ? (
            <LoadingSection title="Portfolio Health" />
          ) : portfolio.error ? (
            <ErrorSection title="Portfolio Health" message={portfolio.error} onRetry={() => setRefreshKey((key) => key + 1)} />
          ) : portfolio.data ? (
            <PortfolioHealthSection portfolio={portfolio.data} />
          ) : null}

          <PortfolioCountsRow portfolio={portfolio.data} counts={counts} />

          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <StatusPill state={portfolioState} />
              <StatusPill state={financialState} />
              <span style={{ color: text.subtle, fontSize: 13, alignSelf: "center" }}>
                {generatedAt ? `Generated ${new Date(generatedAt).toLocaleString()}` : "Generating current state"}
              </span>
            </div>
            <button type="button" onClick={() => setRefreshKey((key) => key + 1)} style={compactButton}>
              Refresh
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isNarrow ? "1fr" : "minmax(0, 1.15fr) minmax(300px, 0.85fr)",
              gap: spacing.lg,
              minWidth: 0,
            }}
          >
            <div style={{ display: "grid", gap: spacing.lg, minWidth: 0 }}>
              {queue.loading ? (
                <LoadingSection title="Decision Queue Preview" />
              ) : queue.error ? (
                <ErrorSection title="Decision Queue Preview" message={queue.error} onRetry={() => setRefreshKey((key) => key + 1)} />
              ) : queue.data ? (
                <DecisionQueuePreview queue={queue.data} />
              ) : null}
            </div>
            <aside style={{ display: "grid", gap: spacing.lg, alignContent: "start", minWidth: 0 }}>
              {queue.loading ? <LoadingSection title="Upcoming Actions" /> : <UpcomingActions queue={queue.data} />}
            </aside>
          </div>

          {queue.loading ? <LoadingSection title="Calendar Preview" /> : <CalendarPreviewPanel queue={queue.data} />}

          {portfolio.loading ? (
            <LoadingSection title="Financial Snapshot" />
          ) : portfolio.error ? (
            <ErrorSection title="Financial Snapshot" message={portfolio.error} onRetry={() => setRefreshKey((key) => key + 1)} />
          ) : portfolio.data ? (
            <FinancialSnapshotSection portfolio={portfolio.data} />
          ) : null}

          <WorkspaceRoutingSection />
        </div>
      </div>
    </MacShell>
  );
}
