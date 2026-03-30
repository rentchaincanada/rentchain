import React, { useEffect, useMemo, useState } from "react";
import { LandlordNav } from "../../components/layout/LandlordNav";
import { Card, Section, Button, Pill, Input } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import {
  applyAdminLeaseOverlapCleanup,
  getAdminLeaseOverlapGroups,
  previewAdminLeaseOverlapCleanup,
  type LeaseOverlapAuditGroup,
  type LeaseOverlapAuditSummary,
  type LeaseOverlapCleanupPreview,
} from "../../api/leaseOverlapCleanupApi";

const severityTone = {
  high: { background: "rgba(239,68,68,0.12)", color: "#b91c1c", border: "1px solid rgba(239,68,68,0.22)" },
  medium: { background: "rgba(245,158,11,0.14)", color: "#b45309", border: "1px solid rgba(245,158,11,0.24)" },
  low: { background: "rgba(100,116,139,0.12)", color: "#475569", border: "1px solid rgba(148,163,184,0.22)" },
} as const;

const overlapTypeLabel: Record<string, string> = {
  duplicate_current_same_unitId: "Same unitId overlap",
  duplicate_current_same_logical_unit: "Logical unit overlap",
  overlapping_dates_same_unit: "Overlapping dates",
  stale_pointer_conflict: "Stale pointer conflict",
  property_unit_mismatch: "Property/unit mismatch",
};

function groupKey(group: LeaseOverlapAuditGroup) {
  return [
    group.overlapType,
    group.landlordId || "",
    group.propertyId || "",
    group.unitId || group.unitNumber || group.unitLabel || "",
    [...group.leaseIds].sort().join("|"),
  ].join("::");
}

function renderCompactStat(label: string, value: number | string) {
  return (
    <Card style={{ display: "grid", gap: 6, padding: 14 }}>
      <div style={{ color: "#64748b", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div style={{ color: "#0f172a", fontSize: "1.35rem", fontWeight: 800 }}>{value}</div>
    </Card>
  );
}

function safetyBullet(text: string) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ marginTop: 2, width: 8, height: 8, borderRadius: 999, background: "#2563eb", flexShrink: 0 }} />
      <span>{text}</span>
    </div>
  );
}

