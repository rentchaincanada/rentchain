import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getTenantIdentityRequirement, type TenantIdentityRequirementStatus } from "../../api/tenantIdentityDocumentsApi";

export default function TenantIdentityRequirementCard() {
  const [status, setStatus] = useState<TenantIdentityRequirementStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getTenantIdentityRequirement()
      .then((next) => { if (!cancelled) setStatus(next); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const received = status?.collectionStatus === "received";
  return (
    <section aria-labelledby="tenant-identity-reminder-heading" style={{
      display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14,
      padding: "16px 18px", border: `1px solid ${received ? "#bbf7d0" : "#fed7aa"}`,
      borderRadius: 14, background: received ? "#f0fdf4" : "#fff7ed",
    }}>
      <div style={{ display: "grid", gap: 4 }}>
        <strong id="tenant-identity-reminder-heading" style={{ color: "#0f172a" }}>
          {received ? "Government ID received" : "Government ID required"}
        </strong>
        <span style={{ color: "#475569" }}>
          {received ? "Your private image is stored. Verification has not started." : "Upload one approved government-issued photo ID to complete this mandatory requirement."}
        </span>
      </div>
      <Link to="/tenant/identity" style={{ fontWeight: 800, color: "#6d28d9" }}>
        {received ? "Manage government ID" : "Upload government ID"}
      </Link>
    </section>
  );
}
