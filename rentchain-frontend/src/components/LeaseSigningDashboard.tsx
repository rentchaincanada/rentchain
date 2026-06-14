import React from "react";
import {
  cancelLeaseSigning,
  downloadSignedLease,
  getLeaseSigningStatus,
  sendLeaseForSignature,
  type LeaseSigningStatusResponse,
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
  return null;
}

export function LeaseSigningDashboard({ leaseId, tenantEmail }: Props) {
  const [status, setStatus] = React.useState<LeaseSigningStatusResponse | null>(null);
  const [email, setEmail] = React.useState(String(tenantEmail || ""));
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const nextTenantEmail = String(tenantEmail || "").trim();
    if (!nextTenantEmail) return;
    setEmail((current) => (current.trim() ? current : nextTenantEmail));
  }, [tenantEmail]);

  const refresh = React.useCallback(async () => {
    if (!leaseId) return;
    try {
      setStatus(await getLeaseSigningStatus(leaseId));
    } catch {
      setStatus(null);
    }
  }, [leaseId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function submit() {
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
  const canSend = signingStatus === "not_started" || signingStatus === "cancelled" || signingStatus === "expired" || signingStatus === "rejected";
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
          <label style={{ display: "grid", gap: 4, fontWeight: 700 }}>
            Tenant email
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tenant@example.com" />
          </label>
          <label style={{ display: "grid", gap: 4, fontWeight: 700 }}>
            Message
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} />
          </label>
          <button type="button" onClick={() => void submit()} disabled={busy || !email.trim()}>
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
