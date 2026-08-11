import { useEffect, useState } from "react";
import {
  PR1516_QA_BOOTSTRAP_PATH,
  activatePr1516BrowserQaSession,
  getPr1516QaBuildContract,
  isValidPr1516BootstrapResponse,
} from "../runtime/pr1516BrowserQaBootstrap";

export default function Pr1516QaBootstrapPage() {
  const [status, setStatus] = useState("Verifying isolated PR #1516 QA access...");

  useEffect(() => {
    const contract = getPr1516QaBuildContract();
    if (!contract.valid) {
      setStatus("This QA bootstrap is unavailable in this deployment.");
      return;
    }
    void (async () => {
      try {
        const response = await fetch(PR1516_QA_BOOTSTRAP_PATH, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
          credentials: "same-origin",
        });
        const body = await response.json().catch(() => null);
        if (!response.ok || !isValidPr1516BootstrapResponse(body, contract.commitSha)) {
          throw new Error("bootstrap contract rejected");
        }
        activatePr1516BrowserQaSession(window.sessionStorage, contract.commitSha);
        window.location.replace("/notices");
      } catch {
        setStatus("Unable to establish the isolated PR #1516 QA session.");
      }
    })();
  }, []);

  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}><p>{status}</p></main>;
}
