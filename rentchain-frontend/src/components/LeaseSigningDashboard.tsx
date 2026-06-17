import React from "react";
import {
  cancelLeaseSigning,
  downloadSignedLease,
  generatePrimaryLeaseDocument,
  getPrimaryLeaseDocument,
  getLeaseSigningStatus,
  sendLeaseForSignature,
  type LeaseSigningStatusResponse,
  type PrimaryLeaseDocument,
} from "../api/leasesApi";

type Props = {
  leaseId: string;
  tenantEmail?: string | null;
};

function pretty(value: unknown) {
  return String(value || "not_started")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dispatchNotice(status: LeaseSigningStatusResponse | null) {
  if (!status || status.signingStatus !== "pending_signature") return null;
  const dispatchMode = String(status.providerDispatchMode || "").trim().toLowerCase();
  const dispatchStatus = String(status.providerDispatchStatus || "").trim().toLowerCase();
  if (dispatchMode === "mock" || dispatchStatus === "mocked_no_email") {
    return "Mock signing request recorded. No signature email was sent by this preview provider.";
  }
  if (dispatchMode === "stub" || dispatchStatus === "stubbed_no_email") {
    return "Sandbox signing request recorded. No signature email was sent by the configured signing stub.";
  }
  if (dispatchMode === "sandbox") {
    return status.providerDispatchMessage || "Dropbox Sign accepted the request in test mode.";
  }
  if (dispatchMode === "real" || dispatchStatus === "accepted" || dispatchStatus === "sent") {
    return status.providerDispatchMessage || "Signature request sent by the signing provider.";
  }
  return null;
}

export function LeaseSigningDashboard({ leaseId, tenantEmail }: Props) {
  const [status, setStatus] = React.useState<LeaseSigningStatusResponse | null>(null);
  const [email, setEmail] = React.useState(String(tenantEmail || ""));
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [documentBusy, setDocumentBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [documentError, setDocumentError] = React.useState<string | null>(null);
  const [primaryDocument, setPrimaryDocument] = React.useState<PrimaryLeaseDocument | null>(null);

  React.useEffect(() => {
    const nextTenantEmail = String(tenantEmail || "").trim();
    if (!nextTenantEmail) return;
    setEmail((current) => (current.trim() ? current : nextTenantEmail));
  }, [tenantEmail]);

  const refresh = React.useCallback(async () => {
    if (!leaseId) return;
    try {
      const [nextStatus, nextDocument] = await Promise.all([
        getLeaseSigningStatus(leaseId),
        getPrimaryLeaseDocument(leaseId).catch(() => null),
      ]);
      setStatus(nextStatus);
      setPrimaryDocument(nextDocument);
    } catch {
      setStatus(null);
    }
  }, [leaseId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function submit() {
    if (!primaryDocument || (primaryDocument.status !== "generated" && primaryDocument.status !== "locked")) {
      setError("Generate a primary lease PDF before sending for signature.");
      return;
    }
    const tenantEmails = email.split(",").map((item) => item.trim()).filter(Boolean);
    setBusy(true);
    setError(null);
    try {
      setStatus(await sendLeaseForSignature(leaseId, { tenantEmails, message: message.trim() || undefined }));
    } catch (err: any) {
      setError(err?.body?.error || err?.message || "Unable to send lease for signature.");
    } finally {
      setBusy(false);
    }
  }

  async function generateDocument() {
    setDocumentBusy(true);
    setDocumentError(null);
    setError(null);
    try {
      setPrimaryDocument(await generatePrimaryLeaseDocument(leaseId));
    } catch (err: any) {
      setDocumentError(err?.body?.error || err?.message || "Primary lease document is unavailable for this jurisdiction.");
    } finally {
      setDocumentBusy(false);
    }
  }

  async function previewDocument() {
    setDocumentBusy(true);
    setDocumentError(null);
    try {
      const next = await getPrimaryLeaseDocument(leaseId, { includePreviewUrl: true });
      setPrimaryDocument(next);
      if (next?.previewUrl) window.open(next.previewUrl, "_blank", "noreferrer");
    } catch (err: any) {
      setDocumentError(err?.body?.error || err?.message || "Primary lease document preview is unavailable.");
    } finally {
      setDocumentBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await cancelLeaseSigning(leaseId);
      await refresh();
    } catch (err: any) {
      setError(err?.body?.error || err?.message || "Unable to cancel signing.");
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const result = await downloadSignedLease(leaseId);
      if (result.documentUrl) window.open(result.documentUrl, "_blank", "noreferrer");
      await refresh();
    } catch (err: any) {
      setError(err?.body?.error || err?.message || "Signed document is not available yet.");
    } finally {
      setBusy(false);
    }
  }

  const signingStatus = status?.signingStatus || "not_started";
  const canSend = signingStatus === "not_started" || signingStatus === "cancelled" || signingStatus === "expired" || signingStatus === "rejected" || signingStatus === "failed";
  const hasPrimaryDocument = Boolean(primaryDocument && (primaryDocument.status === "generated" || primaryDocument.status === "locked"));
  const canCancel = signingStatus === "pending_signature";
  const canDownload = signingStatus === "signed";
  const noEmailNotice = dispatchNotice(status);

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontWeight: 800 }}>Lease signing</div>
        <div style={{ color: "#64748b" }}>
          Status: {pretty(signingStatus)} · Lease state: {pretty(status?.derivedLeaseState)}
        </div>
      </div>
      {canSend ? (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "grid", gap: 6, padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}>
            <div style={{ fontWeight: 800 }}>Primary lease PDF</div>
            <div style={{ color: "#64748b", fontSize: 13 }}>
              {primaryDocument
                ? `Status: ${pretty(primaryDocument.status)} · ${primaryDocument.jurisdictionCode} · ${primaryDocument.counselReviewStatus}`
                : "No primary lease PDF generated yet."}
            </div>
            {primaryDocument?.sourceSummary?.productionApproved === false ? (
              <div style={{ color: "#92400e", fontSize: 13 }}>
                Jurisdiction template is draft/test and requires counsel review before production signing.
              </div>
            ) : null}
            {primaryDocument?.leaseReadiness ? (
              <div style={{ display: "grid", gap: 4, color: "#475569", fontSize: 13 }}>
                <div>
                  Form P readiness: {pretty(primaryDocument.leaseReadiness.overallStatus)} ·{" "}
                  {primaryDocument.leaseReadiness.completionPercent}% complete
                </div>
                {primaryDocument.leaseReadiness.blockingItems.length ? (
                  <div>
                    Missing required fields:{" "}
                    {primaryDocument.leaseReadiness.blockingItems
                      .slice(0, 3)
                      .map((item) => item.label)
                      .join(", ")}
                    {primaryDocument.leaseReadiness.blockingItems.length > 3 ? "…" : ""}
                  </div>
                ) : null}
              </div>
            ) : null}
            {documentError ? <div style={{ color: "#b91c1c", fontSize: 13 }}>{documentError}</div> : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => void generateDocument()} disabled={documentBusy || busy}>
                {documentBusy ? "Working..." : "Generate Primary Lease PDF"}
              </button>
              {primaryDocument ? (
                <button type="button" onClick={() => void previewDocument()} disabled={documentBusy || busy}>
                  Preview Lease Document
                </button>
              ) : null}
            </div>
          </div>
          <label style={{ display: "grid", gap: 4, fontWeight: 700 }}>
            Tenant email
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tenant@example.com" />
          </label>
          <label style={{ display: "grid", gap: 4, fontWeight: 700 }}>
            Message
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} />
          </label>
          <button type="button" onClick={() => void submit()} disabled={busy || !email.trim() || !hasPrimaryDocument}>
            {busy ? "Sending..." : "Send for Signature"}
          </button>
        </div>
      ) : null}
      {status?.events?.length ? (
        <div style={{ display: "grid", gap: 6 }}>
          {status.events.slice(-4).map((event) => (
            <div key={event.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, color: "#64748b" }}>
              <span>{pretty(event.type)}</span>
              <span>{event.occurredAt ? new Date(event.occurredAt).toLocaleString() : "Pending"}</span>
            </div>
          ))}
        </div>
      ) : null}
      {noEmailNotice ? <div style={{ color: "#92400e" }}>{noEmailNotice}</div> : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {canCancel ? <button type="button" onClick={() => void cancel()} disabled={busy}>Cancel signing</button> : null}
        {canDownload ? <button type="button" onClick={() => void download()} disabled={busy}>Download signed document</button> : null}
      </div>
      {error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}
    </section>
  );
}

export default LeaseSigningDashboard;
