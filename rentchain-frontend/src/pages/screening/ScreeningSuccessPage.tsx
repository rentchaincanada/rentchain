import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, Section, Button } from "../../components/ui/Ui";
import { spacing, text } from "../../styles/tokens";
import {
  fetchScreening,
  type ScreeningPipeline,
} from "../../api/rentalApplicationsApi";
import {
  getScreeningOrderStatus,
  reconcileScreeningOrder,
  type ScreeningOrderStatusView,
} from "../../api/screeningOrdersApi";
import {
  getScreeningJobStatus,
  type ScreeningJobStatusView,
} from "../../api/screeningJobsApi";
import { ScreeningStatusBadge } from "../../components/screening/ScreeningStatusBadge";

const ScreeningSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const applicationId = searchParams.get("applicationId") || "";
  const orderId = searchParams.get("orderId") || "";
  const rawReturnTo = searchParams.get("returnTo") || "/dashboard";
  const returnTo = rawReturnTo.startsWith("/") ? rawReturnTo : "/dashboard";
  const [status, setStatus] = useState<ScreeningPipeline | null>(null);
  const [orderStatus, setOrderStatus] = useState<ScreeningOrderStatusView | null>(null);
  const [jobStatus, setJobStatus] = useState<ScreeningJobStatusView | null>(null);
  const [jobStatusState, setJobStatusState] = useState<
    "processing" | "queued" | "running" | "provider_calling" | "completed" | "failed"
  >("processing");
  const [jobError, setJobError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<"processing" | "paid" | "failed" | "refunded" | "timeout">(
    "processing"
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const reconcileCountRef = useRef(0);
  const pollStartRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const jobTimerRef = useRef<number | null>(null);
  const jobPollStartRef = useRef(0);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  const clearJobTimer = () => {
    if (jobTimerRef.current) {
      window.clearTimeout(jobTimerRef.current);
      jobTimerRef.current = null;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
      clearJobTimer();
    };
  }, []);

  useEffect(() => {
    if (!applicationId) return;
    let active = true;
    fetchScreening(applicationId)
      .then((res) => {
        if (!active) return;
        if (res.ok) setStatus(res.screening || null);
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, [applicationId]);

  const loadStatus = async () => {
    const res = await getScreeningOrderStatus({ applicationId, orderId });
    if (!mountedRef.current) return null;
    if (!res.ok || !res.data) {
      setError(res.error || "Unable to fetch payment status.");
      return null;
    }
    setError(null);
    setOrderStatus(res.data);
    if (res.data.status === "paid") {
      setSyncState("paid");
      return res.data;
    }
    if (res.data.status === "failed") {
      setSyncState("failed");
      return res.data;
    }
    if (res.data.status === "refunded") {
      setSyncState("refunded");
      return res.data;
    }
    setSyncState("processing");
    return res.data;
  };

  const runReconcile = async () => {
    if (!applicationId && !orderId) return;
    const res = await reconcileScreeningOrder({ applicationId, orderId });
    if (!mountedRef.current) return;
    if (res.ok && res.data) {
      setOrderStatus(res.data);
      if (res.data.status === "paid") {
        setSyncState("paid");
      } else if (res.data.status === "failed") {
        setSyncState("failed");
      } else if (res.data.status === "refunded") {
        setSyncState("refunded");
      }
      setError(null);
      return;
    }
    setError(res.error || "Unable to reconcile payment yet.");
  };

  const loadJobStatus = async (): Promise<
    "processing" | "queued" | "running" | "provider_calling" | "completed" | "failed" | null
  > => {
    const resolvedOrderId = orderStatus?.orderId || orderId || "";
    const resolvedApplicationId = applicationId || orderStatus?.applicationId || "";
    if (!resolvedOrderId && !resolvedApplicationId) return null;
    try {
      const res = await getScreeningJobStatus({
        orderId: resolvedOrderId || undefined,
        applicationId: resolvedApplicationId || undefined,
      });
      if (!mountedRef.current) return null;
      if (!res?.ok || !res?.data) return null;
      setJobStatus(res.data);
      setJobStatusState(res.data.status);
      setJobError(null);
      return res.data.status;
    } catch (err: any) {
      if (!mountedRef.current) return null;
      const message = String(err?.message || "").toLowerCase();
      if (message.includes("not_found")) {
        setJobStatus(null);
        setJobStatusState("queued");
        setJobError(null);
        return "queued";
      }
      setJobError("Unable to fetch screening job status.");
      return null;
    }
  };

  useEffect(() => {
    if (!applicationId && !orderId) {
      setLoading(false);
      return;
    }
    let active = true;
    pollStartRef.current = Date.now();
    reconcileCountRef.current = 0;

    const tick = async () => {
      if (!active || !mountedRef.current) return;
      const current = await loadStatus();
      if (!active || !mountedRef.current) return;
      setLoading(false);

      const currentState = current?.status || "unpaid";
      if (currentState === "paid" || currentState === "failed" || currentState === "refunded") {
        clearTimer();
        return;
      }

      const elapsed = Date.now() - pollStartRef.current;
      if (elapsed >= 15000 && reconcileCountRef.current < 2) {
        reconcileCountRef.current += 1;
        await runReconcile();
        if (!active || !mountedRef.current) return;
        if (syncState === "paid" || syncState === "failed" || syncState === "refunded") {
          clearTimer();
          return;
        }
      }

      if (elapsed >= 90000) {
        setSyncState("timeout");
        clearTimer();
        return;
      }

      const nextDelay = elapsed < 20000 ? 2000 : 5000;
      timerRef.current = window.setTimeout(tick, nextDelay);
    };

    void tick();
    return () => {
      active = false;
      clearTimer();
    };
  }, [applicationId, orderId]);

  useEffect(() => {
    const pipelineStatus = String(status?.status || "").toLowerCase();
    const shouldPollJob =
      syncState === "paid" ||
      pipelineStatus === "processing" ||
      pipelineStatus === "in_progress" ||
      pipelineStatus === "queued" ||
      pipelineStatus === "running" ||
      pipelineStatus === "paid";

    if (!shouldPollJob || (!applicationId && !orderId && !orderStatus?.orderId)) {
      return;
    }

    let active = true;
    jobPollStartRef.current = Date.now();
    setJobStatusState((prev) => (prev === "completed" || prev === "failed" ? prev : "processing"));

    const tickJob = async () => {
      if (!active || !mountedRef.current) return;
      const latest = await loadJobStatus();
      if (!active || !mountedRef.current) return;
      if (latest === "completed" || latest === "failed") {
        clearJobTimer();
        return;
      }

      const elapsed = Date.now() - jobPollStartRef.current;
      if (elapsed >= 60000) {
        clearJobTimer();
        return;
      }

      jobTimerRef.current = window.setTimeout(tickJob, 3000);
    };

    void tickJob();
    return () => {
      active = false;
      clearJobTimer();
    };
  }, [applicationId, orderId, orderStatus?.orderId, status?.status, syncState, orderStatus?.applicationId]);

  const jobPipelineText = useMemo(() => {
    switch (jobStatusState) {
      case "queued":
        return "Screening queued";
      case "running":
        return "Screening started";
      case "provider_calling":
        return "Contacting provider";
      case "completed":
        return "Screening complete";
      case "failed":
        return "Screening failed";
      default:
        return "Screening processing";
    }
  }, [jobStatusState]);

  const shortJobErrorMessage = useMemo(() => {
    const raw = String(jobStatus?.lastError?.message || "").trim();
    if (!raw) return null;
    return raw.length > 120 ? `${raw.slice(0, 120)}...` : raw;
  }, [jobStatus?.lastError?.message]);

  const orderBadge = useMemo(() => {
    if (syncState === "paid") return { label: "Payment received", tone: "success" as const };
    if (syncState === "failed") return { label: "Payment failed", tone: "danger" as const };
    if (syncState === "refunded") return { label: "Payment refunded", tone: "danger" as const };
    if (syncState === "timeout") return { label: "Verification pending", tone: "info" as const };
    return { label: "Processing payment...", tone: "info" as const };
  }, [syncState]);

  return (
    <Section style={{ maxWidth: 680, margin: "0 auto" }}>
      <Card elevated>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>
            Payment confirmation
          </h1>
          <div style={{ color: text.muted, fontSize: "0.95rem" }}>
            {syncState === "paid"
              ? "Payment received. Screening has started."
              : syncState === "timeout"
              ? "We’re verifying your payment. If this persists, refresh in a minute."
              : "Processing payment confirmation..."}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <ScreeningStatusBadge label={orderBadge.label} tone={orderBadge.tone} />
          </div>
          {loading ? <div style={{ color: text.subtle, fontSize: "0.85rem" }}>Checking payment status…</div> : null}
          {error ? <div style={{ color: "#b42318", fontSize: "0.85rem" }}>{error}</div> : null}
          {syncState === "timeout" || jobStatusState === "failed" ? (
            <div style={{ display: "flex", gap: spacing.xs, alignItems: "center" }}>
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  await runReconcile();
                  await loadJobStatus();
                }}
              >
                Refresh status
              </Button>
            </div>
          ) : null}
          <div style={{ color: text.subtle, fontSize: "0.85rem" }}>
            Pipeline: {jobPipelineText}
            {jobStatus?.status ? ` (${jobStatus.status})` : ""}
          </div>
          {jobStatusState === "failed" && shortJobErrorMessage ? (
            <div style={{ color: "#b42318", fontSize: "0.85rem" }}>{shortJobErrorMessage}</div>
          ) : null}
          {jobError ? <div style={{ color: text.subtle, fontSize: "0.8rem" }}>{jobError}</div> : null}
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            {applicationId ? (
              <Button
                type="button"
                onClick={() => navigate(`/applications?applicationId=${encodeURIComponent(applicationId)}`)}
              >
                Back to application
              </Button>
            ) : (
              <Button type="button" onClick={() => navigate(returnTo, { replace: true })}>
                Go to dashboard
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={() => navigate("/dashboard")}>
              Go to dashboard
            </Button>
          </div>
          {applicationId ? (
            <div style={{ color: text.subtle, fontSize: "0.85rem" }}>
              Application ID: {applicationId}
              {orderStatus?.orderId ? ` · Order ID: ${orderStatus.orderId}` : ""}
            </div>
          ) : null}
        </div>
      </Card>
    </Section>
  );
};

export default ScreeningSuccessPage;
