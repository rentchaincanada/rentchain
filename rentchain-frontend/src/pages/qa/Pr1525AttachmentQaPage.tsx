import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import MaintenanceEvidencePhoto from "../../components/maintenance/MaintenanceEvidencePhoto";

type Role = "tenant" | "landlord";
type Bootstrap = {
  scope: "pr1525-maintenance-attachments";
  deploymentSha: string;
  requestId: string;
  session: { role: Role; principalId: string; apiActor: Role };
};
type Attachment = {
  attachmentId: string;
  filename: string;
  contentType: string;
  byteSize: number;
  width: number;
  height: number;
};

type AuthorizedAttachmentThumbnailProps = {
  attachment: Attachment;
  requestAccessUrl: (attachmentId: string) => Promise<string>;
};

export const PR1525_SESSION_KEY = "rentchain.qa.pr1525.fixed-session";

function attachmentPath(role: Role, requestId: string) {
  return role === "tenant"
    ? `/api/tenant/maintenance-requests/${requestId}/attachments`
    : `/api/landlord/maintenance/${requestId}/attachments`;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function AuthorizedAttachmentThumbnail({ attachment, requestAccessUrl }: AuthorizedAttachmentThumbnailProps) {
  const [state, setState] = useState<"loading" | "loaded" | "unavailable">("loading");
  const [url, setUrl] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void requestAccessUrl(attachment.attachmentId)
      .then((nextUrl) => {
        if (cancelled) return;
        setUrl(nextUrl);
        setState("loaded");
      })
      .catch(() => {
        if (!cancelled) setState("unavailable");
      });
    return () => { cancelled = true; };
  }, [attachment.attachmentId, attempt, requestAccessUrl]);

  const frameStyle: React.CSSProperties = {
    aspectRatio: "4 / 3",
    width: "100%",
    marginBottom: 12,
    borderRadius: 8,
    overflow: "hidden",
    background: "#eef2f7",
    border: "1px solid #d6dbe5",
    display: "grid",
    placeItems: "center",
  };

  if (state === "loading") {
    return <div aria-label={`Loading preview for ${attachment.filename}`} role="status" style={frameStyle}>Loading preview…</div>;
  }
  if (state === "unavailable" || !url) {
    return <div style={{ ...frameStyle, padding: 12, textAlign: "center" }}>
      <div>
        <p style={{ margin: "0 0 8px" }}>Preview unavailable</p>
        <button type="button" onClick={() => {
          setState("loading");
          setUrl("");
          setAttempt((value) => value + 1);
        }}>Retry thumbnail</button>
      </div>
    </div>;
  }
  return <div style={{ marginBottom: 12 }}>
    <MaintenanceEvidencePhoto
      src={url}
      filename={attachment.filename}
      altText={`Maintenance attachment preview: ${attachment.filename}`}
      onError={() => {
        setUrl("");
        setState("unavailable");
      }}
    />
  </div>;
}

