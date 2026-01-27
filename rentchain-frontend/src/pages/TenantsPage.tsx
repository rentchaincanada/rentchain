import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "../components/ui/ToastProvider";
import { TenantDetailPanel } from "../components/tenants/TenantDetailPanel";
import { TenantLeasePanel } from "../components/tenants/TenantLeasePanel";
import { TenantPaymentsPanel } from "../components/tenants/TenantPaymentsPanel";
import { fetchTenants } from "@/api/tenantsApi";
import { spacing, radius, colors, text } from "../styles/tokens";
import { Card, Section, Input } from "../components/ui/Ui";
import { InviteTenantModal } from "../components/tenants/InviteTenantModal";
import { TenantScorePill } from "../components/tenant/TenantScorePill";
import { hydrateTenantSummariesBatch, getCachedTenantSummary } from "../lib/tenantSummaryCache";
import "./TenantsPage.css";

export const TenantsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  const selectedTenantIdFromUrl = searchParams.get("tenantId");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(selectedTenantIdFromUrl);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchTenants();
        if (!cancelled) {
          setTenants(data);
        }
      } catch (err) {
        console.error("[TenantsPage] Failed to load tenants", err);
        if (!cancelled) {
          setError("Failed to load tenants");
          showToast({
            message: "Failed to load tenants",
            description: "An error occurred while fetching the tenant list.",
            variant: "error",
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  useEffect(() => {
    if (!selectedTenantIdFromUrl) {
      setSelectedTenantId(null);
      return;
    }
    const exists = tenants.some((t) => t.id === selectedTenantIdFromUrl);
    if (exists) {
      setSelectedTenantId(selectedTenantIdFromUrl);
    }
  }, [selectedTenantIdFromUrl, tenants]);

  const handleSelectTenant = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    navigate(`/tenants?tenantId=${tenantId}`);
  };

  const tenantExists = selectedTenantId && tenants.some((t) => t.id === selectedTenantId);

  const filteredTenants = useMemo(() => {
    const base = tenants || [];
    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase();
    return base.filter((t) => {
      const name = (t.name || t.fullName || "").toLowerCase();
      const property = (t.propertyName || t.propertyId || "").toLowerCase();
      const unit = (t.unitLabel || t.unit || "").toLowerCase();
      return name.includes(q) || property.includes(q) || unit.includes(q);
    });
  }, [tenants, searchQuery]);

  const visibleTenantIds = useMemo(
    () => (filteredTenants || []).slice(0, 50).map((t) => t.id).filter(Boolean),
    [filteredTenants]
  );

  useEffect(() => {
    void hydrateTenantSummariesBatch(visibleTenantIds);
  }, [visibleTenantIds]);

  return (
    <div className="page-content" style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
      <Card elevated className="rc-tenants-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700 }}>Tenants</h1>
            <div style={{ marginTop: 4, color: text.muted, fontSize: "0.95rem", lineHeight: 1.45 }}>
              Manage tenant records, ledgers, and unit occupancy.
            </div>
          </div>
          <button
            onClick={() => setInviteOpen(true)}
            style={{
              padding: "10px 12px",
              borderRadius: radius.sm,
              border: `1px solid ${colors.border}`,
              background: colors.panel,
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            Invite tenant
          </button>
        </div>
      </Card>

      <Card elevated className="rc-tenants-grid">
        <div className="rc-tenants-list">
          <div className="rc-tenants-search">
            <Input
              type="text"
              placeholder="Search by name, property, unit"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ borderRadius: radius.pill }}
            />
          </div>

          {loading ? (
            <div style={{ fontSize: 13, color: text.muted }}>Loading tenants.</div>
          ) : error ? (
            <div style={{ fontSize: 13, color: colors.danger }}>{error}</div>
          ) : filteredTenants.length === 0 ? (
            <div style={{ fontSize: 13, color: text.muted }}>No tenants found.</div>
          ) : (
            <div className="rc-tenants-list-scroll">
              {filteredTenants.map((tenant: any) => {
                const isSelected = tenant.id === selectedTenantId;
                const summary = getCachedTenantSummary(tenant.id);
                return (
                  <button
                    key={tenant.id}
                    className="rc-tenants-list-item"
                    type="button"
                    onClick={() => handleSelectTenant(tenant.id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      border: "1px solid",
                      borderColor: isSelected ? colors.accent : colors.border,
                      background: isSelected ? "rgba(96,165,250,0.08)" : colors.card,
                      borderRadius: radius.md,
                      padding: "12px 12px",
                      color: text.primary,
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      transition: "background 120ms ease, border-color 120ms ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = colors.borderStrong;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = isSelected ? colors.accent : colors.border;
                    }}
                  >
                    <span style={{ fontSize: 15, fontWeight: 600 }}>
                      {tenant.name || tenant.fullName || "Unnamed tenant"}
                    </span>
                    <span style={{ fontSize: 12, color: text.muted }}>
                      {(tenant.propertyName || tenant.propertyId || "Property") + " - " + (tenant.unitLabel || tenant.unit || "")}
                    </span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <TenantScorePill compact score={summary?.scoreV1 ?? null} tier={summary?.tierV1 ?? null} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="rc-tenants-detail">
          <Section style={{ minHeight: 0 }}>
            {!selectedTenantId && <div style={{ fontSize: 13, color: text.muted }}>Select a tenant from the list to see details.</div>}
            {selectedTenantId && !tenantExists && !loading && (
              <div
                style={{
                  fontSize: 13,
                  color: text.primary,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ fontWeight: 600 }}>Tenant not found.</div>
                <div style={{ color: text.muted }}>The tenant you're looking for could not be loaded.</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTenantId(null);
                      navigate("/tenants");
                    }}
                    style={{
                      padding: "6px 10px",
                      borderRadius: radius.md,
                      border: `1px solid ${colors.border}`,
                      background: colors.card,
                      color: text.primary,
                    }}
                  >
                    Back to tenants list
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(0)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: radius.md,
                      border: `1px solid ${colors.border}`,
                      background: colors.card,
                      color: text.primary,
                    }}
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}
            {selectedTenantId && tenantExists && <TenantDetailPanel tenantId={selectedTenantId} />}
          </Section>

          <Section>
            <TenantLeasePanel tenantId={tenantExists ? selectedTenantId : null} />
          </Section>

          <Section>
            <TenantPaymentsPanel tenantId={tenantExists ? selectedTenantId : null} />
          </Section>
        </div>
      </Card>

      <InviteTenantModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
};

export default TenantsPage;
