import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "../components/ui/ToastProvider";
import { TenantDetailPanel } from "../components/tenants/TenantDetailPanel";
import { TenantLeasePanel } from "../components/tenants/TenantLeasePanel";
import { TenantPaymentsPanel } from "../components/tenants/TenantPaymentsPanel";
import { MacShell } from "../components/layout/MacShell";
import { fetchTenants } from "@/api/tenantsApi";
import { spacing, radius, colors, text } from "../styles/tokens";
import { Card, Section, Input } from "../components/ui/Ui";
import { InviteTenantModal } from "../components/tenants/InviteTenantModal";
import { TenantScorePill } from "../components/tenant/TenantScorePill";
import { hydrateTenantSummariesBatch, getCachedTenantSummary } from "../lib/tenantSummaryCache";

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
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(
    selectedTenantIdFromUrl
  );

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

  const tenantExists =
    selectedTenantId && tenants.some((t) => t.id === selectedTenantId);

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
    <MacShell title="RentChain - Tenants">
      <div
        className="page-content"
        style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}
      >
        <Card elevated>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>
                Tenants
              </h1>
              <div style={{ marginTop: 4, color: text.muted, fontSize: "0.95rem" }}>
                Manage tenant records, ledgers, and unit occupancy.
              </div>
            </div>
            <button
              onClick={() => setInviteOpen(true)}
              style={{
                padding: "8px 12px",
                borderRadius: radius.sm,
                border: `1px solid ${colors.border}`,
                background: colors.panel,
                cursor: "pointer",
              }}
            >
              Invite tenant
            </button>
          </div>
        </Card>

        <Card
          elevated
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 2fr)",
            gap: spacing.lg,
            minHeight: 0,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm, minHeight: 0 }}>
            <Input
              type="text"
              placeholder="Search by name, property, unit"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ borderRadius: radius.pill }}
            />

            {loading ? (
              <div style={{ fontSize: 13, color: text.muted }}>Loading tenants…</div>
            ) : error ? (
              <div style={{ fontSize: 13, color: colors.danger }}>{error}</div>
            ) : filteredTenants.length === 0 ? (
              <div style={{ fontSize: 13, color: text.muted }}>No tenants found.</div>
            ) : (
              <div
                style={{
                  marginTop: 4,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  overflowY: "auto",
                }}
              >
                {filteredTenants.map((tenant: any) => {
                  const isSelected = tenant.id === selectedTenantId;
                  const summary = getCachedTenantSummary(tenant.id);
                  return (
                    <button
                      key={tenant.id}
                      type="button"
                      onClick={() => handleSelectTenant(tenant.id)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        border: "1px solid",
                        borderColor: isSelected ? colors.accent : colors.border,
                        background: isSelected ? "rgba(96,165,250,0.08)" : colors.card,
                        borderRadius: radius.md,
                        padding: "10px 12px",
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
                        e.currentTarget.style.borderColor = isSelected
                          ? colors.accent
                          : colors.border;
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600 }}>
                        {tenant.name || tenant.fullName || "Unnamed tenant"}
                      </span>
                      <span style={{ fontSize: 11, color: text.muted }}>
                        {(tenant.propertyName || tenant.propertyId || "Property") + " - " + (tenant.unitLabel || tenant.unit || "") }
                      </span>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <TenantScorePill
                          compact
                          score={summary?.scoreV1 ?? null}
                          tier={summary?.tierV1 ?? null}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div
            style={{
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <Section style={{ minHeight: 0 }}>
              {!selectedTenantId && (
                <div style={{ fontSize: 13, color: text.muted }}>
                  Select a tenant from the list to see details.
                </div>
              )}
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
                  <div style={{ color: text.muted }}>
                    The tenant you're looking for could not be loaded.
                  </div>
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
              {selectedTenantId && tenantExists && (
                <TenantDetailPanel tenantId={selectedTenantId} />
              )}
            </Section>

            <Section>
              <TenantLeasePanel tenantId={tenantExists ? selectedTenantId : null} />
            </Section>

            <Section>
              <TenantPaymentsPanel tenantId={tenantExists ? selectedTenantId : null} />
            </Section>
          </div>
        </Card>
      </div>
      <InviteTenantModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </MacShell>
  );
};











