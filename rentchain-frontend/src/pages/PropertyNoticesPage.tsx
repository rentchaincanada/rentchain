import React, { useEffect, useMemo, useState } from "react";
import { fetchProperties, type Property } from "@/api/propertiesApi";
import {
  fetchNoticeRecipients,
  fetchPropertyNotice,
  fetchPropertyNotices,
  sendPropertyNotice,
  type NoticeDelivery,
  type NoticeRecipient,
  type NoticeSummary,
} from "@/api/propertyNoticesApi";

const card: React.CSSProperties = { background: "white", border: "1px solid #ded8ce", borderRadius: 14, padding: 18 };
const field: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: 10, border: "1px solid #bdb5aa", borderRadius: 8 };

function requestKey() {
  return `${Date.now().toString(36)}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export default function PropertyNoticesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [notices, setNotices] = useState<NoticeSummary[]>([]);
  const [mode, setMode] = useState<"history" | "compose">("history");
  const [propertyId, setPropertyId] = useState("");
  const [recipients, setRecipients] = useState<NoticeRecipient[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [previewed, setPreviewed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ notice: NoticeSummary; deliveries: NoticeDelivery[] } | null>(null);

  const loadHistory = async () => setNotices(await fetchPropertyNotices());
  useEffect(() => {
    Promise.all([fetchProperties({ status: "active" }), fetchPropertyNotices()])
      .then(([propertyResponse, noticeResponse]) => {
        setProperties(propertyResponse.properties || propertyResponse.items || []);
        setNotices(noticeResponse);
      })
      .catch(() => setError("Notices could not be loaded."));
  }, []);

  const unitOptions = useMemo(() => Array.from(new Map(recipients.flatMap((recipient) => recipient.unitIds.map((id, index) => [id, recipient.unitLabels[index] || "Unit"]))).entries()), [recipients]);
  const visibleRecipients = useMemo(() => selectedUnits.length
    ? recipients.filter((recipient) => recipient.unitIds.some((id) => selectedUnits.includes(id)))
    : recipients, [recipients, selectedUnits]);
  const selected = visibleRecipients.filter((recipient) => selectedTenants.includes(recipient.tenantId));
  const deliverable = selected.filter((recipient) => recipient.deliveryAvailability === "available");
  const skipped = selected.length - deliverable.length;

  const resetCompose = () => {
    setPropertyId(""); setRecipients([]); setSelectedUnits([]); setSelectedTenants([]);
    setSubject(""); setBody(""); setPreviewed(false); setConfirming(false); setError(null);
  };

  const resolve = async () => {
    setError(null); setConfirming(false);
    try {
      const response = await fetchNoticeRecipients(propertyId);
      setRecipients(response.recipients);
      setSelectedTenants(response.recipients.map((recipient) => recipient.tenantId));
      setSelectedUnits([]);
      setPreviewed(true);
    } catch { setError("Eligible recipients could not be resolved."); }
  };

  const submit = async () => {
    setSending(true); setError(null);
    try {
      await sendPropertyNotice({
        propertyId, subject: subject.trim(), body: body.trim(),
        selectedUnitIds: selectedUnits,
        selectedTenantIds: selected.map((recipient) => recipient.tenantId),
        idempotencyKey: requestKey(),
      });
      await loadHistory(); resetCompose(); setMode("history");
    } catch { setError("The notice could not be sent. Review the recipients and try again."); }
    finally { setSending(false); }
  };

  return <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px 120px", color: "#211c17" }}>
    <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 20 }}>
      <div><h1 style={{ margin: 0 }}>Notices</h1><p>Private operational communications for current occupants of one property.</p></div>
      <button type="button" onClick={() => { resetCompose(); setMode(mode === "compose" ? "history" : "compose"); }}>
        {mode === "compose" ? "Back to history" : "New Notice"}
      </button>
    </header>
    <p style={{ background: "#fff6dc", padding: 12, borderRadius: 8 }}>For general property communications. Formal tenancy notices follow a separate process.</p>
    {error ? <div role="alert" style={{ color: "#8a1c1c", marginBottom: 12 }}>{error}</div> : null}

    {mode === "history" ? <section aria-label="Notice history" style={{ display: "grid", gap: 12 }}>
      {notices.length === 0 ? <div style={card}>No operational notices have been sent.</div> : notices.map((notice) =>
        <button key={notice.id} type="button" onClick={async () => setDetail(await fetchPropertyNotice(notice.id))} style={{ ...card, textAlign: "left", cursor: "pointer" }}>
          <strong>{notice.subject}</strong><div>{notice.propertyLabel} · {notice.createdAtMs ? new Date(notice.createdAtMs).toLocaleDateString() : "Pending date"}</div>
          <small>{statusLabel(notice.status)} · {notice.sentCount}/{notice.recipientCount} sent · {notice.failedCount} failed · {notice.skippedCount} skipped</small>
        </button>)}
      {detail ? <div style={card}><button type="button" onClick={() => setDetail(null)} style={{ float: "right" }}>Close</button><h2>{detail.notice.subject}</h2><p style={{ whiteSpace: "pre-wrap" }}>{detail.notice.body}</p><h3>Recipient delivery history</h3>
        <ul>{detail.deliveries.map((delivery) => <li key={delivery.id}>{delivery.tenantDisplayName} · {delivery.unitLabels.join(", ")} · {statusLabel(delivery.status)}{delivery.errorCategory ? ` (${statusLabel(delivery.errorCategory)})` : ""}</li>)}</ul></div> : null}
    </section> : <section style={{ ...card, display: "grid", gap: 16 }}>
      <label>1. Select property<select aria-label="Property" value={propertyId} onChange={(event) => { setPropertyId(event.target.value); setPreviewed(false); }} style={field}>
        <option value="">Choose a property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name || property.addressLine1}</option>)}
      </select></label>
      <button type="button" disabled={!propertyId} onClick={resolve}>Resolve current recipients</button>
      {previewed ? <>
        <fieldset><legend>2. Optional unit filters</legend>{unitOptions.map(([id, label]) => <label key={id} style={{ marginRight: 14 }}><input type="checkbox" checked={selectedUnits.includes(id)} onChange={() => setSelectedUnits((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} /> {label}</label>)}</fieldset>
        <fieldset><legend>3. Preview recipients ({selected.length})</legend>
          {visibleRecipients.map((recipient) => <label key={recipient.tenantId} style={{ display: "block", padding: "6px 0" }}><input type="checkbox" checked={selectedTenants.includes(recipient.tenantId)} onChange={() => setSelectedTenants((current) => current.includes(recipient.tenantId) ? current.filter((item) => item !== recipient.tenantId) : [...current, recipient.tenantId])} /> {recipient.tenantDisplayName} · {recipient.unitLabels.join(", ")} · {statusLabel(recipient.deliveryAvailability)}</label>)}
          <p>{deliverable.length} private deliveries · {skipped} skipped/unavailable</p>
        </fieldset>
        <label>4. Subject<input aria-label="Subject" maxLength={160} value={subject} onChange={(event) => setSubject(event.target.value)} style={field} /></label>
        <label>5. Message<textarea aria-label="Message" maxLength={10000} rows={8} value={body} onChange={(event) => setBody(event.target.value)} style={field} /></label>
        <button type="button" disabled={!subject.trim() || !body.trim() || deliverable.length === 0} onClick={() => setConfirming(true)}>Preview Notice</button>
      </> : null}
      {confirming ? <div role="dialog" aria-label="Confirm notice" style={{ ...card, background: "#fffaf1" }}><h2>Confirm operational notice</h2>
        <p><strong>{properties.find((property) => property.id === propertyId)?.name || "Selected property"}</strong> · {deliverable.length} private recipients · {skipped} skipped</p>
        <h3>{subject}</h3><p style={{ whiteSpace: "pre-wrap" }}>{body}</p><p>Each recipient receives a separate private delivery. Recipients cannot see one another.</p>
        <button type="button" onClick={() => setConfirming(false)} disabled={sending}>Edit</button>{" "}<button type="button" onClick={submit} disabled={sending}>{sending ? "Sending…" : "Send Notice"}</button>
      </div> : null}
    </section>}
  </main>;
}
