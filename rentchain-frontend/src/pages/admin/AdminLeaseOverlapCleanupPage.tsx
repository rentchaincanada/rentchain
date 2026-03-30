import React, { useEffect, useMemo, useState } from "react";
import { LandlordNav } from "../../components/layout/LandlordNav";
import { Card, Section, Button } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import {
  applyAdminLeaseOverlapCleanup,
  getAdminLeaseOverlapGroups,
  previewAdminLeaseOverlapCleanup,
  type LeaseOverlapAuditGroup,
} from "../../api/leaseOverlapCleanupApi";

const AdminLeaseOverlapCleanupPage: React.FC = () => {
  const { showToast } = useToast();
  const [groups, setGroups] = useState<LeaseOverlapAuditGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canonicalLeaseId, setCanonicalLeaseId] = useState("");
  const [preview, setPreview] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const selectedGroup = groups[selectedIndex] || null;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await getAdminLeaseOverlapGroups();
        setGroups(res.groups || []);
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
    void load();
  }, [showToast]);

  useEffect(() => {
    setCanonicalLeaseId(selectedGroup?.leaseIds?.[0] || "");
    setPreview(null);
  }, [selectedGroup?.generatedAt, selectedGroup?.leaseIds?.join("|")]);

  const canPreview = Boolean(
    selectedGroup?.landlordId &&
      selectedGroup?.propertyId &&
      canonicalLeaseId &&
      selectedGroup?.leaseIds?.includes(canonicalLeaseId)
  );

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
      });
      setPreview(res.preview);
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
    if (!selectedGroup?.landlordId || !selectedGroup?.propertyId || !canonicalLeaseId) return;
    const confirmed = window.confirm(
      "Apply this cleanup? Duplicate leases will be marked superseded and currentLeaseId pointers will be updated."
    );
    if (!confirmed) return;
    try {
      setActionLoading(true);
      const res = await applyAdminLeaseOverlapCleanup({
        landlordId: selectedGroup.landlordId,
        propertyId: selectedGroup.propertyId,
        canonicalLeaseId,
        overlapLeaseIds: selectedGroup.leaseIds,
      });
      setPreview(res.result);
      showToast({ message: "Cleanup applied", variant: "success" });
      const refreshed = await getAdminLeaseOverlapGroups();
      setGroups(refreshed.groups || []);
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

  return (
    <LandlordNav>
      <Section title="Lease overlap cleanup" subtitle="Review suspicious current lease overlaps and resolve them manually.">
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(280px, 360px) minmax(0, 1fr)" }}>
          <Card>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ fontWeight: 700 }}>Overlap groups</div>
              {loading ? <div>Loading...</div> : null}
              {!loading && groups.length === 0 ? <div>No overlap groups found.</div> : null}
              {groups.map((group, index) => (
                <button
                  key={`${group.overlapType}-${group.propertyId}-${group.unitId}-${group.leaseIds.join("|")}`}
                  type="button"
                  onClick={() => setSelectedIndex(index)}
                  style={{
                    textAlign: "left",
                    padding: 12,
                    borderRadius: 10,
                    border: index === selectedIndex ? "1px solid #2563eb" : "1px solid rgba(148,163,184,0.25)",
                    background: index === selectedIndex ? "rgba(37,99,235,0.06)" : "#fff",
                    cursor: "pointer",
                    display: "grid",
                    gap: 4,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{group.propertyName || group.propertyId || "Property"}</div>
                  <div style={{ color: "#475569", fontSize: 13 }}>
                    {group.unitLabel || group.unitNumber || group.unitId || "Unit"} · {group.overlapType}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>{group.leaseIds.length} leases</div>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            {!selectedGroup ? (
              <div>Select an overlap group to review.</div>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ fontWeight: 700 }}>
                    {selectedGroup.propertyName || selectedGroup.propertyId} ·{" "}
                    {selectedGroup.unitLabel || selectedGroup.unitNumber || selectedGroup.unitId}
                  </div>
                  <div style={{ color: "#475569", fontSize: 14 }}>{selectedGroup.recommendedReviewAction}</div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontWeight: 700 }}>Select canonical lease</div>
                  {leaseOptions.map((leaseId, index) => (
                    <label key={leaseId} style={{ display: "grid", gap: 4, padding: 10, border: "1px solid rgba(148,163,184,0.2)", borderRadius: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="radio"
                          checked={canonicalLeaseId === leaseId}
                          onChange={() => setCanonicalLeaseId(leaseId)}
                        />
                        <span style={{ fontWeight: 700 }}>{leaseId}</span>
                      </div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>
                        Tenant: {selectedGroup.tenantIds[index] || "--"} · Status: {selectedGroup.leaseStatuses[index] || "--"}
                      </div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>
                        {selectedGroup.startDates[index] || "--"} to {selectedGroup.endDates[index] || "--"}
                      </div>
                    </label>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Button onClick={handlePreview} disabled={!canPreview || actionLoading}>
                    {actionLoading ? "Working..." : "Preview cleanup"}
                  </Button>
                  <Button onClick={handleApply} disabled={!canPreview || actionLoading}>
                    Apply cleanup
                  </Button>
                </div>

                {preview ? (
                  <div style={{ display: "grid", gap: 12, padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,0.2)", background: "#f8fafc" }}>
                    <div style={{ fontWeight: 700 }}>{preview.dryRun ? "Dry run preview" : "Applied cleanup"}</div>
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
                  </div>
                ) : null}
              </div>
            )}
          </Card>
        </div>
      </Section>
    </LandlordNav>
  );
};

export default AdminLeaseOverlapCleanupPage;
