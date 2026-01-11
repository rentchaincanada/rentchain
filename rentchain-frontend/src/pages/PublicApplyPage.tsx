import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchPublicApplicationLink, submitPublicApplication } from "@/api/publicApplications";

type ApplyParams = {
  token?: string;
};

export default function PublicApplyPage() {
  const { token } = useParams<ApplyParams>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [context, setContext] = useState<{ propertyName?: string | null; unitLabel?: string | null; landlordDisplayName?: string | null }>({});

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!token) {
        setError("Missing application link token.");
        setLoading(false);
        return;
      }
      setError(null);
      try {
        const res = await fetchPublicApplicationLink(token);
        if (!alive) return;
        setContext(res.context || {});
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "This application link is invalid or expired.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setError("Missing application link token.");
      return;
    }
    if (!fullName || !email || !phone) {
      setError("Full name, email, and phone are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const resp = await submitPublicApplication({
        token,
        applicant: { fullName, email, phone, message: message || undefined },
      });
      setSubmitted(true);
      setApplicationId(resp.applicationId || null);
    } catch (e: any) {
      setError(e?.message || "Could not submit application.");
    } finally {
      setSubmitting(false);
    }
  }

  const header = (
    <div style={{ marginBottom: 16 }}>
      <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Rental application</h1>
      <div style={{ opacity: 0.8, fontSize: "0.95rem" }}>
        {context.propertyName || "Property"} {context.unitLabel ? `· Unit ${context.unitLabel}` : ""}
      </div>
      {context.landlordDisplayName ? (
        <div style={{ opacity: 0.7, fontSize: "0.85rem", marginTop: 4 }}>
          Invited by {context.landlordDisplayName}
        </div>
      ) : null}
    </div>
  );

  if (loading) {
    return (
      <div style={{ maxWidth: 620, margin: "40px auto", padding: "0 16px" }}>
        {header}
        <div>Loading application…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 620, margin: "40px auto", padding: "0 16px" }}>
        {header}
        <div
          style={{
            border: "1px solid #fca5a5",
            background: "#fef2f2",
            padding: 12,
            borderRadius: 8,
          }}
        >
          {error}
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ maxWidth: 620, margin: "40px auto", padding: "0 16px" }}>
        {header}
        <div
          style={{
            border: "1px solid #c7f9cc",
            background: "#f0fff4",
            padding: 14,
            borderRadius: 10,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Application submitted</div>
          <div style={{ opacity: 0.85 }}>
            Thank you for applying. A property manager may contact you if additional information is needed.
          </div>
          {applicationId ? (
            <div style={{ marginTop: 8, fontSize: "0.9rem" }}>
              Reference ID: <code>{applicationId}</code>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 620, margin: "40px auto", padding: "0 16px" }}>
      {header}
      <form
        onSubmit={handleSubmit}
        style={{
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
          background: "#fff",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {error ? (
          <div
            style={{
              border: "1px solid #fca5a5",
              background: "#fef2f2",
              padding: 10,
              borderRadius: 8,
            }}
          >
            {error}
          </div>
        ) : null}

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Full name *</span>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db" }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Email *</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db" }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Phone *</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db" }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Message (optional)</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", resize: "vertical" }}
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: "none",
            background: "#111827",
            color: "#fff",
            fontWeight: 700,
            cursor: submitting ? "default" : "pointer",
          }}
        >
          {submitting ? "Submitting…" : "Submit application"}
        </button>
      </form>
    </div>
  );
}
