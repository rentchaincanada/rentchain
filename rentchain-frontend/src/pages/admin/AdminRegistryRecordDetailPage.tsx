import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MacShell } from "../../components/layout/MacShell";
import { Button, Card, Input, Pill, Section } from "../../components/ui/Ui";
import {
  applyRegistryPidToProperty,
  fetchAdminRegistryRecordDetail,
  overrideAdminRegistryRecord,
  searchAdminRegistryAttachProperties,
  type RegistryAttachPropertySearchResult,
  type RegistryPropertyComparison,
  type RegistryRecordDetail,
} from "../../api/adminRegistryApi";

function pidTone(status: RegistryPropertyComparison["pidStatus"] | undefined) {
  if (status === "exact_match") return "accent";
  if (status === "mismatch" || status === "missing_internal_pid") return "muted";
  return "muted";
}

function summarizeProperty(candidate: {
  id?: string | null;
  name?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  pid?: string | null;
}) {
  return [
    `Property: ${candidate.name || candidate.addressLine1 || candidate.id || "--"}`,
    `Property document ID: ${candidate.id || "--"}`,
    `Address: ${[candidate.addressLine1, candidate.city, candidate.province, candidate.postalCode].filter(Boolean).join(", ") || "--"}`,
    `Property PID: ${candidate.pid || "--"}`,
  ].join("\n");
}

