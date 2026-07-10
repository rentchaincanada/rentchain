import React from "react";
import {
  createTenantLeasePaymentCheckout,
  getTenantLeasePaymentStatus,
  getTenantLeaseWorkspace,
  refreshTenantLeaseDocumentUrl,
  signTenantLease,
} from "../../api/tenantPortal";
import { SignedDocumentWorkspace } from "../../components/leases/SignedDocumentWorkspace";
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
import {
  describeRentPaymentGuidance,
  formatPaymentExperienceStatus,
  mapRentPaymentCheckoutErrorMessage,
  prettyRentPaymentStatus,
} from "../../lib/payments/paymentStatusGuidance";

function isGoogleStorageSignedUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname === "storage.googleapis.com" || url.hostname === "storage.cloud.google.com" || url.hostname.endsWith(".storage.googleapis.com");
  } catch {
    return false;
  }
}

function isAppDomainLeasePdfFallback(value: string) {
  if (!value) return false;
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin && /^\/leases\/.+\.pdf$/i.test(url.pathname);
  } catch {
    return /^\/leases\/.+\.pdf(?:$|\?)/i.test(value);
  }
}

function canUseLegacyDocumentFallback(value: string) {
  const next = String(value || "").trim();
  return Boolean(next) && !isGoogleStorageSignedUrl(next) && !isAppDomainLeasePdfFallback(next);
}

function isScheduleADocumentUrl(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  return Boolean(normalized) && (normalized.includes("schedule-a") || normalized.includes("schedule_a"));
}

