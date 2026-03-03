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
  const [syncState, setSyncState] = useState<"processing" | "paid" | "failed" | "refunded" | "timeout">(
    "processing"
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const reconcileCountRef = useRef(0);
  const pollStartRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
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
          {syncState === "timeout" ? (
            <div style={{ display: "flex", gap: spacing.xs, alignItems: "center" }}>
              <Button type="button" variant="secondary" onClick={() => void runReconcile()}>
                Refresh status
              </Button>
            </div>
          ) : null}
          {status?.status ? (
            <div style={{ color: text.subtle, fontSize: "0.85rem" }}>Pipeline: {status.status}</div>
          ) : null}
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
