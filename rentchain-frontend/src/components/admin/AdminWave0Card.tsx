import React, { useState } from "react";

export default function AdminWave0Card() {
  const [emails, setEmails] = useState("");
  const [out, setOut] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    setErr(null);
    setOut(null);
    try {
      const list = emails
        .split(/\r?\n|,|;/)
        .map((s) => s.trim())
        .filter(Boolean);
      const r = await fetch("/api/admin/micro-live/wave0/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: list, dryRun }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "Failed");
      setOut(j);
    } catch (e: any) {
      setErr(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 16 }}>
      <div style={{ fontWeight: 900, marginBottom: 8 }}>Wave 0 Invites</div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 8 }}>
        <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
        Dry run (no emails)
      </label>
      <textarea
        value={emails}
        onChange={(e) => setEmails(e.target.value)}
        placeholder="Enter up to 5 emails (newline or comma separated)"
        style={{ width: "100%", minHeight: 90, borderRadius: 12, border: "1px solid #ddd", padding: 10 }}
      />
      <div style={{ height: 10 }} />
      <button
        onClick={send}
        disabled={busy}
        style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid #ddd", fontWeight: 800 }}
      >
        {busy ? "Sending…" : "Send Wave 0"}
      </button>
      {err && <div style={{ marginTop: 10, color: "#b91c1c" }}>{err}</div>}
      {out && (
        <pre style={{ marginTop: 10, fontSize: 12, opacity: 0.85, whiteSpace: "pre-wrap" }}>
          {JSON.stringify(out, null, 2)}
        </pre>
      )}
    </div>
  );
}
