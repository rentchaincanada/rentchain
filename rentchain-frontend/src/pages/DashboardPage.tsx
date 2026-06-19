import React from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  ExternalLink,
  ListChecks,
  Route,
  WalletCards,
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

type Loadable<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

type MetricState = "trusted" | "degraded" | "unavailable";

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

function cleanFlags(flags: PortfolioDataQualityFlag[] | null | undefined): string[] {
  return (flags || []).slice(0, 3).map((flag) => flag.replace(/_/g, " "));
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

function MetricTile({
  label,
  value,
  state,
  helper,
}: {
  label: string;
  value: string;
  state: MetricState;
  helper?: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        padding: 14,
        minWidth: 0,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div style={{ color: text.muted, fontSize: 13, fontWeight: 750 }}>{label}</div>
        <StatusPill state={state} />
      </div>
      <div style={{ color: text.primary, fontSize: 26, fontWeight: 850, lineHeight: 1 }}>{value}</div>
      {helper ? <div style={{ color: text.subtle, fontSize: 13, lineHeight: 1.45 }}>{helper}</div> : null}
    </div>
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
          <div style={{ color: text.muted, fontSize: 14, lineHeight: 1.45 }}>{subtitle}</div>
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

function PortfolioStatusSection({ portfolio }: { portfolio: LandlordPortfolioStatusFinancialResponse }) {
  const status = portfolio.portfolioStatus;
  const state = metricState(portfolio.confidence.occupancy);
  const flags = cleanFlags(status.dataQualityFlags);
  return (
    <Card style={sectionCard} data-testid="portfolio-status-section">
      <SectionHeader
        icon={<Building2 size={18} />}
        title="Portfolio Status"
        subtitle="The current operating position across properties, units, and leases."
        action={
          <Link to="/portfolio-health" style={compactButton}>
            Portfolio detail <ArrowRight size={16} />
          </Link>
        }
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))", gap: spacing.sm }}>
        <MetricTile label="Occupancy" value={formatPercent(status.occupancyRate)} state={state} helper={`${status.occupiedUnits} occupied, ${status.vacantUnits} vacant`} />
        <MetricTile label="Current leases" value={String(status.currentLeaseCount)} state={state} helper={`${status.noticePeriodUnits} in notice, ${status.signedFutureLeaseCount} upcoming`} />
        <MetricTile label="Review units" value={String(status.reviewRequiredUnits)} state={state} helper="Conflicts stay visible instead of changing counts silently." />
      </div>
      {flags.length > 0 ? (
        <div style={{ color: text.muted, fontSize: 13 }}>Data quality: {flags.join(", ")}</div>
      ) : (
        <div style={{ color: "#047857", fontSize: 13 }}>No portfolio data-quality flags reported.</div>
      )}
    </Card>
  );
}

function FinancialSnapshotSection({ portfolio }: { portfolio: LandlordPortfolioStatusFinancialResponse }) {
  const financial = portfolio.financialSnapshot;
  const state = metricState(portfolio.confidence.financial);
  const flags = cleanFlags(financial.dataQualityFlags);
  return (
    <Card style={sectionCard} data-testid="financial-snapshot-section">
      <SectionHeader
        icon={<Banknote size={18} />}
        title="Financial Snapshot"
        subtitle={`Rent collection view for ${financial.period.month}. Missing sources degrade individual metrics, not the whole dashboard.`}
        action={
          <Link to="/payments" style={compactButton}>
            Payments workspace <ArrowRight size={16} />
          </Link>
        }
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))", gap: spacing.sm }}>
        <MetricTile label="Expected rent" value={formatMoney(financial.expectedMonthlyRentCents)} state={state} helper={`${financial.activeLeaseRentTermsCount} leases with rent terms`} />
        <MetricTile label="Collected" value={formatMoney(financial.collectedCurrentMonthCents)} state={state} helper={`Collection rate ${formatPercent(financial.rentCollectionRate)}`} />
        <MetricTile label="Outstanding" value={formatMoney(financial.outstandingCurrentMonthCents)} state={state} helper={`${financial.leasesMissingRentTermsCount} leases missing terms`} />
      </div>
      {flags.length > 0 ? (
        <div style={{ color: text.muted, fontSize: 13 }}>Data quality: {flags.join(", ")}</div>
      ) : (
        <div style={{ color: "#047857", fontSize: 13 }}>No financial data-quality flags reported.</div>
      )}
    </Card>
  );
}