const AdminLeaseOverlapCleanupPage: React.FC = () => {
  const { showToast } = useToast();
  const [groups, setGroups] = useState<LeaseOverlapAuditGroup[]>([]);
  const [summary, setSummary] = useState<LeaseOverlapAuditSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [canonicalLeaseId, setCanonicalLeaseId] = useState("");
  const [targetStatus, setTargetStatus] = useState<"superseded" | "inactive">("superseded");
  const [preview, setPreview] = useState<LeaseOverlapCleanupPreview | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmReady, setConfirmReady] = useState(false);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const loadGroups = async (preferredSelectedKey?: string | null) => {
    try {
      setLoading(true);
      const res = await getAdminLeaseOverlapGroups();
      const nextGroups = res.groups || [];
      setGroups(nextGroups);
      setSummary(res.summary || null);
      const nextKey =
        (preferredSelectedKey && nextGroups.find((group) => groupKey(group) === preferredSelectedKey) && preferredSelectedKey) ||
        (selectedKey && nextGroups.find((group) => groupKey(group) === selectedKey) && selectedKey) ||
        (nextGroups[0] ? groupKey(nextGroups[0]) : null);
      setSelectedKey(nextKey);
    } catch (err: any) {
      showToast({
        message: "Failed to load lease overlap groups",
        description: err?.message,
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadGroups();
  }, [showToast]);

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    return groups.filter((group) => {
      if (severityFilter !== "all" && group.severity !== severityFilter) return false;
      if (typeFilter !== "all" && group.overlapType !== typeFilter) return false;
      if (!query) return true;
      const haystack = [
        group.propertyName,
        group.propertyId,
        group.unitId,
        group.unitNumber,
        group.unitLabel,
        group.landlordId,
        ...group.leaseIds,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return haystack.includes(query);
    });
  }, [groups, search, severityFilter, typeFilter]);

  useEffect(() => {
    if (!filteredGroups.length) {
      setSelectedKey(null);
      return;
    }
    if (!selectedKey || !filteredGroups.some((group) => groupKey(group) === selectedKey)) {
      setSelectedKey(groupKey(filteredGroups[0]));
    }
  }, [filteredGroups, selectedKey]);

  const selectedGroup = filteredGroups.find((group) => groupKey(group) === selectedKey) || null;

  useEffect(() => {
    setCanonicalLeaseId(selectedGroup?.leaseIds?.[0] || "");
    setTargetStatus("superseded");
    setPreview(null);
    setConfirmReady(false);
  }, [selectedGroup?.generatedAt, selectedGroup?.leaseIds?.join("|")]);

  useEffect(() => {
    setPreview(null);
    setConfirmReady(false);
  }, [canonicalLeaseId, targetStatus]);

  const canPreview = Boolean(
    selectedGroup?.landlordId &&
      selectedGroup?.propertyId &&
      canonicalLeaseId &&
      selectedGroup?.leaseIds?.includes(canonicalLeaseId)
  );

  const canApply = Boolean(preview && !preview.dryRun && false);

  const leaseOptions = useMemo(() => selectedGroup?.leaseIds || [], [selectedGroup?.leaseIds]);

  const handlePreview = async () => {
    if (!selectedGroup?.landlordId || !selectedGroup?.propertyId || !canonicalLeaseId) return;
    try {
      setActionLoading(true);
      const res = await previewAdminLeaseOverlapCleanup({
        landlordId: selectedGroup.landlordId,
        propertyId: selectedGroup.propertyId,
        canonicalLeaseId,
        overlapLeaseIds: selectedGroup.leaseIds,
        targetStatus,
      });
      setPreview(res.preview);
      setConfirmReady(false);
    } catch (err: any) {
      showToast({
        message: "Preview failed",
        description: err?.message,
        variant: "error",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleApply = async () => {
    if (!selectedGroup?.landlordId || !selectedGroup?.propertyId || !canonicalLeaseId || !preview || !confirmReady) return;
    try {
      setActionLoading(true);
      const res = await applyAdminLeaseOverlapCleanup({
        landlordId: selectedGroup.landlordId,
        propertyId: selectedGroup.propertyId,
        canonicalLeaseId,
        overlapLeaseIds: selectedGroup.leaseIds,
        targetStatus,
      });
      setPreview(null);
      setConfirmReady(false);
      showToast({ message: "Cleanup applied", variant: "success" });
      await loadGroups(groupKey(selectedGroup));
    } catch (err: any) {
      showToast({
        message: "Cleanup failed",
        description: err?.message,
        variant: "error",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const summarySource = summary || {
    overlapGroupCount: groups.length,
    bySeverity: {
      high: groups.filter((group) => group.severity === "high").length,
      medium: groups.filter((group) => group.severity === "medium").length,
      low: groups.filter((group) => group.severity === "low").length,
    },
    byType: {
      stale_pointer_conflict: groups.filter((group) => group.overlapType === "stale_pointer_conflict").length,
      property_unit_mismatch: groups.filter((group) => group.overlapType === "property_unit_mismatch").length,
    },
  };

  return (
    <LandlordNav>
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#0f172a" }}>Lease Overlap Cleanup</div>
              <div style={{ color: "#475569", maxWidth: 760 }}>
                Review suspicious current-lease overlaps, select the canonical lease, preview changes, and apply a safe cleanup.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="secondary" onClick={() => void loadGroups(selectedKey)} disabled={loading || actionLoading}>
                Refresh report
              </Button>
            </div>
          </div>
        </Section>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          }}
        >
          {renderCompactStat("Total overlap groups", summarySource.overlapGroupCount || 0)}
          {renderCompactStat("High severity", summarySource.bySeverity?.high || 0)}
          {renderCompactStat("Stale pointer conflicts", summarySource.byType?.stale_pointer_conflict || 0)}
          {renderCompactStat("Property/unit mismatches", summarySource.byType?.property_unit_mismatch || 0)}
        </div>

        <Section>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <Input
              aria-label="Search overlap groups"
              placeholder="Search property, unit, landlord, or lease ID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              aria-label="Filter by severity"
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value)}
              style={{ minHeight: 42, borderRadius: 10, border: "1px solid #cbd5e1", padding: "10px 12px" }}
            >
              <option value="all">All severities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              aria-label="Filter by overlap type"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              style={{ minHeight: 42, borderRadius: 10, border: "1px solid #cbd5e1", padding: "10px 12px" }}
            >
              <option value="all">All overlap types</option>
              {Object.entries(overlapTypeLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </Section>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(300px, 380px) minmax(0, 1fr)" }}>
          <Card>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ fontWeight: 700 }}>Overlap groups</div>
              {loading ? <div>Loading...</div> : null}
              {!loading && filteredGroups.length === 0 ? <div>No overlap groups match the current filters.</div> : null}
              {filteredGroups.map((group) => (
                <button
                  key={`${group.overlapType}-${group.propertyId}-${group.unitId}-${group.leaseIds.join("|")}`}
                  type="button"
                  onClick={() => setSelectedKey(groupKey(group))}
                  style={{
                    textAlign: "left",
                    padding: 12,
                    borderRadius: 10,
                    border: groupKey(group) === selectedKey ? "1px solid #2563eb" : "1px solid rgba(148,163,184,0.25)",
                    background: groupKey(group) === selectedKey ? "rgba(37,99,235,0.06)" : "#fff",
                    cursor: "pointer",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ fontWeight: 700 }}>{group.propertyName || group.propertyId || "Property"}</div>
                      <div style={{ color: "#475569", fontSize: 13 }}>{group.unitLabel || group.unitNumber || group.unitId || "Unit"}</div>
                    </div>
                    <span
                      style={{
                        ...severityTone[(group.severity as keyof typeof severityTone) || "low"],
                        borderRadius: 999,
                        padding: "4px 8px",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {group.severity}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Pill>{overlapTypeLabel[group.overlapType] || group.overlapType}</Pill>
                    <Pill>{group.leaseIds.length} leases</Pill>
                    <Pill>{group.tenantIds.length} tenants</Pill>
                  </div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>
                    {group.riskNotes?.[0] || group.recommendedReviewAction}
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            {!selectedGroup ? (
              <div>Select an overlap group to review cleanup options.</div>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 800, fontSize: "1.2rem" }}>
                      {selectedGroup.propertyName || selectedGroup.propertyId} ·{" "}
                      {selectedGroup.unitLabel || selectedGroup.unitNumber || selectedGroup.unitId}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Pill>{overlapTypeLabel[selectedGroup.overlapType] || selectedGroup.overlapType}</Pill>
                      <Pill>{selectedGroup.confidence}</Pill>
                      <span
                        style={{
                          ...severityTone[(selectedGroup.severity as keyof typeof severityTone) || "low"],
                          borderRadius: 999,
                          padding: "6px 10px",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {selectedGroup.severity}
                      </span>
                    </div>
                  </div>
                  <Card style={{ display: "grid", gap: 8, padding: 14, background: "#f8fafc" }}>
                    <div style={{ fontWeight: 700 }}>Group summary</div>
                    <div style={{ color: "#334155", fontSize: 14 }}>
                      Property: {selectedGroup.propertyName || selectedGroup.propertyId || "--"}
                    </div>
                    <div style={{ color: "#334155", fontSize: 14 }}>
                      Unit: {selectedGroup.unitLabel || selectedGroup.unitNumber || selectedGroup.unitId || "--"}
                    </div>
                    <div style={{ color: "#334155", fontSize: 14 }}>
                      Landlord: {selectedGroup.landlordId || "--"}
                    </div>
                    <div style={{ color: "#475569", fontSize: 14 }}>{selectedGroup.recommendedReviewAction}</div>
                  </Card>
                  <Card style={{ display: "grid", gap: 8, padding: 14, background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.18)" }}>
                    <div style={{ fontWeight: 700 }}>Safety note</div>
                    {safetyBullet("No leases will be deleted.")}
                    {safetyBullet("Non-canonical leases will be marked non-current.")}
                    {safetyBullet("Tenant currentLeaseId pointers may be updated.")}
                    {safetyBullet("A resolution log will be created for the action.")}
                  </Card>
                </div>

                <div style={{ display: "grid", gap: 10 }} data-testid="lease-comparison-section">
                  <div style={{ fontWeight: 700 }}>Select canonical lease</div>
                  {leaseOptions.map((leaseId, index) => (
                    <label
                      key={leaseId}
                      style={{
                        display: "grid",
                        gap: 8,
                        padding: 12,
                        border:
                          canonicalLeaseId === leaseId
                            ? "1px solid rgba(37,99,235,0.55)"
                            : "1px solid rgba(148,163,184,0.2)",
                        borderRadius: 12,
                        background:
                          canonicalLeaseId === leaseId ? "rgba(37,99,235,0.05)" : selectedGroup.severity === "high" ? "rgba(248,250,252,0.95)" : "#fff",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="radio"
                          aria-label={`Select canonical lease ${leaseId}`}
                          checked={canonicalLeaseId === leaseId}
                          onChange={() => setCanonicalLeaseId(leaseId)}
                        />
                        <span style={{ fontWeight: 700 }}>{leaseId}</span>
                      </div>
                      <div style={{ color: "#334155", fontSize: 13 }}>
                        Tenant: {selectedGroup.tenantIds[index] || "--"} · Status: {selectedGroup.leaseStatuses[index] || "--"}
                      </div>
                      <div style={{ color: "#334155", fontSize: 13 }}>
                        {selectedGroup.startDates[index] || "--"} to {selectedGroup.endDates[index] || "--"}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {selectedGroup.sourceHints?.length ? <Pill>Source: {selectedGroup.sourceHints.join(", ")}</Pill> : null}
                        {selectedGroup.currentLeaseHints?.includes(leaseId) ? <Pill>Pointer hint</Pill> : null}
                        {selectedGroup.riskNotes?.length ? <Pill>{selectedGroup.riskNotes[0]}</Pill> : null}
                      </div>
                    </label>
                  ))}
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontWeight: 700 }}>Mark non-canonical leases as</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {(["superseded", "inactive"] as const).map((value) => (
                      <label key={value} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="radio"
                          name="target-status"
                          checked={targetStatus === value}
                          onChange={() => setTargetStatus(value)}
                        />
                        <span>{value}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Button onClick={handlePreview} disabled={!canPreview || actionLoading}>
                    {actionLoading ? "Working..." : "Preview cleanup"}
                  </Button>
                  <Button variant="ghost" onClick={() => { setPreview(null); setConfirmReady(false); }}>
                    Clear preview
                  </Button>
                  <Button
                    onClick={handleApply}
                    disabled={!preview || actionLoading || !confirmReady}
                  >
                    Apply cleanup
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setCanonicalLeaseId(selectedGroup.leaseIds[0] || "");
                      setTargetStatus("superseded");
                      setPreview(null);
                      setConfirmReady(false);
                    }}
                  >
                    Reset selection
                  </Button>
                </div>

                <Card
                  style={{
                    display: "grid",
                    gap: 12,
                    padding: 14,
                    borderRadius: 12,
                    background: preview ? "#f8fafc" : "rgba(248,250,252,0.7)",
                  }}
                >
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontWeight: 700 }}>Preview panel</div>
                    <div style={{ color: "#64748b", fontSize: 13 }}>
                      {preview
                        ? "Preview loaded. Nothing has been changed yet."
                        : "Run Preview cleanup to inspect exact lease and tenant pointer changes before apply."}
                    </div>
                  </div>
                  {preview ? (
                    <>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={{ fontWeight: 600 }}>Lease status changes</div>
                      {preview.leaseChanges?.length ? preview.leaseChanges.map((change: any) => (
                        <div key={change.leaseId} style={{ fontSize: 13, color: "#334155" }}>
                          {change.leaseId}: {change.fromStatus || "--"} → {change.toStatus}
                        </div>
                      )) : <div style={{ fontSize: 13, color: "#64748b" }}>No lease status changes.</div>}
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={{ fontWeight: 600 }}>Tenant pointer changes</div>
                      {preview.tenantChanges?.length ? preview.tenantChanges.map((change: any) => (
                        <div key={change.tenantId} style={{ fontSize: 13, color: "#334155" }}>
                          {change.tenantId}: {change.fromCurrentLeaseId || "--"} → {change.toCurrentLeaseId || "--"}
                        </div>
                      )) : <div style={{ fontSize: 13, color: "#64748b" }}>No tenant pointer changes.</div>}
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={{ fontWeight: 600 }}>Audit log</div>
                      <div style={{ fontSize: 13, color: "#334155" }}>
                        Actor will be captured server-side when cleanup is applied. Resolution log will preserve preview/apply context.
                      </div>
                    </div>
                    <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <input
                        type="checkbox"
                        checked={confirmReady}
                        onChange={(event) => setConfirmReady(event.target.checked)}
                      />
                      <span style={{ fontSize: 13, color: "#334155" }}>
                        I reviewed the canonical lease and understand non-canonical leases will remain in history but no longer be current.
                      </span>
                    </label>
                  </>
                  ) : null}
                </Card>
              </div>
            )}
          </Card>
        </div>
      </div>
    </LandlordNav>
  );
};

export default AdminLeaseOverlapCleanupPage;
