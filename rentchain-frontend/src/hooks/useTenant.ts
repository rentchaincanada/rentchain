// src/hooks/useTenant.ts
import { useEffect, useState } from "react";
import {
  Tenant,
  TenantLease,
  TenantPayment,
  TenantLedgerEvent,
  TenantAiInsight,
} from "../types/tenant";
import api from "../api/client";

interface UseTenantOptions {
  tenantId: string | null;
  initialTenant: Tenant | null;
  reloadKey?: number;
}

interface UseTenantResult {
  tenant: Tenant | null;
  lease: TenantLease | null;
  payments: TenantPayment[];
  ledger: TenantLedgerEvent[];
  insights: TenantAiInsight[];
  loading: boolean;
  error: string | null;
}

export function useTenant({
  tenantId,
  initialTenant,
  reloadKey = 0,
}: UseTenantOptions): UseTenantResult {
  const [tenant, setTenant] = useState<Tenant | null>(initialTenant ?? null);
  const [lease, setLease] = useState<TenantLease | null>(null);
  const [payments, setPayments] = useState<TenantPayment[]>([]);
  const [ledger, setLedger] = useState<TenantLedgerEvent[]>([]);
  const [insights, setInsights] = useState<TenantAiInsight[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // No tenant selected
    if (!tenantId) {
      setTenant(null);
      setLease(null);
      setPayments([]);
      setLedger([]);
      setInsights([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await api.get(`/tenants/${tenantId}`);
        const data = res.data;

        if (cancelled) return;

        setTenant(data.tenant ?? null);
        setLease(data.lease ?? null);
        setPayments(Array.isArray(data.payments) ? data.payments : []);
        setLedger(Array.isArray(data.ledger) ? data.ledger : []);
        setInsights(Array.isArray(data.insights) ? data.insights : []);
        setLoading(false);
      } catch (err: any) {
        console.error("[useTenant] failed to load tenant detail", err);
        if (cancelled) return;
        setError(err?.message ?? "Failed to load tenant detail");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tenantId, reloadKey]);

  return {
    tenant,
    lease,
    payments,
    ledger,
    insights,
    loading,
    error,
  };
}
