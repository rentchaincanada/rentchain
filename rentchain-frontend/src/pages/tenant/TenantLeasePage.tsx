import React from "react";
import {
  createTenantLeasePaymentCheckout,
  getTenantLeasePaymentStatus,
  getTenantLeaseWorkspace,
  signTenantLease,
} from "../../api/tenantPortal";
import {
  TenantEmptyState,
  TenantErrorState,
  TenantInfoCard,
  TenantKeyValueGrid,
  TenantLoadingState,
  TenantSurfaceShell,
  formatDate,
  formatMoney,
  prettyStatus,
} from "./TenantWorkspaceShared";

function prettyRentPaymentStatus(
  value: "setup_required" | "checkout_created" | "payment_pending" | "paid" | "failed" | "canceled" | "expired" | null | undefined
) {
  switch (value) {
    case "checkout_created":
      return "Checkout created";
    case "payment_pending":
      return "Payment pending";
    case "paid":
      return "Paid";
    case "failed":
      return "Failed";
    case "canceled":
      return "Canceled";
    case "expired":
      return "Expired";
    case "setup_required":
    default:
      return "Setup required";
  }
}

function formatPaymentExperienceStatus(value: "pending" | "paid" | "failed" | "canceled" | null | undefined) {
  switch (value) {
    case "pending":
      return "Pending";
    case "paid":
      return "Paid";
    case "failed":
      return "Failed";
    case "canceled":
      return "Canceled";
    default:
      return "No payment yet";
  }
}

