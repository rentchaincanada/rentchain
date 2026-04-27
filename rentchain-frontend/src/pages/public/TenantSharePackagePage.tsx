import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createApplyWithRentChainContext,
  fetchPublicTenantSharePackage,
  requestPublicTenantSharePackageVerification,
} from "../../api/publicTenantSharePackageApi";

function prettyStatus(value: string | null | undefined) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function TenantSharePackagePage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [data, setData] = React.useState<Awaited<ReturnType<typeof fetchPublicTenantSharePackage>> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [requesting, setRequesting] = React.useState(false);
  const [requestError, setRequestError] = React.useState<string | null>(null);
  const [applyLoading, setApplyLoading] = React.useState(false);
  const [applyError, setApplyError] = React.useState<string | null>(null);
  const [requestedItems, setRequestedItems] = React.useState<
    Array<
      "credibility_summary" | "application_summary" | "documents_summary" | "lease_summary" | "payment_readiness_summary"
    >
  >([]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchPublicTenantSharePackage(token);
        if (!mounted) return;
        if (!result) {
          setError("This shared rental profile is unavailable.");
          setData(null);
          return;
        }
        setData(result);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || "This shared rental profile is unavailable.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  const toggleRequestItem = React.useCallback(
    (
      item:
        | "credibility_summary"
        | "application_summary"
        | "documents_summary"
        | "lease_summary"
        | "payment_readiness_summary"
    ) => {
      setRequestedItems((current) =>
        current.includes(item) ? current.filter((entry) => entry !== item) : [...current, item]
      );
    },
    []
  );

  const handleRequest = React.useCallback(async () => {
    try {
      setRequesting(true);
      setRequestError(null);
      await requestPublicTenantSharePackageVerification(token, requestedItems);
    } catch (err: any) {
      setRequestError(err?.message || "Unable to save this request right now.");
    } finally {
      setRequesting(false);
    }
  }, [requestedItems, token]);

  const handleApplyWithRentChain = React.useCallback(async () => {
    try {
      setApplyLoading(true);
      setApplyError(null);
      const result = await createApplyWithRentChainContext(token);
      if (!result?.applyWithRentChain) {
        setApplyError("This shared rental profile is unavailable.");
        return;
      }
      navigate("/apply", {
        state: {
          applyWithRentChain: result.applyWithRentChain,
        },
      });
    } catch (err: any) {
      setApplyError(err?.message || "Unable to prepare this application right now.");
    } finally {
      setApplyLoading(false);
    }
  }, [navigate, token]);

  const availableSections = new Set(data?.availability?.availableSections || []);
  const canApplyWithRentChain = Boolean(
    data?.identityExchangeReference &&
      (data.identityExchangeReference.referenceStatus === "available" ||
        data.identityExchangeReference.referenceStatus === "limited") &&
      (availableSections.has("identity") || availableSections.has("application"))
  );

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)", padding: 24 }}>
      <div style={{ maxWidth: 860, margin: "0 auto", display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Shared Rental Profile</h1>
          <div style={{ color: "#475569" }}>
            A tenant-approved summary of rental readiness and verification signals.
          </div>
        </div>

        {loading ? (
          <div style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 16, background: "#fff", padding: 18 }}>
            Loading shared rental profile…
          </div>
        ) : null}

        {!loading && error ? (
          <div style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 16, background: "#fff", padding: 18, color: "#b91c1c" }}>
            {error}
          </div>
        ) : null}

        {!loading && !error && data ? (
          <div style={{ display: "grid", gap: 16 }}>
            {data.identity ? (
              <div style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 16, background: "#fff", padding: 18, display: "grid", gap: 8 }}>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>{data.identity.readinessLabel}</div>
                <div style={{ color: "#475569", lineHeight: 1.6 }}>{data.identity.readinessDescription}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  {[
                    ["Identity status", prettyStatus(data.identity.identityStatus)],
                    ["Verification", prettyStatus(data.identity.verification.level)],
                  ].map(([label, value]) => (
                    <div key={label} style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 12, padding: "12px 14px", display: "grid", gap: 4 }}>
                      <div style={{ color: "#64748b", fontSize: "0.85rem" }}>{label}</div>
                      <div style={{ color: "#0f172a", fontWeight: 700 }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {data.identityExchangeReference ? (
              <div style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 16, background: "#fff", padding: 18, display: "grid", gap: 8 }}>
                <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>Identity exchange</div>
                <div style={{ color: "#0f172a", fontWeight: 700 }}>{data.identityExchangeReference.referenceLabel}</div>
                <div style={{ color: "#475569", lineHeight: 1.6 }}>{data.identityExchangeReference.referenceDescription}</div>
                {canApplyWithRentChain ? (
                  <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
                    <button
                      type="button"
                      onClick={() => void handleApplyWithRentChain()}
                      disabled={applyLoading}
                    >
                      {applyLoading ? "Preparing application..." : "Apply with RentChain"}
                    </button>
                    <div style={{ color: "#475569", fontSize: "0.92rem" }}>
                      Use the tenant-approved profile details already shared here to start an application faster.
                    </div>
                    {applyError ? <div style={{ color: "#b91c1c" }}>{applyError}</div> : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 16, background: "#fff", padding: 18, display: "grid", gap: 12 }}>
              <div style={{ fontWeight: 800, color: "#0f172a" }}>Available information</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                {[
                  ["Credibility summary", availableSections.has("credibilitySummary"), data.credibilitySummary?.summaryLabel || "Unavailable"],
                  ["Application summary", availableSections.has("application"), data.application?.reusable ? "Reusable application available" : "Unavailable"],
                  ["Documents summary", availableSections.has("documents"), data.documents ? prettyStatus(data.documents.completionStatus) : "Unavailable"],
                  ["Lease summary", availableSections.has("leaseSummary"), data.leaseSummary?.status ? prettyStatus(data.leaseSummary.status) : "Unavailable"],
                  [
                    "Payment readiness summary",
                    availableSections.has("paymentReadinessSummary"),
                    data.paymentReadinessSummary?.readinessLabel || "Unavailable",
                  ],
                ].map(([label, available, value]) => (
                  <div key={String(label)} style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 12, padding: "12px 14px", display: "grid", gap: 4 }}>
                    <div style={{ color: "#64748b", fontSize: "0.85rem" }}>{label}</div>
                    <div style={{ color: "#0f172a", fontWeight: 700 }}>{available ? value : "Unavailable"}</div>
                  </div>
                ))}
              </div>
              {data.credibilitySummary ? (
                <div style={{ color: "#475569", lineHeight: 1.6 }}>{data.credibilitySummary.summaryDescription}</div>
              ) : null}
              {data.paymentReadinessSummary ? (
                <div style={{ color: "#475569", lineHeight: 1.6 }}>{data.paymentReadinessSummary.readinessDescription}</div>
              ) : null}
            </div>

            <div style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 16, background: "#fff", padding: 18, display: "grid", gap: 12 }}>
              <div style={{ fontWeight: 800, color: "#0f172a" }}>Request additional information</div>
              <div style={{ color: "#475569", lineHeight: 1.6 }}>
                Request additional summary sections. Access is only expanded if the tenant approves it later.
              </div>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={requestedItems.includes("credibility_summary")}
                  onChange={() => toggleRequestItem("credibility_summary")}
                />
                Credibility summary
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={requestedItems.includes("application_summary")}
                  onChange={() => toggleRequestItem("application_summary")}
                />
                Application summary
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={requestedItems.includes("documents_summary")}
                  onChange={() => toggleRequestItem("documents_summary")}
                />
                Documents summary
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={requestedItems.includes("lease_summary")}
                  onChange={() => toggleRequestItem("lease_summary")}
                />
                Lease summary
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={requestedItems.includes("payment_readiness_summary")}
                  onChange={() => toggleRequestItem("payment_readiness_summary")}
                />
                Payment readiness summary
              </label>
              <div>
                <button type="button" onClick={() => void handleRequest()} disabled={requesting || requestedItems.length === 0}>
                  {requesting ? "Requesting..." : "Request verification"}
                </button>
              </div>
              {requestError ? <div style={{ color: "#b91c1c" }}>{requestError}</div> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
