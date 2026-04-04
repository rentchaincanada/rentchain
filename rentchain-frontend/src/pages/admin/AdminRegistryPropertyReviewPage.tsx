import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { MacShell } from "../../components/layout/MacShell";
import { Button, Card, Input, Pill, Section } from "../../components/ui/Ui";
import {
  applyRegistryPidToProperty,
  fetchAdminPropertyRegistryReview,
  overrideAdminRegistryRecord,
  reEvaluateAdminPropertyRegistry,
  type AdminPropertyRegistryReview,
} from "../../api/adminRegistryApi";

export default function AdminRegistryPropertyReviewPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const [searchParams] = useSearchParams();
  const normalizedRecordId = searchParams.get("normalizedRecordId");
  const [detail, setDetail] = useState<AdminPropertyRegistryReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [reEvaluating, setReEvaluating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("Confirmed during property review");
  const [copiedPid, setCopiedPid] = useState(false);
  const [confirmPidOverwrite, setConfirmPidOverwrite] = useState(false);

  const load = async () => {
    if (!propertyId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await fetchAdminPropertyRegistryReview(propertyId, { normalizedRecordId });
      setDetail(result);
    } catch (err: any) {
      setError(err?.message || "Failed to load property registry review");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [propertyId, normalizedRecordId]);

  const handleReEvaluate = async () => {
    if (!propertyId) return;
    try {
      setReEvaluating(true);
      await reEvaluateAdminPropertyRegistry(propertyId);
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to re-evaluate property registry status");
    } finally {
      setReEvaluating(false);
    }
  };

  const handleConfirmSelected = async () => {
    if (!propertyId || !normalizedRecordId) return;
    try {
      setSaving(true);
      setError(null);
      await overrideAdminRegistryRecord({
        normalizedRecordId,
        action: "attach",
        propertyId,
        reason,
      });
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to confirm registry match");
    } finally {
      setSaving(false);
    }
  };

  const handleIgnoreSelected = async () => {
    if (!normalizedRecordId) return;
    try {
      setSaving(true);
      setError(null);
      await overrideAdminRegistryRecord({
        normalizedRecordId,
        action: "ignore",
        reason,
      });
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to ignore registry record");
    } finally {
      setSaving(false);
    }
  };

  const copyRegistryPid = async () => {
    const pid = detail?.selectedComparison?.registryPid;
    if (!pid) return;
    try {
      await navigator.clipboard.writeText(pid);
      setCopiedPid(true);
      window.setTimeout(() => setCopiedPid(false), 1500);
    } catch {
      setCopiedPid(false);
    }
  };

  const handleApplySelectedPid = async () => {
    if (!propertyId || !normalizedRecordId) return;
    try {
      setSaving(true);
      setError(null);
      await applyRegistryPidToProperty({
        normalizedRecordId,
        propertyId,
        reason,
        confirmOverwrite: confirmPidOverwrite,
      });
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to update property PID from registry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MacShell title="Admin · Property Registry Review">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Property Registry Review</h1>
                {detail?.projection ? <Pill tone="accent">{detail.projection.registryStatus}</Pill> : null}
              </div>
              <div style={{ color: "#475569", maxWidth: 760 }}>
                Inspect the current projected landlord-facing status and re-run evaluation when property details change.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button onClick={handleReEvaluate} disabled={reEvaluating}>
                {reEvaluating ? "Re-evaluating..." : "Re-evaluate"}
              </Button>
              <Link to="/admin/registry/review">
                <Button variant="secondary">Back to queue</Button>
              </Link>
              <Link to="/admin/registry/imports">
                <Button variant="secondary">Back to imports</Button>
              </Link>
            </div>
          </div>
        </Section>

        {loading ? <Card>Loading property review…</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>{error}</Card> : null}
        {!loading && detail ? (
          <>
            <Card style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 700 }}>{detail.property?.name || detail.property?.addressLine1 || detail.property?.id}</div>
              <div style={{ color: "#475569" }}>
                {[detail.property?.addressLine1, detail.property?.city, detail.property?.province, detail.property?.postalCode].filter(Boolean).join(", ")}
              </div>
              <div style={{ color: "#475569" }}>Internal PID: {detail.propertyPid || "--"}</div>
              <div style={{ color: "#475569" }}>Projected summary: {detail.projection?.summary || "--"}</div>
              <div style={{ color: "#475569" }}>Recommended action: {detail.projection?.recommendedAction || "--"}</div>
            </Card>

            {detail.selectedComparison ? (
              <Card style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontWeight: 700 }}>Property vs registry comparison</div>
                  <Pill tone={detail.selectedComparison.pidStatus === "exact_match" ? "accent" : "muted"}>
                    {detail.selectedComparison.pidStatus}
                  </Pill>
                </div>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                  <div style={{ border: "1px solid rgba(148,163,184,0.18)", borderRadius: 14, padding: 12, display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 600 }}>Internal property</div>
                    <div>{detail.selectedComparison.propertyName || detail.property?.name || detail.property?.id}</div>
                    <div style={{ color: "#475569" }}>{detail.selectedComparison.propertyAddress || "--"}</div>
                    <div style={{ color: "#475569" }}>PID: {detail.selectedComparison.propertyPid || "--"}</div>
                    <div style={{ color: "#475569" }}>Units: {detail.selectedComparison.propertyUnitCount ?? "--"}</div>
                    <div style={{ color: "#475569" }}>Building: {detail.selectedComparison.propertyBuildingType || "--"}</div>
                  </div>
                  <div style={{ border: "1px solid rgba(148,163,184,0.18)", borderRadius: 14, padding: 12, display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 600 }}>Registry candidate</div>
                    <div>{detail.selectedComparison.registryRegistrationNumber || detail.selectedComparison.registryRecordId || "--"}</div>
                    <div style={{ color: "#475569" }}>{detail.selectedComparison.registryAddress || "--"}</div>
                    <div style={{ color: "#475569", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span>PID: {detail.selectedComparison.registryPid || "--"}</span>
                      {detail.selectedComparison.registryPid ? (
                        <Button variant="secondary" onClick={() => void copyRegistryPid()}>
                          {copiedPid ? "PID copied" : "Copy registry PID"}
                        </Button>
                      ) : null}
                    </div>
                    <div style={{ color: "#475569" }}>Units: {detail.selectedComparison.registryUnitCount ?? "--"}</div>
                    <div style={{ color: "#475569" }}>Building: {detail.selectedComparison.registryBuildingType || "--"}</div>
                  </div>
                </div>
                {detail.selectedComparison.operatorPrompts?.length ? (
                  <div style={{ color: "#92400e" }}>{detail.selectedComparison.operatorPrompts.join(" ")}</div>
                ) : null}
                {detail.selectedComparison.reasonSummary?.length ? (
                  <div style={{ color: "#64748b" }}>{detail.selectedComparison.reasonSummary.join(" ")}</div>
                ) : null}
                <Input placeholder="Reason" value={reason} onChange={(event) => setReason(event.target.value)} />
                {(detail.selectedComparison.pidStatus === "missing_internal_pid" || detail.selectedComparison.pidStatus === "mismatch") &&
                detail.selectedComparison.registryPid ? (
                  <>
                    <label style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "#475569", fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={confirmPidOverwrite}
                        onChange={(event) => setConfirmPidOverwrite(event.target.checked)}
                      />
                      <span>
                        {detail.selectedComparison.pidStatus === "mismatch"
                          ? "Confirm replacing the current property PID with the selected Halifax registry PID."
                          : "Confirm applying the selected Halifax registry PID to this property."}
                      </span>
                    </label>
                    <div style={{ color: "#64748b", fontSize: 13 }}>
                      Applying the registry PID may improve future exact matching for this property.
                    </div>
                  </>
                ) : null}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Button onClick={() => void handleConfirmSelected()} disabled={saving || !reason.trim()}>
                    {saving ? "Saving..." : "Confirm this match"}
                  </Button>
                  {(detail.selectedComparison.pidStatus === "missing_internal_pid" || detail.selectedComparison.pidStatus === "mismatch") &&
                  detail.selectedComparison.registryPid ? (
                    <Button
                      variant="secondary"
                      onClick={() => void handleApplySelectedPid()}
                      disabled={saving || !reason.trim() || (detail.selectedComparison.pidStatus === "mismatch" && !confirmPidOverwrite)}
                    >
                      Update property PID from registry
                    </Button>
                  ) : null}
                  <Button variant="secondary" onClick={() => void handleIgnoreSelected()} disabled={saving || !reason.trim()}>
                    Ignore record
                  </Button>
                  {detail.selectedRecord?.id ? (
                    <Link to={`/admin/registry/records/${encodeURIComponent(detail.selectedRecord.id)}`}>
                      <Button variant="secondary">Open registry record</Button>
                    </Link>
                  ) : null}
                </div>
              </Card>
            ) : null}

            <Card style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 700 }}>Matched Registry Records</div>
              {!detail.matchDetails?.length ? <div style={{ color: "#475569" }}>No registry matches are currently linked to this property.</div> : null}
              {detail.matchDetails?.map((match) => (
                <div key={match.id} style={{ border: "1px solid rgba(148,163,184,0.18)", borderRadius: 14, padding: 12, display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ fontWeight: 700 }}>{match.registryRecordId}</div>
                    <Pill tone={match.matchStatus === "matched" ? "accent" : "muted"}>{match.matchStatus}</Pill>
                  </div>
                  <div style={{ color: "#475569", fontSize: 14 }}>
                    Method: {match.matchMethod || "--"} · Score: {match.matchScore}
                  </div>
                  <div style={{ color: "#475569", fontSize: 14 }}>
                    PID: {match.comparison?.propertyPid || "--"} vs {match.comparison?.registryPid || "--"}
                  </div>
                  {match.reasonSummary?.length ? <div style={{ color: "#64748b", fontSize: 13 }}>{match.reasonSummary.join(" ")}</div> : null}
                  {match.normalizedRecordId ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Link to={`/admin/registry/records/${encodeURIComponent(match.normalizedRecordId)}`}>
                        <Button variant="secondary">Open record</Button>
                      </Link>
                      <Link to={`/admin/registry/properties/${encodeURIComponent(propertyId || "")}?normalizedRecordId=${encodeURIComponent(match.normalizedRecordId)}`}>
                        <Button variant="secondary">Compare again</Button>
                      </Link>
                    </div>
                  ) : null}
                </div>
              ))}
            </Card>
          </>
        ) : null}
      </div>
    </MacShell>
  );
}
