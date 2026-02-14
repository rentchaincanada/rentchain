import React, { useEffect, useMemo, useState } from "react";
import { MacShell } from "../../components/layout/MacShell";
import { Card, Section, Button, Input } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import {
  fetchAdminSummary,
  fetchAdminEventsSummary,
  fetchAdminMetrics,
  fetchStripeHealth,
  listAdminExpenses,
  createAdminExpense,
  type AdminExpense,
  type AdminEventsSummary,
  type AdminMetrics,
  type AdminSummary,
} from "../../api/adminDashboardApi";
import { adminSystems } from "./adminSystems";
import { colors, spacing, text, radius } from "../../styles/tokens";
import "./AdminDashboardPage.css";

const categories = ["All", ...Array.from(new Set(adminSystems.map((s) => s.category)))];

function formatCents(value: number) {
  const dollars = Math.round(Number(value || 0) / 100);
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(
    dollars
  );
}

export const AdminDashboardPage: React.FC = () => {
  const { showToast } = useToast();
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [stripeHealth, setStripeHealth] = useState<{ ok: boolean; stripeConfigured?: boolean } | null>(null);
  const [expenses, setExpenses] = useState<AdminExpense[]>([]);
  const [funnel, setFunnel] = useState<AdminEventsSummary>({ range: "month", counts: {} });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState("All");
  const [form, setForm] = useState({
    date: "",
    vendor: "",
    category: "",
    amountCents: "",
    notes: "",
  });

  const load = async () => {
    try {
      setLoading(true);
      const [summaryData, expensesData, metricsData, stripeHealthData, funnelData] = await Promise.all([
        fetchAdminSummary(),
        listAdminExpenses(),
        fetchAdminMetrics(),
        fetchStripeHealth(),
        fetchAdminEventsSummary("month"),
      ]);
      setSummary(summaryData);
      setExpenses(expensesData);
      setMetrics(metricsData);
      setStripeHealth(stripeHealthData);
      setFunnel(funnelData);
      setLastUpdated(Date.now());
    } catch (err: any) {
      showToast({ message: "Failed to load admin data", description: err?.message || "", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredSystems = useMemo(() => {
    if (filter === "All") return adminSystems;
    return adminSystems.filter((s) => s.category === filter);
  }, [filter]);

  const handleAddExpense = async () => {
    try {
      setSaving(true);
      const amountCents = Math.round(Number(form.amountCents || 0));
      const created = await createAdminExpense({
        date: form.date.trim(),
        vendor: form.vendor.trim(),
        category: form.category.trim(),
        amountCents,
        notes: form.notes.trim() || null,
      });
      setExpenses((prev) => [created, ...prev]);
      setShowAdd(false);
      setForm({ date: "", vendor: "", category: "", amountCents: "", notes: "" });
      showToast({ message: "Expense added", variant: "success" });
    } catch (err: any) {
      showToast({ message: "Failed to add expense", description: err?.message || "", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const summaryView = summary || {
    revenue: {
      mtdGrossCents: 0,
      mtdNetCents: 0,
      ytdGrossCents: 0,
      ytdNetCents: 0,
      last30dGrossCents: 0,
      last30dNetCents: 0,
    },
    marketing: {
      last30dVisitors: 0,
      last30dGetStartedClicks: 0,
      last30dSeePricingClicks: 0,
      last30dTemplateDownloads: 0,
      last30dHelpSearches: 0,
      ctaRatePricingToGetStarted: 0,
    },
    expenses: {
      mtdCents: 0,
      ytdCents: 0,
    },
  };

  const metricsView: AdminMetrics = metrics || {
    activeSubscribers: 0,
    mrrCents: 0,
    arrCents: 0,
    subscriptionsByTier: { starter: 0, pro: 0, business: 0, elite: 0 },
    screeningsPaidThisMonth: 0,
    screeningsPaidYtd: 0,
    screeningRevenueCentsThisMonth: 0,
    screeningRevenueCentsYtd: 0,
    upgradesStartedThisMonth: 0,
    upgradesCompletedThisMonth: 0,
  };

  return (
    <MacShell title="Admin · Dashboard">
      <Section className="rc-admin-page" style={{ display: "grid", gap: spacing.md }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.4rem" }}>Admin Dashboard</h1>
            <div style={{ fontSize: 12, color: text.muted }}>
              {lastUpdated ? `Last updated ${new Date(lastUpdated).toLocaleString()}` : "Not loaded"}
            </div>
          </div>
          <Button type="button" variant="secondary" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </div>

        <Card elevated>
          <Section style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ fontWeight: 700 }}>Subscription & Screening KPIs</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: spacing.sm }}>
              <Card style={{ padding: spacing.md }}>
                <div style={{ fontSize: 12, color: text.muted }}>Active subscribers</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{metricsView.activeSubscribers}</div>
              </Card>
              <Card style={{ padding: spacing.md }}>
                <div style={{ fontSize: 12, color: text.muted }}>MRR (CAD)</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{formatCents(metricsView.mrrCents)}</div>
              </Card>
              <Card style={{ padding: spacing.md }}>
                <div style={{ fontSize: 12, color: text.muted }}>ARR (CAD)</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{formatCents(metricsView.arrCents)}</div>
              </Card>
              <Card style={{ padding: spacing.md }}>
                <div style={{ fontSize: 12, color: text.muted }}>Screenings sold</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  {metricsView.screeningsPaidThisMonth} / {metricsView.screeningsPaidYtd}
                </div>
                <div style={{ fontSize: 12, color: text.muted }}>Month / YTD</div>
              </Card>
              <Card style={{ padding: spacing.md }}>
                <div style={{ fontSize: 12, color: text.muted }}>Screening revenue</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  {formatCents(metricsView.screeningRevenueCentsThisMonth)} / {formatCents(metricsView.screeningRevenueCentsYtd)}
                </div>
                <div style={{ fontSize: 12, color: text.muted }}>Month / YTD</div>
              </Card>
            </div>
          </Section>
        </Card>

        <Card elevated>
          <Section style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ fontWeight: 700 }}>Subscription mix</div>
            <div style={{ display: "grid", gap: spacing.xs }}>
              {(["starter", "pro", "business", "elite"] as const).map((tier) => {
                const count = metricsView.subscriptionsByTier?.[tier] || 0;
                const total = Math.max(metricsView.activeSubscribers, 1);
                const width = Math.max(8, Math.round((count / total) * 100));
                return (
                  <div key={tier} style={{ display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ textTransform: "capitalize", color: text.muted }}>{tier}</span>
                      <span style={{ fontWeight: 700 }}>{count}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: "rgba(148,163,184,0.2)", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${width}%`,
                          background: "rgba(37,99,235,0.85)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "grid", gap: 4, fontSize: 12, color: text.muted }}>
              <div>Upgrades started (month): {metricsView.upgradesStartedThisMonth || 0}</div>
              <div>Upgrades completed (month): {metricsView.upgradesCompletedThisMonth || 0}</div>
            </div>
          </Section>
        </Card>

        <Card elevated>
          <Section style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ fontWeight: 700 }}>Health</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background:
                    stripeHealth?.stripeConfigured === true
                      ? "#16a34a"
                      : stripeHealth?.stripeConfigured === false
                      ? "#dc2626"
                      : "#94a3b8",
                }}
              />
              <span style={{ color: text.muted }}>
                Stripe configured:{" "}
                <strong style={{ color: text.primary }}>
                  {stripeHealth?.stripeConfigured === true
                    ? "Yes"
                    : stripeHealth?.stripeConfigured === false
                    ? "No"
                    : "Unknown"}
                </strong>
              </span>
            </div>
          </Section>
        </Card>

        <Card elevated>
          <Section style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ fontWeight: 700 }}>Revenue</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: spacing.sm }}>
              <Card style={{ padding: spacing.md }}>
                <div style={{ fontSize: 12, color: text.muted }}>MTD</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{formatCents(summaryView.revenue.mtdGrossCents)}</div>
              </Card>
              <Card style={{ padding: spacing.md }}>
                <div style={{ fontSize: 12, color: text.muted }}>Last 30d</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{formatCents(summaryView.revenue.last30dGrossCents)}</div>
              </Card>
              <Card style={{ padding: spacing.md }}>
                <div style={{ fontSize: 12, color: text.muted }}>YTD</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{formatCents(summaryView.revenue.ytdGrossCents)}</div>
              </Card>
            </div>
          </Section>
        </Card>

        <Card elevated>
          <Section style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ fontWeight: 700 }}>Expenses</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: spacing.sm }}>
              <Card style={{ padding: spacing.md }}>
                <div style={{ fontSize: 12, color: text.muted }}>MTD</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{formatCents(summaryView.expenses.mtdCents)}</div>
              </Card>
              <Card style={{ padding: spacing.md }}>
                <div style={{ fontSize: 12, color: text.muted }}>YTD</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{formatCents(summaryView.expenses.ytdCents)}</div>
              </Card>
            </div>
          </Section>
        </Card>

        <Card elevated>
          <Section style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ fontWeight: 700 }}>Marketing</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: spacing.sm }}>
              <Card style={{ padding: spacing.md }}>
                <div style={{ fontSize: 12, color: text.muted }}>Visitors (30d)</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{summaryView.marketing.last30dVisitors}</div>
              </Card>
              <Card style={{ padding: spacing.md }}>
                <div style={{ fontSize: 12, color: text.muted }}>Get started (30d)</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{summaryView.marketing.last30dGetStartedClicks}</div>
              </Card>
              <Card style={{ padding: spacing.md }}>
                <div style={{ fontSize: 12, color: text.muted }}>Pricing clicks</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{summaryView.marketing.last30dSeePricingClicks}</div>
              </Card>
              <Card style={{ padding: spacing.md }}>
                <div style={{ fontSize: 12, color: text.muted }}>Template downloads</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{summaryView.marketing.last30dTemplateDownloads}</div>
              </Card>
              <Card style={{ padding: spacing.md }}>
                <div style={{ fontSize: 12, color: text.muted }}>Help searches</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{summaryView.marketing.last30dHelpSearches}</div>
              </Card>
              <Card style={{ padding: spacing.md }}>
                <div style={{ fontSize: 12, color: text.muted }}>CTA rate</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  {(summaryView.marketing.ctaRatePricingToGetStarted * 100).toFixed(1)}%
                </div>
              </Card>
            </div>
            <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
              <Button type="button" variant="secondary" onClick={() => window.open("/billing", "_blank")}>
                Pricing
              </Button>
              <Button type="button" variant="secondary" onClick={() => window.open("/help", "_blank")}>
                Help
              </Button>
              <Button type="button" variant="secondary" onClick={() => window.open("/site/legal", "_blank")}>
                Legal templates
              </Button>
            </div>
          </Section>
        </Card>

        <Card elevated>
          <Section style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ fontWeight: 700 }}>Funnel (last 30 days)</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: spacing.sm }}>
              <Card style={{ padding: spacing.md }}>
                <div style={{ fontSize: 12, color: text.muted }}>Pricing demo clicks</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{Number(funnel.counts.pricing_demo_clicked || 0)}</div>
              </Card>
              <Card style={{ padding: spacing.md }}>
                <div style={{ fontSize: 12, color: text.muted }}>Demo request access clicks</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{Number(funnel.counts.demo_request_access_clicked || 0)}</div>
              </Card>
              <Card style={{ padding: spacing.md }}>
                <div style={{ fontSize: 12, color: text.muted }}>Upgrade modal opened</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{Number(funnel.counts.upgrade_modal_opened || 0)}</div>
              </Card>
              <Card style={{ padding: spacing.md }}>
                <div style={{ fontSize: 12, color: text.muted }}>Upgrade CTA clicks</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  {Number(funnel.counts.upgrade_modal_upgrade_clicked || 0)}
                </div>
              </Card>
            </div>
          </Section>
        </Card>

        <Card elevated>
          <Section style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700 }}>Expenses</div>
              <Button type="button" variant="secondary" onClick={() => setShowAdd((prev) => !prev)}>
                {showAdd ? "Close" : "Add expense"}
              </Button>
            </div>

            {showAdd ? (
              <div style={{ display: "grid", gap: spacing.sm, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, color: text.muted }}>Date</div>
                  <Input
                    placeholder="YYYY-MM-DD"
                    value={form.date}
                    onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, color: text.muted }}>Vendor</div>
                  <Input
                    value={form.vendor}
                    onChange={(e) => setForm((prev) => ({ ...prev, vendor: e.target.value }))}
                  />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, color: text.muted }}>Category</div>
                  <Input
                    value={form.category}
                    onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, color: text.muted }}>Amount (cents)</div>
                  <Input
                    value={form.amountCents}
                    onChange={(e) => setForm((prev) => ({ ...prev, amountCents: e.target.value }))}
                  />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, color: text.muted }}>Notes</div>
                  <Input
                    value={form.notes}
                    onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
                <div style={{ alignSelf: "end" }}>
                  <Button type="button" onClick={handleAddExpense} disabled={saving}>
                    Save
                  </Button>
                </div>
              </div>
            ) : null}

            <div style={{ display: "grid", gap: spacing.xs }}>
              {expenses.length === 0 ? (
                <div style={{ fontSize: 13, color: text.muted }}>No expenses recorded.</div>
              ) : (
                expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="rc-admin-expense-row"
                    style={{
                      gap: spacing.sm,
                      padding: "8px 10px",
                      borderRadius: radius.sm,
                      border: `1px solid ${colors.border}`,
                      background: colors.panel,
                      fontSize: 13,
                    }}
                  >
                    <div>{expense.date}</div>
                    <div>{expense.vendor}</div>
                    <div>{expense.category}</div>
                    <div>{formatCents(expense.amountCents)}</div>
                    <div style={{ color: text.muted }}>{expense.notes || "-"}</div>
                  </div>
                ))
              )}
            </div>
          </Section>
        </Card>

        <Card elevated>
          <Section style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ fontWeight: 700 }}>Systems Directory</div>
            <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
              {categories.map((cat) => {
                const active = filter === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFilter(cat)}
                    style={{
                      borderRadius: radius.pill,
                      border: `1px solid ${active ? colors.accent : colors.border}`,
                      background: active ? "rgba(37,99,235,0.08)" : colors.card,
                      padding: "6px 12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "grid", gap: spacing.sm }}>
              {filteredSystems.map((sys) => (
                <div
                  key={sys.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: spacing.sm,
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.md,
                    padding: "10px 12px",
                    background: colors.panel,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{sys.name}</div>
                    <div style={{ fontSize: 12, color: text.muted }}>{sys.description}</div>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => window.open(sys.url, "_blank")}>
                    Open
                  </Button>
                </div>
              ))}
            </div>
          </Section>
        </Card>
      </Section>
    </MacShell>
  );
};

export default AdminDashboardPage;