export default function Pr1525AttachmentQaPage() {
  const rawRole = useParams().role;
  const role: Role | null = rawRole === "tenant" || rawRole === "landlord" ? rawRole : null;
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [status, setStatus] = useState("Initializing fixed Preview QA session…");
  const [busy, setBusy] = useState(false);

  const apiBase = useMemo(() => bootstrap
    ? `/api/pr1525-attachments/${bootstrap.session.apiActor}`
    : "", [bootstrap]);

  const refresh = useCallback(async (value: Bootstrap) => {
    const response = await fetch(`${`/api/pr1525-attachments/${value.session.apiActor}`}${attachmentPath(value.session.role, value.requestId)}`, {
      headers: { accept: "application/json" },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error || `Attachment list failed (${response.status})`);
    setAttachments(Array.isArray(payload?.data) ? payload.data : []);
  }, []);

  useEffect(() => {
    if (!role) { setStatus("Bootstrap route unavailable."); return; }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/pr1525-bootstrap/${role}`, { headers: { accept: "application/json" } });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Bootstrap unavailable");
        const value = payload as Bootstrap & { ok: true };
        if (value.session.role !== role) throw new Error("Bootstrap role mismatch");
        window.sessionStorage.setItem(PR1525_SESSION_KEY, JSON.stringify(value));
        if (cancelled) return;
        setBootstrap(value);
        await refresh(value);
        if (!cancelled) setStatus("Fixed synthetic session active");
      } catch (error: unknown) {
        window.sessionStorage.removeItem(PR1525_SESSION_KEY);
        if (!cancelled) setStatus(errorMessage(error, "Bootstrap unavailable"));
      }
    })();
    return () => { cancelled = true; };
  }, [refresh, role]);

  async function upload(file: File) {
    if (!bootstrap || bootstrap.session.role !== "tenant") return;
    setBusy(true);
    setStatus(`Uploading ${file.name}…`);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`${apiBase}${attachmentPath("tenant", bootstrap.requestId)}`, { method: "POST", body: form });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `Upload failed (${response.status})`);
      await refresh(bootstrap);
      setStatus(`${file.name} uploaded`);
    } catch (error: unknown) {
      setStatus(errorMessage(error, "Upload failed"));
    } finally { setBusy(false); }
  }

  async function remove(attachmentId: string) {
    if (!bootstrap || bootstrap.session.role !== "tenant") return;
    setBusy(true);
    try {
      const response = await fetch(`${apiBase}${attachmentPath("tenant", bootstrap.requestId)}/${encodeURIComponent(attachmentId)}`, { method: "DELETE" });
      if (!response.ok && response.status !== 204) throw new Error(`Delete failed (${response.status})`);
      await refresh(bootstrap);
      setStatus("Attachment removed");
    } catch (error: unknown) { setStatus(errorMessage(error, "Delete failed")); }
    finally { setBusy(false); }
  }

  async function openAttachment(attachmentId: string) {
    if (!bootstrap) return;
    try {
      const url = await requestAttachmentAccessUrl(attachmentId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error: unknown) {
      setStatus(errorMessage(error, "Access denied"));
    }
  }

  const requestAttachmentAccessUrl = useCallback(async (attachmentId: string) => {
    if (!bootstrap) throw new Error("Access denied");
    const response = await fetch(`${apiBase}${attachmentPath(bootstrap.session.role, bootstrap.requestId)}/${encodeURIComponent(attachmentId)}/access`);
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.data?.url) throw new Error(payload?.error || "Access denied");
    return String(payload.data.url);
  }, [apiBase, bootstrap]);

  function reset() {
    window.sessionStorage.removeItem(PR1525_SESSION_KEY);
    setBootstrap(null);
    setAttachments([]);
    setStatus("Synthetic session cleared. Reload this exact bootstrap URL to reinitialize.");
  }

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px 96px", color: "#172033" }}>
      <p style={{ color: "#8a4b08", fontWeight: 700 }}>THIS IS PREVIEW QA — NOT PRODUCTION</p>
      <h1>PR #1525 Maintenance Attachment QA</h1>
      <p data-testid="qa-status">{status}</p>
      {bootstrap && <section aria-label="Synthetic session">
        <dl>
          <dt>Fixed role</dt><dd>{bootstrap.session.role}</dd>
          <dt>Fixed principal</dt><dd>{bootstrap.session.principalId}</dd>
          <dt>Target request</dt><dd>{bootstrap.requestId}</dd>
          <dt>Deployment SHA</dt><dd>{bootstrap.deploymentSha.slice(0, 12)}</dd>
        </dl>
        <button type="button" onClick={reset}>End QA session</button>
      </section>}
      <section aria-label="Maintenance request attachments" style={{ marginTop: 28 }}>
        <h2>Synthetic kitchen leak</h2>
        <p>{attachments.length} of 5 photos attached. JPEG, PNG, or WebP; 10 MB per image, 25 MB total.</p>
        {bootstrap?.session.role === "tenant" && <label style={{ display: "inline-block", padding: 12, border: "1px solid #64748b", borderRadius: 8 }}>
          Add photos
          <input aria-label="Add photos" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || attachments.length >= 5} onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.currentTarget.value = "";
          }} style={{ display: "block", marginTop: 8 }} />
        </label>}
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginTop: 20 }}>
          {attachments.map((item) => <li key={item.attachmentId} style={{ border: "1px solid #d6dbe5", borderRadius: 10, padding: 12, overflowWrap: "anywhere", minWidth: 0 }}>
            <AuthorizedAttachmentThumbnail attachment={item} requestAccessUrl={requestAttachmentAccessUrl} />
            <strong>{item.filename}</strong>
            <p>{item.contentType} · {item.width}×{item.height} · {item.byteSize} bytes</p>
            <button type="button" onClick={() => void openAttachment(item.attachmentId)}>Open photo</button>{" "}
            {bootstrap?.session.role === "tenant" && <button type="button" disabled={busy} onClick={() => void remove(item.attachmentId)}>Remove</button>}
          </li>)}
        </ul>
      </section>
    </main>
  );
}