export default function TenantLeasePage() {
  const [data, setData] = React.useState<Awaited<ReturnType<typeof getTenantLeaseWorkspace>>>(null);
  const [rentPaymentDetails, setRentPaymentDetails] = React.useState<Awaited<
    ReturnType<typeof getTenantLeasePaymentStatus>
  > | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [signing, setSigning] = React.useState(false);
  const [paying, setPaying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getTenantLeaseWorkspace());
    } catch (err: any) {
      setData(null);
      setError(err?.payload?.error || err?.message || "Unable to load lease details.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    let cancelled = false;
    const leaseId = String(data?.leaseId || "").trim();
    if (!leaseId) {
      setRentPaymentDetails(null);
      return;
    }
    (async () => {
      try {
        const next = await getTenantLeasePaymentStatus(leaseId);
        if (!cancelled) setRentPaymentDetails(next);
      } catch {
        if (!cancelled) setRentPaymentDetails(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data?.leaseId]);

  async function handleTenantSign() {
    if (!data?.leaseId) return;
    setSigning(true);
    setError(null);
    try {
      setData(await signTenantLease(data.leaseId));
    } catch (err: any) {
      setError(err?.payload?.error || err?.message || "Unable to record your lease signature.");
    } finally {
      setSigning(false);
    }
  }

  async function handlePayRent() {
    if (!data?.leaseId) return;
    setPaying(true);
    setError(null);
    try {
      const result = await createTenantLeasePaymentCheckout(data.leaseId);
      if (result?.redirectUrl) {
        window.location.assign(result.redirectUrl);
        return;
      }
      setError("Unable to start rent payment checkout.");
    } catch (err: any) {
      setError(err?.payload?.detail || err?.payload?.error || err?.message || "Unable to start rent payment checkout.");
    } finally {
      setPaying(false);
    }
  }

  const execution = data?.leaseExecution || null;
  const paymentReadiness = data?.paymentReadiness || null;
  const timelineRows = execution
    ? [
        {
          label: "Lease details",
          value:
            execution.executionStatus === "blocked"
              ? "Needs attention"
              : "Ready",
        },
        {
          label: "Tenant signature",
          value:
            execution.tenantSignatureStatus === "completed"
              ? "Completed"
              : execution.tenantSignatureStatus === "needed"
              ? "Needed"
              : execution.tenantSignatureStatus === "blocked"
              ? "Blocked"
              : "Not required",
        },
        {
          label: "Landlord signature",
          value:
            execution.landlordSignatureStatus === "completed"
              ? "Completed"
              : execution.landlordSignatureStatus === "needed"
              ? "Needed"
              : execution.landlordSignatureStatus === "blocked"
              ? "Blocked"
              : "Not required",
        },
        {
          label: "Fully executed",
          value: execution.executionStatus === "fully_executed" ? "Completed" : "Pending",
        },
      ]
    : [];

  return (
    <TenantSurfaceShell
      title="Lease"
      subtitle="Your lease page renders only the tenant-safe lease projection approved by the tenant foundation backend."
    >
      {loading ? <TenantLoadingState label="Loading lease details..." /> : null}
      {!loading && error ? <TenantErrorState message={error} retry={load} /> : null}
      {!loading && !error && !data ? (
        <TenantEmptyState
          title="No lease is available yet"
          body="Lease details will appear here once your active tenancy is available through the tenant workspace."
        />
      ) : null}
      {!loading && !error && data ? (
        <>
          <TenantInfoCard heading="Lease Summary" accent="#7c3aed">
            <TenantKeyValueGrid
              rows={[
                { label: "Status", value: prettyStatus(data.status) },
                { label: "Start date", value: formatDate(data.startDate) },
                { label: "End date", value: formatDate(data.endDate) },
                { label: "Monthly rent", value: formatMoney(data.monthlyRent) },
              ]}
            />
          </TenantInfoCard>

          {paymentReadiness ? (
            <TenantInfoCard heading="Payment readiness" accent="#1d4ed8">
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 800 }}>{paymentReadiness.readinessLabel}</div>
                  <div style={{ color: "var(--text-muted, #64748b)" }}>{paymentReadiness.readinessDescription}</div>
                </div>
                <TenantKeyValueGrid
                  rows={[
                    {
                      label: "Rent amount",
                      value: paymentReadiness.rentTerms.rentAmountAvailable ? "Available" : "Needed",
                    },
                    {
                      label: "Due day",
                      value: paymentReadiness.rentTerms.dueDateAvailable ? "Available" : "Needed",
                    },
                    {
                      label: "Lease dates",
                      value: paymentReadiness.rentTerms.leaseDatesAvailable ? "Available" : "Needed",
                    },
                    {
                      label: "Tenant linked",
                      value: paymentReadiness.rentTerms.tenantLinked ? "Linked" : "Needs review",
                    },
                    {
                      label: "Lease executed",
                      value: paymentReadiness.rentTerms.leaseExecuted ? "Complete" : "In progress",
                    },
                  ]}
                />
                {(rentPaymentDetails || data.rentPaymentSummary) ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <TenantKeyValueGrid
                      rows={[
                        {
                          label: "Rent collection",
                          value: (rentPaymentDetails || data.rentPaymentSummary)?.paymentRail.enabled ? "Enabled" : "Not enabled",
                        },
                        {
                          label: "Latest status",
                          value: formatPaymentExperienceStatus(
                            (rentPaymentDetails || data.rentPaymentSummary)?.paymentExperience?.latestStatus || null
                          ),
                        },
                      ]}
                    />
                    <div style={{ color: "var(--text-muted, #64748b)" }}>
                      Payment processed by Stripe. RentChain does not store card or bank payment details.
                    </div>
                    {((rentPaymentDetails || data.rentPaymentSummary)?.paymentExperience?.history || []).length ? (
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ fontWeight: 800 }}>Payment history</div>
                        {((rentPaymentDetails || data.rentPaymentSummary)?.paymentExperience?.history || []).map((entry) => (
                          <div
                            key={entry.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 12,
                              color: "var(--text-muted, #64748b)",
                              fontSize: "0.92rem",
                            }}
                          >
                            <span>{prettyRentPaymentStatus(entry.status)}</span>
                            <span>{formatDate(entry.paidAt || entry.updatedAt || entry.createdAt)}</span>
                            <span>{formatMoney(entry.amountCents / 100)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: "var(--text-muted, #64748b)" }}>No payment history yet.</div>
                    )}
                    {(rentPaymentDetails || data.rentPaymentSummary)?.paymentExperience?.receiptSummary?.available ? (
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ fontWeight: 800 }}>
                          {(rentPaymentDetails || data.rentPaymentSummary)?.paymentExperience?.receiptSummary.label}
                        </div>
                        <div style={{ color: "var(--text-muted, #64748b)" }}>
                          Lease {(rentPaymentDetails || data.rentPaymentSummary)?.paymentExperience?.receiptSummary
                            .leaseReference || "reference"}{" "}
                          ·{" "}
                          {formatMoney(
                            ((rentPaymentDetails || data.rentPaymentSummary)?.paymentExperience?.receiptSummary
                              ?.amountCents || 0) / 100
                          )}{" "}
                          ·{" "}
                          {formatDate(
                            (rentPaymentDetails || data.rentPaymentSummary)?.paymentExperience?.receiptSummary?.paidAt
                          )}
                        </div>
                        <div>
                          <button type="button" onClick={() => window.print()}>
                            Print / Save payment summary
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {(rentPaymentDetails || data.rentPaymentSummary)?.paymentRail.enabled &&
                    paymentReadiness.readinessStatus === "ready_to_configure" &&
                    (rentPaymentDetails || data.rentPaymentSummary)?.paymentExperience?.latestStatus !== "pending" &&
                    (rentPaymentDetails || data.rentPaymentSummary)?.paymentExperience?.latestStatus !== "paid" ? (
                      <button type="button" onClick={() => void handlePayRent()} disabled={paying}>
                        {paying
                          ? "Opening checkout..."
                          : (rentPaymentDetails || data.rentPaymentSummary)?.paymentExperience?.retryAvailable
                          ? "Retry payment"
                          : "Pay rent"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </TenantInfoCard>
          ) : null}

          <TenantInfoCard heading="Lease Document" accent="#0f766e">
            {data.leasePdfLabel ? (
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 800 }}>{data.leasePdfLabel}</div>
                {data.leasePdfDescription ? (
                  <div style={{ color: "var(--text-muted, #64748b)" }}>{data.leasePdfDescription}</div>
                ) : null}
              </div>
            ) : null}
            {data.documentUrl ? (
              <a href={data.documentUrl} target="_blank" rel="noreferrer">
                Open lease document
              </a>
            ) : (
              <div style={{ color: "var(--text-muted, #64748b)" }}>
                No approved lease document link is available in this workspace yet.
              </div>
            )}
          </TenantInfoCard>

          <TenantInfoCard heading="Lease Signing" accent="#7c3aed">
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 800 }}>{data.signatureReadinessLabel || "Lease signing unavailable"}</div>
                <div style={{ color: "var(--text-muted, #64748b)" }}>
                  {data.signatureReadinessDescription || "Lease signing details are not available in this workspace yet."}
                </div>
              </div>

              {data.tenantSignature ? (
                <TenantKeyValueGrid
                  rows={[
                    { label: "Signed at", value: formatDate(data.tenantSignature.signedAt) },
                    {
                      label: "Signature method",
                      value:
                        data.tenantSignature.signatureMethod === "drawn"
                          ? "Drawn signature"
                          : data.tenantSignature.signatureMethod === "typed"
                          ? "Typed signature"
                          : "—",
                    },
                    { label: "Signed by", value: data.tenantSignature.signatureDisplayName || "—" },
                  ]}
                />
              ) : null}
            </div>
          </TenantInfoCard>

          {execution ? (
            <TenantInfoCard heading="Lease Execution" accent="#0f172a">
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 800 }}>{execution.executionLabel}</div>
                  <div style={{ color: "var(--text-muted, #64748b)" }}>{execution.executionDescription}</div>
                </div>

                <TenantKeyValueGrid rows={timelineRows} />

                {execution.completedAt ? (
                  <div style={{ color: "var(--text-muted, #64748b)" }}>
                    Completed at {formatDate(execution.completedAt)}
                  </div>
                ) : null}

                {execution.requiredNextAction === "tenant_signature" && data?.leaseId ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <button type="button" onClick={() => void handleTenantSign()} disabled={signing}>
                      {signing ? "Recording signature..." : "Confirm tenant signature"}
                    </button>
                    <div style={{ color: "var(--text-muted, #64748b)" }}>
                      This records tenant signature metadata for the current lease workflow without storing any drawn signature image.
                    </div>
                  </div>
                ) : null}
              </div>
            </TenantInfoCard>
          ) : null}
        </>
      ) : null}
    </TenantSurfaceShell>
  );
}
