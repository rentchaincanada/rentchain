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
  const [propertyIds, setPropertyIds] = useState<string[]>([]);
  const [propertyBreakdown, setPropertyBreakdown] = useState<Array<{ id: string; label: string; recipientCount: number }>>([]);
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

  const unitGroups = useMemo(() => propertyIds.map((selectedPropertyId) => ({
    propertyId: selectedPropertyId,
    propertyLabel: properties.find((property) => property.id === selectedPropertyId)?.name || "Property",
    units: Array.from(new Map(recipients.flatMap((recipient) => recipient.units || []).filter((unit) => unit.propertyId === selectedPropertyId).map((unit) => [unit.id, unit.label])).entries()),
  })), [propertyIds, properties, recipients]);
  const visibleRecipients = useMemo(() => selectedUnits.length
    ? recipients.filter((recipient) => recipient.unitIds.some((id) => selectedUnits.includes(id)))
    : recipients, [recipients, selectedUnits]);
  const selected = visibleRecipients.filter((recipient) => selectedTenants.includes(recipient.tenantId));
  const deliverable = selected.filter((recipient) => recipient.deliveryAvailability === "available");
  const skipped = selected.length - deliverable.length;

  const resetCompose = () => {
    setPropertyIds([]); setPropertyBreakdown([]); setRecipients([]); setSelectedUnits([]); setSelectedTenants([]);
    setSubject(""); setBody(""); setPreviewed(false); setConfirming(false); setError(null);
  };

  const resolve = async () => {
    setError(null); setConfirming(false);
    try {
      const response = await fetchNoticeRecipients(propertyIds);
      setRecipients(response.recipients);
      setPropertyBreakdown(response.propertyBreakdown);
      setSelectedTenants(response.recipients.map((recipient) => recipient.tenantId));
      setSelectedUnits([]);
      setPreviewed(true);
    } catch (cause: unknown) {
      const status = cause && typeof cause === "object" && "status" in cause ? (cause as { status?: number }).status : null;
      setError(status === 422
        ? "Recipient limit exceeded. Reduce selected properties or filter units and tenants."
        : "Eligible recipients could not be resolved.");
    }
  };

  const submit = async () => {
    setSending(true); setError(null);
    try {
      await sendPropertyNotice({
        propertyIds, subject: subject.trim(), body: body.trim(),
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
      <div><h1 style={{ margin: 0 }}>Notices</h1><p>Private operational communications for current occupants of one or more properties.</p></div>
      <button type="button" onClick={() => { resetCompose(); setMode(mode === "compose" ? "history" : "compose"); }}>
        {mode === "compose" ? "Back to history" : "New Notice"}
      </button>
    </header>
    <p style={{ background: "#fff6dc", padding: 12, borderRadius: 8 }}>For general property communications. Formal tenancy notices follow a separate process.</p>
    {error ? <div role="alert" style={{ color: "#8a1c1c", marginBottom: 12 }}>{error}</div> : null}

    {mode === "history" ? <section aria-label="Notice history" style={{ display: "grid", gap: 12 }}>
      {notices.length === 0 ? <div style={card}>No operational notices have been sent.</div> : notices.map((notice) =>
        <button key={notice.id} type="button" onClick={async () => setDetail(await fetchPropertyNotice(notice.id))} style={{ ...card, textAlign: "left", cursor: "pointer" }}>
          <strong>{notice.subject}</strong><div>{(notice.propertyCount || notice.properties?.length || 1) > 1 ? `${notice.propertyCount || notice.properties.length} properties` : notice.propertyLabel || notice.properties?.[0]?.label || "Property"} · {notice.createdAtMs ? new Date(notice.createdAtMs).toLocaleDateString() : "Pending date"}</div>
          <small>{statusLabel(notice.status)} · {notice.sentCount}/{notice.recipientCount} sent · {notice.failedCount} failed · {notice.skippedCount} skipped</small>
        </button>)}
      {detail ? <div style={card}><button type="button" onClick={() => setDetail(null)} style={{ float: "right" }}>Close</button><h2>{detail.notice.subject}</h2>
        <p>{detail.notice.propertyCount || detail.notice.properties?.length || 1} selected {(detail.notice.propertyCount || detail.notice.properties?.length || 1) === 1 ? "property" : "properties"}</p>
        <ul aria-label="Selected properties">{(detail.notice.properties || []).map((property) => <li key={property.id}>{property.label}</li>)}</ul>
        <p>{detail.notice.sentCount}/{detail.notice.recipientCount} sent · {detail.notice.failedCount} failed · {detail.notice.skippedCount} skipped</p>
        <p>Created {detail.notice.createdAtMs ? new Date(detail.notice.createdAtMs).toLocaleString() : "date pending"}{detail.notice.completedAtMs ? ` · Completed ${new Date(detail.notice.completedAtMs).toLocaleString()}` : ""}</p>
        <p style={{ whiteSpace: "pre-wrap" }}>{detail.notice.body}</p><h3>Recipient delivery history</h3>
        <ul>{detail.deliveries.map((delivery) => <li key={delivery.id}>{delivery.tenantDisplayName} · {(delivery.units || []).map((unit) => `${unit.propertyLabel} — ${unit.label}`).join(", ") || delivery.unitLabels.join(", ")} · {statusLabel(delivery.status)}{delivery.errorCategory ? ` (${statusLabel(delivery.errorCategory)})` : ""}</li>)}</ul></div> : null}
    </section> : <section style={{ ...card, display: "grid", gap: 16 }}>
      <fieldset><legend>1. Select one or more properties ({propertyIds.length} selected)</legend>
        <div style={{ display: "grid", gap: 8 }}>{properties.map((property) => <label key={property.id}><input type="checkbox" aria-label={property.name || property.addressLine1} checked={propertyIds.includes(property.id)} onChange={() => { setPropertyIds((current) => current.includes(property.id) ? current.filter((id) => id !== property.id) : [...current, property.id].sort()); setPreviewed(false); setConfirming(false); }} /> {property.name || property.addressLine1}</label>)}</div>
        {propertyIds.length ? <button type="button" onClick={() => { setPropertyIds([]); setPreviewed(false); setConfirming(false); }}>Clear all</button> : null}
      </fieldset>
      <button type="button" disabled={!propertyIds.length} onClick={resolve}>Resolve current recipients</button>
      {previewed ? <>
        <p><strong>{propertyIds.length} {propertyIds.length === 1 ? "property" : "properties"} · {recipients.length} eligible occupants · {recipients.filter((recipient) => recipient.deliveryAvailability === "available").length} deliverable · {recipients.filter((recipient) => recipient.deliveryAvailability !== "available").length} skipped</strong></p>
        <ul aria-label="Property recipient breakdown">{propertyBreakdown.map((property) => <li key={property.id}>{property.label} — {property.recipientCount} recipients</li>)}</ul>
        <fieldset><legend>2. Optional unit filters</legend>{unitGroups.map((group) => <div key={group.propertyId}><strong>{group.propertyLabel}</strong><div>{group.units.map(([id, label]) => <label key={id} style={{ marginRight: 14 }}><input type="checkbox" aria-label={`${group.propertyLabel} — ${label}`} checked={selectedUnits.includes(id)} onChange={() => setSelectedUnits((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} /> {label}</label>)}</div></div>)}</fieldset>
        <fieldset><legend>3. Preview recipients ({selected.length})</legend>
          {visibleRecipients.map((recipient) => <label key={recipient.tenantId} style={{ display: "block", padding: "6px 0" }}><input type="checkbox" checked={selectedTenants.includes(recipient.tenantId)} onChange={() => setSelectedTenants((current) => current.includes(recipient.tenantId) ? current.filter((item) => item !== recipient.tenantId) : [...current, recipient.tenantId])} /> {recipient.tenantDisplayName} · {(recipient.units || []).map((unit) => `${unit.propertyLabel} — ${unit.label}`).join(", ") || recipient.unitLabels.join(", ")} · {statusLabel(recipient.deliveryAvailability)}</label>)}
          <p>{deliverable.length} private deliveries · {skipped} skipped/unavailable</p>
        </fieldset>
        <label>4. Subject<input aria-label="Subject" maxLength={160} value={subject} onChange={(event) => setSubject(event.target.value)} style={field} /></label>
        <label>5. Message<textarea aria-label="Message" maxLength={10000} rows={8} value={body} onChange={(event) => setBody(event.target.value)} style={field} /></label>
        <button type="button" disabled={!subject.trim() || !body.trim() || deliverable.length === 0} onClick={() => setConfirming(true)}>Preview Notice</button>
      </> : null}
      {confirming ? <div role="dialog" aria-label="Confirm notice" style={{ ...card, background: "#fffaf1" }}><h2>Confirm operational notice</h2>
        <p><strong>{propertyIds.length} selected {propertyIds.length === 1 ? "property" : "properties"}</strong> · {deliverable.length} private recipients · {skipped} skipped</p>
        <h3>{subject}</h3><p style={{ whiteSpace: "pre-wrap" }}>{body}</p><p>Each recipient receives a separate private delivery. Recipients cannot see one another.</p>
        <button type="button" onClick={() => setConfirming(false)} disabled={sending}>Edit</button>{" "}<button type="button" onClick={submit} disabled={sending}>{sending ? "Sending…" : "Send Notice"}</button>
      </div> : null}
    </section>}
  </main>;
}
