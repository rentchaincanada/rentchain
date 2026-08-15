import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { G1C_QA_SESSION_KEY } from "../../api/tenantIdentityDocumentsApi";

export default function G1cPreviewIdentityGate(props: { qa: React.ReactNode; normal: React.ReactNode }) {
  const location = useLocation();
  const requested = new URLSearchParams(location.search).get("g1cQa") === "1";
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    if (!requested) return setState("unavailable");
    let cancelled = false;
    void fetch("/api/g1c-bootstrap", { headers: { accept: "application/json" } })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || payload?.scope !== "g1c-synthetic-identity-qa-v1" || payload?.session?.principalId !== "qa-g1c-tenant") {
          throw new Error("bootstrap unavailable");
        }
        window.sessionStorage.setItem(G1C_QA_SESSION_KEY, JSON.stringify(payload));
        if (!cancelled) setState("ready");
      })
      .catch(() => {
        window.sessionStorage.removeItem(G1C_QA_SESSION_KEY);
        if (!cancelled) setState("unavailable");
      });
    return () => { cancelled = true; };
  }, [requested]);

  if (!requested || state === "unavailable") return <>{props.normal}</>;
  if (state === "loading") return <main style={{ padding: 24 }}>Initializing fixed synthetic Preview tenant…</main>;
  return <>{props.qa}</>;
}
