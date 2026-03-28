// @ts-nocheck
import React, { useEffect, useState } from "react";
import { MacShell } from "../components/layout/MacShell";
import { Card, Section, Button, Pill } from "../components/ui/Ui";
import { useToast } from "../components/ui/ToastProvider";
import {
  AdminScreening,
  listAdminScreenings,
  retryScreening,
  resendScreeningEmail,
  purgeExpiredScreenings,
} from "../api/adminScreeningsApi";
import { getProviderStatus, setFeatureFlag, ProviderStatus } from "../api/providerStatusApi";
import { colors, spacing, text, radius } from "../styles/tokens";
import AdminMicroLiveCard from "../components/admin/AdminMicroLiveCard";
import AdminWave0Card from "../components/admin/AdminWave0Card";
import {
  ScreeningOperation,
  completeAdminScreeningOp,
  cancelAdminScreeningOp,
  getAdminScreeningOp,
  getAdminScreeningOps,
  startAdminScreeningOp,
} from "../api/screeningOpsApi";
import { ScreeningOpsList } from "../components/admin/screeningOps/ScreeningOpsList";
import { ScreeningOpDetail } from "../components/admin/screeningOps/ScreeningOpDetail";

const AdminScreeningsPage: React.FC = () => {
  const { showToast } = useToast();
  const [screenings, setScreenings] = useState<AdminScreening[]>([]);
  const [operations, setOperations] = useState<ScreeningOperation[]>([]);
  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(null);
  const [selectedOperation, setSelectedOperation] = useState<ScreeningOperation | null>(null);
  const [operationsStatusFilter, setOperationsStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [operationsLoading, setOperationsLoading] = useState(false);
  const [operationActionLoading, setOperationActionLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [purgeCount, setPurgeCount] = useState<number | null>(null);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [flagUpdating, setFlagUpdating] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      if (!import.meta.env.PROD) {
        const data = await listAdminScreenings();
        setScreenings(data);
        const status = await getProviderStatus();
        setProviderStatus(status);
      }
    } catch (err: any) {
      showToast({
        message: "Failed to load screenings",
        description: err?.message,
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadOperations = async (nextSelectedId?: string | null, nextStatusFilter?: string) => {
    try {
      setOperationsLoading(true);
      const res = await getAdminScreeningOps({ status: nextStatusFilter || operationsStatusFilter || undefined });
      const items = res.operations || [];
      setOperations(items);
      const selectedId = nextSelectedId ?? selectedOperationId ?? items[0]?.id ?? null;
      setSelectedOperationId(selectedId);
      if (selectedId) {
        const detail = await getAdminScreeningOp(selectedId);
        setSelectedOperation(detail.operation);
      } else {
        setSelectedOperation(null);
      }
    } catch (err: any) {
      showToast({
        message: "Failed to load screening operations",
        description: err?.message,
        variant: "error",
      });
    } finally {
      setOperationsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    void loadOperations();
  }, []);

  const handleRetry = async (id: string) => {
    try {
      setActionId(id);
      await retryScreening(id);
      await load();
      showToast({ message: "Retry requested", variant: "success" });
    } catch (err: any) {
      showToast({
        message: "Retry failed",
        description: err?.message,
        variant: "error",
      });
    } finally {
      setActionId(null);
    }
  };

  const handleResend = async (id: string) => {
    try {
      setActionId(id);
      await resendScreeningEmail(id);
      showToast({ message: "Email resent", variant: "success" });
    } catch (err: any) {
      showToast({
        message: "Email resend failed",
        description: err?.message,
        variant: "error",
      });
    } finally {
      setActionId(null);
    }
  };

  const handlePurge = async () => {
    try {
      setLoading(true);
      const result = await purgeExpiredScreenings();
      setPurgeCount(result.deletedCount);
      await load();
      showToast({
        message: "Expired purged",
        description: `${result.deletedCount} screening(s) cleaned up.`,
        variant: "success",
      });
    } catch (err: any) {
      showToast({
        message: "Purge failed",
        description: err?.message,
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSingleKey = async (value: boolean) => {
    try {
      setFlagUpdating(true);
      await setFeatureFlag("useSingleKeyForNewScreenings", value);
      const status = await getProviderStatus();
      setProviderStatus(status);
      showToast({
        message: "Feature flag updated",
        variant: "success",
      });
    } catch (err: any) {
      showToast({
        message: "Failed to update flag",
        description: err?.message,
        variant: "error",
      });
    } finally {
      setFlagUpdating(false);
    }
  };

  const reloadOperations = async (nextSelectedId?: string | null, nextStatusFilter?: string) => {
    await loadOperations(nextSelectedId, nextStatusFilter);
  };

  const handleSelectOperation = async (id: string) => {
    setSelectedOperationId(id);
    try {
      setOperationsLoading(true);
      const detail = await getAdminScreeningOp(id);
      setSelectedOperation(detail.operation);
    } catch (err: any) {
      showToast({
        message: "Failed to load screening operation",
        description: err?.message,
        variant: "error",
      });
    } finally {
      setOperationsLoading(false);
    }
  };

  const handleStartOperation = async () => {
    if (!selectedOperationId) return;
    try {
      setOperationActionLoading(true);
      await startAdminScreeningOp(selectedOperationId);
      await reloadOperations(selectedOperationId);
      showToast({ message: "Screening marked in progress", variant: "success" });
    } catch (err: any) {
      showToast({
        message: "Unable to update screening",
        description: err?.message,
        variant: "error",
      });
    } finally {
      setOperationActionLoading(false);
    }
  };

  const handleCompleteOperation = async (payload: any) => {
    if (!selectedOperationId) return;
    try {
      setOperationActionLoading(true);
      await completeAdminScreeningOp(selectedOperationId, payload);
      await reloadOperations(selectedOperationId);
      showToast({ message: "Screening marked completed", variant: "success" });
    } catch (err: any) {
      showToast({
        message: "Unable to complete screening",
        description: err?.message,
        variant: "error",
      });
    } finally {
      setOperationActionLoading(false);
    }
  };

  const handleCancelOperation = async (payload: any) => {
    if (!selectedOperationId) return;
    try {
      setOperationActionLoading(true);
      await cancelAdminScreeningOp(selectedOperationId, payload);
      await reloadOperations(selectedOperationId);
      showToast({ message: "Screening cancelled", variant: "success" });
    } catch (err: any) {
      showToast({
        message: "Unable to cancel screening",
        description: err?.message,
        variant: "error",
      });
    } finally {
      setOperationActionLoading(false);
    }
  };

  return (
    <MacShell title="Admin · Screenings">
      <Section style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ margin: 0, fontSize: "1.3rem" }}>Admin · Screenings</h1>
          <div style={{ display: "flex", gap: spacing.sm }}>
            {!import.meta.env.PROD ? (
              <Button type="button" variant="secondary" onClick={handlePurge} disabled={loading}>
                Purge expired
              </Button>
            ) : null}
            {!import.meta.env.PROD ? (
              <Button type="button" onClick={load} disabled={loading}>
                Refresh
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={() => void loadOperations()} disabled={operationsLoading}>
              Refresh Ops
            </Button>
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gap: spacing.md,
            gridTemplateColumns: "minmax(280px, 360px) minmax(0, 1fr)",
          }}
        >
          <ScreeningOpsList
            operations={operations}
            loading={operationsLoading}
            selectedId={selectedOperationId}
            statusFilter={operationsStatusFilter}
            onStatusFilterChange={(value) => {
              setOperationsStatusFilter(value);
              void reloadOperations(null, value);
            }}
            onSelect={(id) => void handleSelectOperation(id)}
          />
          <ScreeningOpDetail
            operation={selectedOperation}
            actionLoading={operationActionLoading}
            onStart={() => void handleStartOperation()}
            onComplete={(payload) => void handleCompleteOperation(payload)}
            onCancel={(payload) => void handleCancelOperation(payload)}
          />
        </div>
        {!import.meta.env.PROD ? <AdminMicroLiveCard /> : null}
        {!import.meta.env.PROD ? <AdminWave0Card /> : null}
        {!import.meta.env.PROD && providerStatus && (
          <Card elevated>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: spacing.sm }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontWeight: 600 }}>Provider Control</div>
                <div style={{ fontSize: 12, color: text.muted }}>
                  Active provider: {providerStatus.activeProvider}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <Pill tone={providerStatus.configured ? "muted" : "accent"}>
                    {providerStatus.configured ? "Configured" : "Not configured"}
                  </Pill>
                  {providerStatus.requiredEnvMissing?.length ? (
                    <span style={{ fontSize: 12, color: colors.danger }}>
                      Missing: {providerStatus.requiredEnvMissing.join(", ")}
                    </span>
                  ) : null}
                </div>
                {providerStatus.lastErrorAt && (
                  <div style={{ fontSize: 12, color: text.muted }}>
                    Last provider error: {new Date(providerStatus.lastErrorAt).toLocaleString()}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: spacing.xs }}>
                <label style={{ fontSize: 12, color: text.primary }}>
                  Use SingleKey for new screenings
                </label>
                <input
                  type="checkbox"
                  onChange={(e) => handleToggleSingleKey(e.target.checked)}
                  disabled={flagUpdating}
                  checked={providerStatus.activeProvider === "singlekey"}
                  style={{ width: 16, height: 16 }}
                />
              </div>
            </div>
          </Card>
        )}
        {!import.meta.env.PROD && purgeCount !== null && (
          <div style={{ fontSize: 12, color: text.muted }}>
            Last purge removed {purgeCount} screening(s).
          </div>
        )}
        {!import.meta.env.PROD ? (
        <Card elevated>
          {loading ? (
            <div style={{ color: text.muted }}>Loading…</div>
          ) : screenings.length === 0 ? (
            <div style={{ color: text.muted }}>No screenings found.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {screenings.map((s) => (
                <div
                  key={s.id}
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.md,
                    padding: "10px 12px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: spacing.sm,
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Pill tone="muted">Status: {s.status}</Pill>
                      {s.providerName && (
                        <Pill tone="muted">Provider: {s.providerName}</Pill>
                      )}
                      {s.failureReason && (
                        <Pill tone="muted" style={{ backgroundColor: "rgba(239,68,68,0.15)" }}>
                          Failed: {s.failureReason}
                        </Pill>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: spacing.xs }}>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={actionId === s.id}
                        onClick={() => handleRetry(s.id)}
                      >
                        Retry
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={actionId === s.id}
                        onClick={() => handleResend(s.id)}
                      >
                        Resend email
                      </Button>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
                      gap: 6,
                      marginTop: 8,
                      fontSize: 12,
                      color: text.muted,
                    }}
                  >
                    <div>
                      <strong style={{ color: text.primary }}>Screening</strong>: {s.id}
                    </div>
                    <div>
                      <strong style={{ color: text.primary }}>Application</strong>:{" "}
                      {s.applicationId || "n/a"}
                    </div>
                    <div>
                      <strong style={{ color: text.primary }}>Provider ref</strong>:{" "}
                      {s.providerReferenceId || "n/a"}
                    </div>
                    <div>
                      <strong style={{ color: text.primary }}>Created</strong>:{" "}
                      {s.createdAt ? new Date(s.createdAt).toLocaleString() : "n/a"}
                    </div>
                    <div>
                      <strong style={{ color: text.primary }}>Completed</strong>:{" "}
                      {s.completedAt ? new Date(s.completedAt).toLocaleString() : "n/a"}
                    </div>
                    {s.lastProviderDurationMs !== undefined && (
                      <div>
                        <strong style={{ color: text.primary }}>Provider duration</strong>:{" "}
                        {s.lastProviderDurationMs}ms
                      </div>
                    )}
                    {s.lastWebhookEventId && (
                      <div>
                        <strong style={{ color: text.primary }}>Webhook event</strong>:{" "}
                        {s.lastWebhookEventId}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        ) : null}
      </Section>
    </MacShell>
  );
};

export default AdminScreeningsPage;
