import React, { useState } from "react";
import { submitTenantIssue, TenantIssuePayload } from "../../api/tenantPortalApi";

export default function TenantPortalIssuePage() {
  const [form, setForm] = useState<TenantIssuePayload>({
    category: "other",
    subject: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleChange =
    (key: keyof TenantIssuePayload) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setForm((prev: TenantIssuePayload) => ({ ...prev, [key]: value }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setStatus(null);
    try {
      await submitTenantIssue(form);
      setStatus("submitted");
    } catch (err: any) {
      setStatus(err?.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 520, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Submit an issue</h1>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Subject</span>
          <input
            type="text"
            value={form.subject}
            onChange={handleChange("subject")}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Category</span>
          <input
            type="text"
            value={form.category}
            onChange={handleChange("category")}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Message</span>
          <textarea
            value={form.message}
            onChange={handleChange("message")}
            rows={5}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}
          />
        </label>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111827",
              background: "#111827",
              color: "#fff",
              fontWeight: 700,
              cursor: submitting ? "default" : "pointer",
            }}
          >
            {submitting ? "Sending..." : "Submit issue"}
          </button>
          <button
            type="button"
            onClick={() => setForm((prev: TenantIssuePayload) => ({ ...prev, subject: "", message: "" }))}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        </div>

        {status ? <div style={{ fontSize: 13, opacity: 0.9 }}>Status: {status}</div> : null}
      </form>
    </div>
  );
}
