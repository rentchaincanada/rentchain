import React, { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL } from "../api/config";
import { Button, Card } from "../components/ui/Ui";
import { spacing, text } from "../styles/tokens";

const VerifyScreeningPage: React.FC = () => {
  const { token } = useParams();
  const [consentName, setConsentName] = useState("");
  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const base = useMemo(() => {
    const raw = (API_BASE_URL || "").replace(/\/$/, "").replace(/\/api$/i, "");
    return raw || "";
  }, []);

  const handleStart = async () => {
    setError(null);
    if (!token) {
      setError("Invalid invite link.");
      return;
    }
    if (!consented) {
      setError("Please confirm consent to continue.");
      return;
    }
    if (!consentName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${base}/api/screening/tenant/${encodeURIComponent(token)}/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-client": "web" },
        body: JSON.stringify({ consentName: consentName.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Unable to start verification.");
        setSubmitting(false);
        return;
      }
      if (json?.redirectUrl) {
        window.location.assign(json.redirectUrl);
        return;
      }
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "Unable to start verification.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.lg,
        background: "#f8fafc",
      }}
    >
      <Card style={{ maxWidth: 520, width: "100%", padding: spacing.lg }}>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: text.subtle }}>
              Powered by TransUnion
            </div>
            <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>Verify your screening</h1>
            <div style={{ color: text.muted, marginTop: 6 }}>
              Soft credit inquiry (no score impact).
            </div>
          </div>

          {done ? (
            <div style={{ color: text.muted }}>
              Thanks! Your verification is in progress. You can close this page.
            </div>
          ) : (
            <>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 13, color: text.subtle }}>Full legal name</span>
                <input
                  type="text"
                  value={consentName}
                  onChange={(e) => setConsentName(e.target.value)}
                  placeholder="Jane Doe"
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                  }}
                />
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <input
                  type="checkbox"
                  checked={consented}
                  onChange={(e) => setConsented(e.target.checked)}
                  style={{ marginTop: 4 }}
                />
                <span style={{ fontSize: 13, color: text.muted }}>
                  I consent to RentChain and TransUnion collecting and using my information for tenant
                  screening and identity verification.
                </span>
              </label>

              {error ? (
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ color: "#b91c1c", fontSize: 13 }}>{error}</div>
                  <a
                    href="https://www.rentchain.ai/help/screening"
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 13, color: text.subtle }}
                  >
                    Need help?
                  </a>
                </div>
              ) : null}

              <Button type="button" onClick={handleStart} disabled={submitting}>
                {submitting ? "Starting..." : "Start verification"}
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
};

export default VerifyScreeningPage;