export default function TenantLeasePage() {
  const [data, setData] = React.useState<Awaited<ReturnType<typeof getTenantLeaseWorkspace>>>(null);
  const [rentPaymentDetails, setRentPaymentDetails] = React.useState<Awaited<
    ReturnType<typeof getTenantLeasePaymentStatus>
  > | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [signing, setSigning] = React.useState(false);
  const [paying, setPaying] = React.useState(false);
  const [openingDocument, setOpeningDocument] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [documentOpenError, setDocumentOpenError] = React.useState<string | null>(null);

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
      const result = await signTenantLease(data.leaseId);
      if (result && "signingUrl" in result) {
        if (result.signingUrl) {
          window.location.assign(result.signingUrl);
          return;
        }
        setError("Lease signing is not available yet.");
        return;
      }
      setData(result);
    } catch (err: any) {
      setError(err?.payload?.error || err?.message || "Unable to record your lease signature.");
    } finally {
      setSigning(false);
    }
  }

  async function handleOpenLeaseDocument(documentKind: "lease" | "schedule-a" = "lease") {
    const context = documentKind === "schedule-a" ? data?.scheduleADocumentContext : data?.leaseDocumentContext;
    const fallbackUrl = String(context?.documentUrl || (documentKind === "lease" ? data?.documentUrl : "") || "").trim();
    let primaryRefreshReturnedScheduleA = false;
    setOpeningDocument(true);
    setDocumentOpenError(null);
    try {
      const refreshed =
        documentKind === "schedule-a"
          ? await refreshTenantLeaseDocumentUrl({ document: "schedule-a" })
          : await refreshTenantLeaseDocumentUrl();
      const nextUrl = String(refreshed?.documentUrl || "").trim() || fallbackUrl;
      if (documentKind === "lease" && isScheduleADocumentUrl(nextUrl)) {
        primaryRefreshReturnedScheduleA = true;
        throw new Error("Primary lease document unavailable. Use Open Schedule A for the supplemental form.");
      }
      if (!nextUrl) throw new Error("Lease document is not available.");
      window.open(nextUrl, "_blank", "noreferrer");
    } catch (err: any) {
      if (
        !primaryRefreshReturnedScheduleA &&
        canUseLegacyDocumentFallback(fallbackUrl) &&
        (documentKind === "schedule-a" || !isScheduleADocumentUrl(fallbackUrl))
      ) {
        window.open(fallbackUrl, "_blank", "noreferrer");
        return;
      }
      setDocumentOpenError(err?.payload?.error || err?.message || (documentKind === "schedule-a" ? "Schedule A link expired and needs regeneration." : "Lease document link expired and needs regeneration."));
    } finally {
      setOpeningDocument(false);
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
      setError(mapRentPaymentCheckoutErrorMessage(err?.payload?.detail || err?.payload?.error || err?.message));
    } finally {
      setPaying(false);
    }
  }

  const execution = data?.leaseExecution || null;
  const providerSigningStatus = String(data?.providerSigningStatus || "not_started");
  const providerSigningComplete = providerSigningStatus === "signed";
  const signedDocumentComplete = providerSigningComplete || data?.signatureStatus === "signed";
  const providerSigningAvailable = data?.providerSigningAvailable === true || providerSigningStatus === "pending_signature";
  const leaseDocumentContext = data?.leaseDocumentContext || null;
  const scheduleADocumentContext = data?.scheduleADocumentContext || null;
  const rawLeaseDocumentUrl = String(leaseDocumentContext?.documentUrl || data?.documentUrl || "").trim();
  const rawScheduleAUrl = String(scheduleADocumentContext?.documentUrl || "").trim();
  const leaseDocumentUrl = rawLeaseDocumentUrl && !isScheduleADocumentUrl(rawLeaseDocumentUrl) ? rawLeaseDocumentUrl : null;
  const scheduleAUrl = rawScheduleAUrl || (isScheduleADocumentUrl(rawLeaseDocumentUrl) ? rawLeaseDocumentUrl : null);
  const signedCopyPending = providerSigningComplete && !leaseDocumentUrl;
  const leaseDocumentLabel = leaseDocumentUrl
    ? leaseDocumentContext?.displayLabel || data?.leasePdfLabel || null
    : scheduleAUrl
    ? "Primary lease document unavailable"
    : leaseDocumentContext?.displayLabel || data?.leasePdfLabel || null;
  const leaseDocumentWarnings = Array.isArray(leaseDocumentContext?.warnings) ? leaseDocumentContext.warnings : [];
  const paymentReadiness = data?.paymentReadiness || null;
  const paymentSummary = rentPaymentDetails || data?.rentPaymentSummary || null;
  const latestPaymentStatus =
    paymentSummary?.latestPayment?.status || paymentSummary?.paymentExperience?.history?.[0]?.status || null;
  const paymentExperienceStatusLabel = formatPaymentExperienceStatus({
    latestPaymentStatus,
    latestStatus: paymentSummary?.paymentExperience?.latestStatus || null,
  });
  const tenantPaymentGuidance = describeRentPaymentGuidance({
    audience: "tenant",
    latestPaymentStatus,
    latestStatus: paymentSummary?.paymentExperience?.latestStatus || null,
    blockedReason: paymentSummary?.paymentRail.blockedReason || null,
    paymentRailEnabled: paymentSummary?.paymentRail.enabled ?? null,
  });
  const executionStatus = String(execution?.executionStatus || "").trim();
  const signatureWorkflowVisible =
    providerSigningComplete ||
    Boolean(data?.tenantSignature?.signedAt) ||
    ["ready_for_tenant_signature", "tenant_signed", "ready_for_landlord_signature", "landlord_signed", "fully_executed"].includes(
      executionStatus
    );
  const timelineRows = execution
    ? signatureWorkflowVisible
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
          label: "Execution",
          value: execution.executionStatus === "fully_executed" ? "Completed" : "Not completed",
        },
      ]
      : [
          {
            label: "Lease details",
            value: execution.executionStatus === "blocked" ? "Needs attention" : "Ready",
          },
          {
            label: "Signature workflow",
            value: "Not started",
          },
          {
            label: "Execution",
            value: "Not completed",
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
                {paymentSummary ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <TenantKeyValueGrid
                      rows={[
                        {
                          label: "Rent collection",
                          value: paymentSummary.paymentRail.enabled ? "Enabled" : "Not enabled",
                        },
                        {
                          label: "Latest status",
                          value: paymentExperienceStatusLabel,
                        },
                      ]}
                    />
                    <div style={{ color: "var(--text-muted, #64748b)" }}>{tenantPaymentGuidance}</div>
                    <div style={{ color: "var(--text-muted, #64748b)" }}>
                      Payment processed by Stripe. RentChain does not store card or bank payment details.
                    </div>
                    {(paymentSummary.paymentExperience?.history || []).length ? (
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ fontWeight: 800 }}>Payment history</div>
                        {(paymentSummary.paymentExperience?.history || []).map((entry) => (
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
                    {paymentSummary.paymentExperience?.receiptSummary?.available ? (
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ fontWeight: 800 }}>{paymentSummary.paymentExperience?.receiptSummary.label}</div>
                        <div style={{ color: "var(--text-muted, #64748b)" }}>
                          Lease {paymentSummary.paymentExperience?.receiptSummary.leaseReference || "reference"}{" "}
                          ·{" "}
                          {formatMoney((paymentSummary.paymentExperience?.receiptSummary?.amountCents || 0) / 100)}{" "}
                          ·{" "}
                          {formatDate(paymentSummary.paymentExperience?.receiptSummary?.paidAt)}
                        </div>
                        <div>
                          <button type="button" onClick={() => window.print()}>
                            Print / Save payment summary
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {paymentSummary.paymentRail.enabled &&
                    paymentReadiness.readinessStatus === "ready_to_configure" &&
                    paymentSummary.paymentExperience?.latestStatus !== "pending" &&
                    paymentSummary.paymentExperience?.latestStatus !== "paid" ? (
                      <button type="button" onClick={() => void handlePayRent()} disabled={paying}>
                        {paying
                          ? "Opening checkout..."
                          : paymentSummary.paymentExperience?.retryAvailable
                          ? "Retry payment"
                          : "Pay rent"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </TenantInfoCard>
          ) : null}

          <SignedDocumentWorkspace
            audience="tenant"
            title="Signed lease document workspace"
            statusLabel={
              leaseDocumentUrl
                ? signedDocumentComplete
                  ? "Signed document available"
                  : "Lease document available"
                : signedCopyPending
                ? "Signed copy pending"
                : "Document unavailable"
            }
            documentLabel={leaseDocumentLabel || "Signed lease document"}
            documentUrl={leaseDocumentUrl}
            signedAt={data.providerSignedAt || data.tenantSignature?.signedAt || null}
            completedAt={execution?.completedAt || null}
            evidenceLabel={signedDocumentComplete && leaseDocumentUrl ? "Lease record ready" : "Tenant-safe document access pending"}
            warnings={leaseDocumentWarnings}
            opening={openingDocument}
            openError={documentOpenError}
            onOpenDocument={leaseDocumentUrl ? () => void handleOpenLeaseDocument() : undefined}
            providerMetadataVisible={false}
            unavailableMessage={
              signedCopyPending
                ? "Signing is complete, but no tenant-safe signed lease document link is available yet."
                : "No approved lease document link is available in this workspace yet."
            }
          />

          {scheduleAUrl ? (
            <TenantInfoCard heading="Schedule A / attachment" accent="#0891b2">
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 800 }}>Schedule A</div>
                <div style={{ color: "var(--text-muted, #64748b)" }}>
                  This supplemental form is separate from the primary lease document.
                </div>
                {scheduleADocumentContext?.documentStatus ? (
                  <div style={{ color: "var(--text-muted, #64748b)" }}>
                    Document status: {prettyStatus(scheduleADocumentContext.documentStatus)}
                  </div>
                ) : null}
              </div>
              <button type="button" onClick={() => void handleOpenLeaseDocument("schedule-a")} disabled={openingDocument}>
                {openingDocument ? "Opening..." : "Open Schedule A"}
              </button>
            </TenantInfoCard>
          ) : null}

          <TenantInfoCard heading="Lease Signing" accent="#7c3aed">
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 800 }}>
                  {providerSigningAvailable
                    ? "Ready for signature"
                    : providerSigningStatus === "signed"
                    ? "Lease signature complete"
                    : data.signatureReadinessLabel || "Lease signing unavailable"}
                </div>
                <div style={{ color: "var(--text-muted, #64748b)" }}>
                  {providerSigningAvailable
                    ? "Open the secure signing session to review and sign the lease."
                    : providerSigningComplete && signedCopyPending
                    ? "The provider-backed signing workflow is complete. The signed copy is still being prepared for this tenant workspace."
                    : providerSigningComplete
                    ? "The provider-backed signing workflow is complete."
                    : data.signatureReadinessDescription || "Lease signing details are not available in this workspace yet."}
                </div>
              </div>

              {providerSigningStatus !== "not_started" ? (
                <TenantKeyValueGrid
                  rows={[
                    { label: "Provider signing", value: prettyStatus(providerSigningStatus) },
                    { label: "Derived lease state", value: prettyStatus(data.providerDerivedLeaseState || "not_started") },
                    { label: "Signed at", value: formatDate(data.providerSignedAt) },
                  ]}
                />
              ) : null}

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
            <TenantInfoCard heading={signatureWorkflowVisible ? "Lease Execution" : "Signature workflow"} accent="#0f172a">
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 800 }}>
                    {signedCopyPending
                      ? "Signing complete; signed copy pending"
                      : signatureWorkflowVisible
                      ? execution.executionLabel
                      : "Signature workflow not started"}
                  </div>
                  <div style={{ color: "var(--text-muted, #64748b)" }}>
                    {signedCopyPending
                      ? "Signing is complete, but no tenant-safe signed lease document link is available yet."
                      : signatureWorkflowVisible
                      ? execution.executionDescription
                      : "Lease details are visible, but no tenant-safe signature workflow or execution evidence is available yet."}
                  </div>
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
                      {signing ? "Opening signing..." : providerSigningAvailable ? "Sign lease" : "Confirm tenant signature"}
                    </button>
                    <div style={{ color: "var(--text-muted, #64748b)" }}>
                      {providerSigningAvailable
                        ? "The signing session opens through the configured provider and returns here after completion."
                        : "This records tenant signature metadata for the current lease workflow without storing any drawn signature image."}
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