function DecisionQueuePreview({ queue }: { queue: LandlordDecisionQueueResponse }) {
  const items = queue.items.slice(0, 4);
  return (
    <Card style={sectionCard} data-testid="decision-queue-section">
      <SectionHeader
        icon={<ClipboardList size={18} />}
        title="Decision Queue Preview"
        subtitle="The most important open decisions. Full triage and execution stay in Operations."
        action={
          <Link to="/operations" style={compactButton}>
            Full queue <ArrowRight size={16} />
          </Link>
        }
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: spacing.sm }}>
        <MetricTile label="Open" value={String(queue.summary.open)} state="trusted" />
        <MetricTile label="Needs review" value={String(queue.summary.needsReview)} state={queue.summary.needsReview > 0 ? "degraded" : "trusted"} />
        <MetricTile label="Blocked" value={String(queue.summary.blocked)} state={queue.summary.blocked > 0 ? "degraded" : "trusted"} />
      </div>
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
        display: "grid",
        gap: 8,
        padding: 12,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ ...severityStyle(item.severity), borderRadius: 8, padding: "3px 8px", fontSize: 12, fontWeight: 850 }}>
          {item.severity.replace(/_/g, " ")}
        </span>
        <span style={{ border: `1px solid ${colors.border}`, borderRadius: 8, padding: "3px 8px", color: text.muted, fontSize: 12, fontWeight: 800 }}>
          {workspaceLabel(item.workspace)}
        </span>
        <span style={{ color: text.subtle, fontSize: 12 }}>{formatDate(item.dueAt)}</span>
      </div>
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontWeight: 850, color: text.primary, overflowWrap: "anywhere" }}>{item.title || "Review required"}</div>
        <div style={{ color: text.muted, fontSize: 14, lineHeight: 1.45, overflowWrap: "anywhere" }}>{item.description || "Open the workspace to review the next step."}</div>
      </div>
      <Link to={operationalHref(item)} style={{ ...compactButton, width: "fit-content" }}>
        {item.recommendedActionLabel || "Open workspace"} <ExternalLink size={15} />
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
        subtitle="Time-bound work derived from normalized decision items."
        action={
          <Link to="/operations?status=open_state" style={compactButton}>
            Operations <ArrowRight size={16} />
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
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, borderBottom: `1px solid ${colors.border}`, paddingBottom: 10 }}>
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
        subtitle="Dashboard summarizes. Operations and owning workspaces handle execution."
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
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    const periodMonth = getCurrentMonth();

    setPortfolio((current) => ({ ...current, loading: true, error: null }));
    setQueue((current) => ({ ...current, loading: true, error: null }));

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

    return () => {
      alive = false;
    };
  }, [refreshKey]);

  const generatedAt = portfolio.data?.generatedAt || queue.data?.generatedAt || null;
  const portfolioState = metricState(portfolio.data?.confidence.occupancy);
  const financialState = metricState(portfolio.data?.confidence.financial);

  return (
    <MacShell title="RentChain · Dashboard 2.0" showTopNav={false}>
      <div style={{ display: "grid", gap: spacing.lg, minWidth: 0 }}>
        <header style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: "clamp(1.6rem, 3vw, 2.15rem)", letterSpacing: 0, color: text.primary }}>
                Operational Home
              </h1>
              <div style={{ color: text.muted, lineHeight: 1.55, maxWidth: 760 }}>
                Portfolio health, decisions, upcoming work, and financial state in one place. Execution stays in Operations and owning workspaces.
              </div>
            </div>
            <button type="button" onClick={() => setRefreshKey((key) => key + 1)} style={compactButton}>
              Refresh
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <StatusPill state={portfolioState} />
            <StatusPill state={financialState} />
            <span style={{ color: text.subtle, fontSize: 13, alignSelf: "center" }}>
              {generatedAt ? `Generated ${new Date(generatedAt).toLocaleString()}` : "Generating current state"}
            </span>
          </div>
        </header>

        <div
          data-testid="dashboard-operational-grid"
          style={{
            display: "grid",
            gridTemplateColumns: isNarrow ? "1fr" : "minmax(0, 1.25fr) minmax(280px, 0.75fr)",
            gap: spacing.lg,
          }}
        >
          <div style={{ display: "grid", gap: spacing.lg, minWidth: 0 }}>
            {portfolio.loading ? (
              <LoadingSection title="Portfolio Status" />
            ) : portfolio.error ? (
              <ErrorSection title="Portfolio Status" message={portfolio.error} onRetry={() => setRefreshKey((key) => key + 1)} />
            ) : portfolio.data ? (
              <PortfolioStatusSection portfolio={portfolio.data} />
            ) : null}

            {queue.loading ? (
              <LoadingSection title="Decision Queue Preview" />
            ) : queue.error ? (
              <ErrorSection title="Decision Queue Preview" message={queue.error} onRetry={() => setRefreshKey((key) => key + 1)} />
            ) : queue.data ? (
              <DecisionQueuePreview queue={queue.data} />
            ) : null}

            <WorkspaceRoutingSection />
          </div>

          <aside style={{ display: "grid", gap: spacing.lg, alignContent: "start", minWidth: 0 }}>
            {queue.loading ? <LoadingSection title="Upcoming Actions" /> : <UpcomingActions queue={queue.data} />}
            {portfolio.loading ? (
              <LoadingSection title="Financial Snapshot" />
            ) : portfolio.error ? (
              <ErrorSection title="Financial Snapshot" message={portfolio.error} onRetry={() => setRefreshKey((key) => key + 1)} />
            ) : portfolio.data ? (
              <FinancialSnapshotSection portfolio={portfolio.data} />
            ) : null}
          </aside>
        </div>
      </div>
    </MacShell>
  );
}