export default function AdminRegistryRecordDetailPage() {
  const { normalizedRecordId } = useParams<{ normalizedRecordId: string }>();
  const [detail, setDetail] = useState<RegistryRecordDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<RegistryAttachPropertySearchResult[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [reason, setReason] = useState("Manual registry review");
  const [copiedPid, setCopiedPid] = useState(false);
  const [confirmPidOverwrite, setConfirmPidOverwrite] = useState(false);
  const [replaceExistingMatch, setReplaceExistingMatch] = useState(false);

  const load = async () => {
    if (!normalizedRecordId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await fetchAdminRegistryRecordDetail(normalizedRecordId);
      setDetail(result);
    } catch (err: any) {
      setError(err?.message || "Failed to load registry record");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [normalizedRecordId]);

  useEffect(() => {
    let active = true;
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        setSearching(true);
        const items = await searchAdminRegistryAttachProperties(q);
        if (!active) return;
        setSearchResults(items);
      } catch {
        if (!active) return;
        setSearchResults([]);
      } finally {
        if (active) setSearching(false);
      }
    }, 200);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  const handleOverride = async (
    action: "attach" | "ignore" | "return_to_review" | "detach",
    overridePropertyId?: string | null
  ) => {
    if (!normalizedRecordId) return;
    const selectedCandidate =
      searchResults.find((candidate) => candidate.id === (overridePropertyId || propertyId)) ||
      detail?.currentLinkedProperty ||
      null;
    if (action === "attach") {
      const message = [
        "You are linking this Halifax registry record to the selected property.",
        summarizeProperty({
          id: overridePropertyId || propertyId,
          name: selectedCandidate?.name || null,
          addressLine1: selectedCandidate?.addressLine1 || null,
          city: selectedCandidate?.city || null,
          province: selectedCandidate?.province || null,
          postalCode: selectedCandidate?.postalCode || null,
          pid: selectedCandidate?.pid || null,
        }),
        `Registry record ID: ${detail?.normalizedRecord?.registryRecordId || "--"}`,
        `Registration number: ${detail?.normalizedRecord?.registrationNumber || "--"}`,
        `Registry PID: ${detail?.normalizedRecord?.pid || "--"}`,
        "Source: Halifax Residential Rental Registry",
        "Warning: this may affect future automatic matching.",
      ].join("\n\n");
      if (!window.confirm(message)) return;
    }
    if (action === "detach") {
      const message = [
        "Detach this registry record from its currently linked property?",
        summarizeProperty({
          id: detail?.currentLinkedProperty?.id || detail?.match?.propertyId || "--",
          name: detail?.currentLinkedProperty?.name || null,
          addressLine1: detail?.currentLinkedProperty?.addressLine1 || null,
          city: detail?.currentLinkedProperty?.city || null,
          province: detail?.currentLinkedProperty?.province || null,
          postalCode: detail?.currentLinkedProperty?.postalCode || null,
          pid: detail?.currentLinkedProperty?.pid || null,
        }),
        "This clears the trusted link and refreshes landlord-facing registry status.",
      ].join("\n\n");
      if (!window.confirm(message)) return;
    }
    try {
      setSaving(true);
      setError(null);
      await overrideAdminRegistryRecord({
        normalizedRecordId,
        action,
        propertyId: action === "attach" ? overridePropertyId || propertyId : null,
        reason,
        replaceExistingMatch,
      });
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to apply registry override");
    } finally {
      setSaving(false);
    }
  };

  const copyRegistryPid = async () => {
    const pid = detail?.normalizedRecord?.pid;
    if (!pid) return;
    try {
      await navigator.clipboard.writeText(pid);
      setCopiedPid(true);
      window.setTimeout(() => setCopiedPid(false), 1500);
    } catch {
      setCopiedPid(false);
    }
  };

  const handleApplyRegistryPid = async (targetPropertyId: string) => {
    if (!normalizedRecordId) return;
    const target =
      searchResults.find((candidate) => candidate.id === targetPropertyId) ||
      detail?.candidates?.find((candidate) => candidate.propertyId === targetPropertyId) ||
      null;
    const confirmed = window.confirm(
      [
        "Apply Halifax registry PID to this property?",
        summarizeProperty({
          id: targetPropertyId,
          name: (target as any)?.propertyName || (target as any)?.name || null,
          addressLine1: (target as any)?.addressLine1 || null,
          city: (target as any)?.city || null,
          province: (target as any)?.province || null,
          postalCode: (target as any)?.postalCode || null,
          pid: (target as any)?.pid || (target as any)?.comparison?.propertyPid || null,
        }),
        `Registry record ID: ${detail?.normalizedRecord?.registryRecordId || "--"}`,
        `Registration number: ${detail?.normalizedRecord?.registrationNumber || "--"}`,
        `Registry PID: ${detail?.normalizedRecord?.pid || "--"}`,
        "Source: Halifax Residential Rental Registry",
        "Warning: this may affect future automatic matching.",
      ].join("\n\n")
    );
    if (!confirmed) return;
    try {
      setSaving(true);
      setError(null);
      await applyRegistryPidToProperty({
        normalizedRecordId,
        propertyId: targetPropertyId,
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
    <MacShell title="Admin · Registry Record">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Registry Record Detail</h1>
                {detail?.match ? <Pill tone={detail.match.matchStatus === "matched" ? "accent" : "muted"}>{detail.match.matchStatus}</Pill> : null}
              </div>
              <div style={{ color: "#475569", maxWidth: 760 }}>
                Review the raw Halifax row, normalized values, candidate properties, and audit trail before confirming a property link.
              </div>
            </div>
            <Link to="/admin/registry/review">
              <Button variant="secondary">Back to queue</Button>
            </Link>
          </div>
        </Section>

        {loading ? <Card>Loading registry record…</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>{error}</Card> : null}
        {!loading && detail ? (
          <>
            <Card style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 700 }}>Normalized Registry Record</div>
              <div>Registry record ID: {detail.normalizedRecord?.registryRecordId}</div>
              <div>Address: {detail.normalizedRecord?.addressRaw || "--"}</div>
              <div>Status: {detail.normalizedRecord?.registrationStatusNormalized || "--"}</div>
              <div>Registration number: {detail.normalizedRecord?.registrationNumber || "--"}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span>Registry PID: {detail.normalizedRecord?.pid || "--"}</span>
                {detail.normalizedRecord?.pid ? (
                  <Button variant="secondary" onClick={() => void copyRegistryPid()}>
                    {copiedPid ? "PID copied" : "Copy registry PID"}
                  </Button>
                ) : null}
              </div>
              {detail.currentLinkedProperty ? (
                <div style={{ display: "grid", gap: 4, padding: 12, borderRadius: 12, background: "#f8fafc" }}>
                  <div style={{ fontWeight: 600 }}>Currently linked property</div>
                  <div>{detail.currentLinkedProperty.name || detail.currentLinkedProperty.addressLine1 || detail.currentLinkedProperty.id}</div>
                  <div style={{ color: "#475569", fontSize: 14 }}>
                    {[detail.currentLinkedProperty.addressLine1, detail.currentLinkedProperty.city, detail.currentLinkedProperty.province, detail.currentLinkedProperty.postalCode]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    Property document ID: {detail.currentLinkedProperty.id} · Property PID: {detail.currentLinkedProperty.pid || "--"}
                  </div>
                </div>
              ) : null}
              {detail.operatorReview?.reasonSummary?.length ? (
                <div style={{ color: "#92400e" }}>Review notes: {detail.operatorReview.reasonSummary.join(" ")}</div>
              ) : null}
            </Card>

            <Card style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 700 }}>Manual Review Controls</div>
              <Input
                placeholder="Search Halifax properties by name, address, or city"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              {searching ? <div style={{ color: "#475569", fontSize: 14 }}>Searching properties…</div> : null}
              {!searching && searchQuery.trim() && !searchResults.length ? (
                <div style={{ color: "#64748b", fontSize: 14 }}>No matching admin-visible Halifax properties found.</div>
              ) : null}
              {searchResults.length ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {searchResults.map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => setPropertyId(candidate.id)}
                      style={{
                        textAlign: "left",
                        padding: 12,
                        borderRadius: 12,
                        border: propertyId === candidate.id ? "1px solid #2563eb" : "1px solid rgba(148,163,184,0.2)",
                        background: propertyId === candidate.id ? "rgba(37,99,235,0.08)" : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{candidate.name || candidate.id}</div>
                      <div style={{ color: "#475569", fontSize: 14 }}>
                        {[candidate.addressLine1, candidate.city, candidate.province, candidate.postalCode].filter(Boolean).join(", ")}
                      </div>
                      <div style={{ color: "#64748b", fontSize: 13 }}>
                        Property document ID: {candidate.id} · Property PID: {candidate.pid || "--"} · Units: {candidate.unitCount ?? "--"}
                        {candidate.ownerUserId || candidate.landlordId ? ` · Owner/Landlord: ${candidate.ownerUserId || candidate.landlordId}` : ""}
                      </div>
                      {detail.match?.propertyId === candidate.id ? (
                        <div style={{ color: "#0f172a", fontSize: 13, fontWeight: 600 }}>Currently linked property</div>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
              <Input placeholder="Property document ID for manual attach fallback" value={propertyId} onChange={(event) => setPropertyId(event.target.value)} />
              <Input placeholder="Reason" value={reason} onChange={(event) => setReason(event.target.value)} />
              <div style={{ color: "#64748b", fontSize: 13 }}>
                Search and select a property above, or enter a valid property document ID manually as a fallback.
              </div>
              {detail.propertyConflict ? (
                <div style={{ color: "#92400e", fontSize: 13 }}>
                  Conflict warning: the selected property already has an active Halifax registry match. Confirm replacement to proceed, or open the current property review first.
                </div>
              ) : null}
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "#475569", fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={replaceExistingMatch}
                  onChange={(event) => setReplaceExistingMatch(event.target.checked)}
                />
                <span>Replace the property's existing active Halifax match if one already exists.</span>
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "#475569", fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={confirmPidOverwrite}
                  onChange={(event) => setConfirmPidOverwrite(event.target.checked)}
                />
                <span>Allow PID overwrite when the property already has a different PID.</span>
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button onClick={() => void handleOverride("attach")} disabled={saving || !propertyId.trim() || !reason.trim()}>
                  {saving ? "Saving..." : "Attach to property"}
                </Button>
                {detail.match?.propertyId ? (
                  <Button variant="secondary" onClick={() => void handleOverride("detach")} disabled={saving || !reason.trim()}>
                    Detach from property
                  </Button>
                ) : null}
                <Button variant="secondary" onClick={() => void handleOverride("ignore")} disabled={saving || !reason.trim()}>
                  Ignore record
                </Button>
                {detail.match?.matchStatus === "ignored" || detail.match?.propertyId ? (
                  <Button variant="secondary" onClick={() => void handleOverride("return_to_review")} disabled={saving || !reason.trim()}>
                    Return to review
                  </Button>
                ) : null}
              </div>
            </Card>

            <Card style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 700 }}>Candidate Properties</div>
              {!detail.candidates?.length ? <div style={{ color: "#475569" }}>No likely property candidates were found.</div> : null}
              {detail.candidates?.map((candidate) => (
                <div key={candidate.propertyId} style={{ border: "1px solid rgba(148,163,184,0.2)", borderRadius: 14, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ fontWeight: 700 }}>{candidate.propertyName || candidate.propertyId}</div>
                    <Pill tone={pidTone(candidate.comparison?.pidStatus)}>{candidate.comparison?.pidStatus || "review"}</Pill>
                  </div>
                  <div style={{ color: "#475569", fontSize: 14 }}>{[candidate.addressLine1, candidate.city, candidate.province].filter(Boolean).join(", ")}</div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    Score: {candidate.score} · Property document ID: {candidate.propertyId} · Property PID: {candidate.pid || "--"} · Units: {candidate.unitCount ?? "--"}
                  </div>
                  {candidate.comparison ? (
                    <div style={{ display: "grid", gap: 8, marginTop: 10, padding: 12, borderRadius: 12, background: "#f8fafc" }}>
                      <div style={{ fontWeight: 600 }}>Property vs registry</div>
                      <div style={{ color: "#475569", fontSize: 14 }}>
                        Property: {candidate.comparison.propertyAddress || "--"}
                      </div>
                      <div style={{ color: "#475569", fontSize: 14 }}>
                        Registry: {candidate.comparison.registryAddress || "--"}
                      </div>
                      <div style={{ color: "#475569", fontSize: 14 }}>
                        Property PID: {candidate.comparison.propertyPid || "--"} vs Registry PID: {candidate.comparison.registryPid || "--"}
                      </div>
                      <div style={{ color: "#475569", fontSize: 14 }}>
                        Units: {candidate.comparison.propertyUnitCount ?? "--"} vs {candidate.comparison.registryUnitCount ?? "--"}
                      </div>
                      {candidate.comparison.operatorPrompts?.length ? (
                        <div style={{ color: "#92400e", fontSize: 14 }}>{candidate.comparison.operatorPrompts.join(" ")}</div>
                      ) : null}
                      {candidate.comparison.reasonSummary?.length ? (
                        <div style={{ color: "#64748b", fontSize: 13 }}>{candidate.comparison.reasonSummary.join(" ")}</div>
                      ) : null}
                    </div>
                  ) : null}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    <Button
                      onClick={() => {
                        setPropertyId(candidate.propertyId);
                        void handleOverride("attach", candidate.propertyId);
                      }}
                      disabled={saving || !reason.trim()}
                    >
                      Confirm this match
                    </Button>
                    <Link to={`/admin/registry/properties/${encodeURIComponent(candidate.propertyId)}?normalizedRecordId=${encodeURIComponent(detail.normalizedRecord?.id || "")}`}>
                      <Button variant="secondary">Open property review</Button>
                    </Link>
                    {candidate.comparison?.registryPid &&
                    (candidate.comparison.pidStatus === "missing_internal_pid" || candidate.comparison.pidStatus === "mismatch") ? (
                      <Button
                        variant="secondary"
                        onClick={() => void handleApplyRegistryPid(candidate.propertyId)}
                        disabled={saving || !reason.trim() || (candidate.comparison.pidStatus === "mismatch" && !confirmPidOverwrite)}
                      >
                        Update property PID from registry
                      </Button>
                    ) : null}
                  </div>
                  {candidate.comparison?.registryPid &&
                  (candidate.comparison.pidStatus === "missing_internal_pid" || candidate.comparison.pidStatus === "mismatch") ? (
                    <div style={{ color: "#64748b", fontSize: 13, marginTop: 8 }}>
                      Applying the registry PID may improve future exact matching for this property.
                      {candidate.comparison.pidStatus === "mismatch"
                        ? " This will replace the current property PID with the selected Halifax registry PID."
                        : ""}
                    </div>
                  ) : null}
                </div>
              ))}
            </Card>

            <Card style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 700 }}>Raw Source Fields</div>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 13 }}>{JSON.stringify(detail.rawRecord?.sourcePayload || detail.rawRecord || {}, null, 2)}</pre>
            </Card>

            <Card style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 700 }}>Audit Trail</div>
              {!detail.auditTrail?.length ? <div style={{ color: "#475569" }}>No audit events yet.</div> : null}
              {detail.auditTrail?.map((event) => (
                <div key={event.id} style={{ borderBottom: "1px solid rgba(148,163,184,0.14)", paddingBottom: 8 }}>
                  <div style={{ fontWeight: 600 }}>{event.eventType}</div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>{event.createdAt}</div>
                </div>
              ))}
            </Card>
          </>
        ) : null}
      </div>
    </MacShell>
  );
}
