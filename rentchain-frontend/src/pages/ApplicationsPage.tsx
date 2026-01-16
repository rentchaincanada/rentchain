import React, { useEffect, useMemo, useState } from "react";
import { Card, Section, Input, Button, Pill } from "../components/ui/Ui";
import { spacing, colors, text, radius } from "../styles/tokens";
import { apiFetch } from "@/api/http";
import {
  fetchRentalApplications,
  fetchRentalApplication,
  updateRentalApplicationStatus,
  type RentalApplication,
  type RentalApplicationStatus,
  type RentalApplicationSummary,
} from "@/api/rentalApplicationsApi";
import { useToast } from "../components/ui/ToastProvider";

const statusOptions: RentalApplicationStatus[] = [
  "SUBMITTED",
  "IN_REVIEW",
  "APPROVED",
  "DECLINED",
  "CONDITIONAL_COSIGNER",
  "CONDITIONAL_DEPOSIT",
];

type PropertyOption = { id: string; name: string };

const ApplicationsPage: React.FC = () => {
  const { showToast } = useToast();
  const [applications, setApplications] = useState<RentalApplicationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RentalApplication | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [propertyFilter, setPropertyFilter] = useState<string>("");
  const [properties, setProperties] = useState<PropertyOption[]>([]);

  useEffect(() => {
    let alive = true;
    const loadProperties = async () => {
      try {
        const res: any = await apiFetch("/properties");
        const list = Array.isArray(res?.properties) ? res.properties : [];
        if (!alive) return;
        setProperties(
          list.map((p: any) => ({
            id: String(p.id || p.propertyId || p.uid || ""),
            name: p.name || p.addressLine1 || p.label || "Property",
          }))
        );
      } catch {
        if (!alive) return;
        setProperties([]);
      }
    };
    void loadProperties();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await fetchRentalApplications({
          propertyId: propertyFilter || undefined,
          status: statusFilter || undefined,
        });
        if (!alive) return;
        setApplications(list || []);
        if (!selectedId && list?.length) {
          setSelectedId(list[0].id);
        }
      } catch (err: any) {
        if (!alive) return;
        setError(err?.message || "Failed to load applications.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [propertyFilter, statusFilter, selectedId]);

  useEffect(() => {
    const loadDetail = async () => {
      if (!selectedId) {
        setDetail(null);
        return;
      }
      setLoadingDetail(true);
      try {
        const app = await fetchRentalApplication(selectedId);
        setDetail(app);
      } catch (err: any) {
        setError(err?.message || "Failed to load application details.");
      } finally {
        setLoadingDetail(false);
      }
    };
    void loadDetail();
  }, [selectedId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return applications;
    const q = search.toLowerCase();
    return applications.filter((a) => {
      const name = (a.applicantName || "").toLowerCase();
      const email = (a.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [applications, search]);

  const setStatus = async (status: RentalApplicationStatus) => {
    if (!detail) return;
    try {
      const updated = await updateRentalApplicationStatus(detail.id, status, detail.landlordNote ?? null);
      setDetail(updated);
      setApplications((prev) => prev.map((a) => (a.id === detail.id ? { ...a, status } : a)));
      showToast({ message: `Status set to ${status}`, variant: "success" });
    } catch (err: any) {
      showToast({ message: "Failed to update status", description: err?.message || "", variant: "error" });
    }
  };

  return (
    <div style={{ display: "grid", gap: spacing.lg }}>
      <Card elevated>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>Applications</h1>
            <div style={{ color: text.muted, fontSize: "0.95rem" }}>
              Review submitted rental applications.
            </div>
          </div>
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email"
              style={{ width: 240 }}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: radius.md, border: `1px solid ${colors.border}` }}
            >
              <option value="">All statuses</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: radius.md, border: `1px solid ${colors.border}` }}
            >
              <option value="">All properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <Card
        elevated
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(260px, 1fr) minmax(0, 2fr)",
          gap: spacing.lg,
        }}
      >
        <div style={{ display: "grid", gap: 8 }}>
          {loading ? (
            <div style={{ color: text.muted }}>Loading applications...</div>
          ) : error ? (
            <div style={{ color: colors.danger }}>{error}</div>
          ) : filtered.length === 0 ? (
            <div style={{ color: text.muted }}>No applications found.</div>
          ) : (
            filtered.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => setSelectedId(app.id)}
                style={{
                  textAlign: "left",
                  border: `1px solid ${app.id === selectedId ? colors.accent : colors.border}`,
                  background: app.id === selectedId ? "rgba(37,99,235,0.08)" : colors.card,
                  borderRadius: radius.md,
                  padding: "10px 12px",
                  cursor: "pointer",
                  display: "grid",
                  gap: 4,
                }}
              >
                <div style={{ fontWeight: 700, color: text.primary }}>{app.applicantName || "Applicant"}</div>
                <div style={{ color: text.muted, fontSize: 12 }}>{app.email || "No email"}</div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <Pill>{app.status}</Pill>
                </div>
              </button>
            ))
          )}
        </div>

        <Section>
          {loadingDetail ? (
            <div style={{ color: text.muted }}>Loading application...</div>
          ) : !detail ? (
            <div style={{ color: text.muted }}>Select an application to view details.</div>
          ) : (
            <div style={{ display: "grid", gap: spacing.md }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{detail.applicant.firstName} {detail.applicant.lastName}</div>
                  <div style={{ color: text.muted }}>{detail.applicant.email}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {statusOptions.map((s) => (
                    <Button key={s} variant={detail.status === s ? "primary" : "secondary"} onClick={() => void setStatus(s)}>
                      {s.replace("_", " ")}
                    </Button>
                  ))}
                </div>
              </div>

              <Card>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Consent</div>
                <div style={{ display: "grid", gap: 4 }}>
                  <div>Credit consent: {detail.consent.creditConsent ? "Yes" : "No"}</div>
                  <div>Reference consent: {detail.consent.referenceConsent ? "Yes" : "No"}</div>
                  <div>Data sharing consent: {detail.consent.dataSharingConsent ? "Yes" : "No"}</div>
                  <div>Accepted at: {detail.consent.acceptedAt ? new Date(detail.consent.acceptedAt).toLocaleString() : "-"}</div>
                </div>
              </Card>

              <Card>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Residential history</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {detail.residentialHistory?.length ? detail.residentialHistory.map((h, idx) => (
                    <div key={idx} style={{ border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: 10 }}>
                      <div style={{ fontWeight: 600 }}>{h.address}</div>
                      <div style={{ color: text.muted, fontSize: 12 }}>
                        {h.durationMonths ? `${h.durationMonths} months` : ""}{h.rentAmountCents ? ` · $${(h.rentAmountCents / 100).toFixed(0)}` : ""}
                      </div>
                      <div style={{ fontSize: 12 }}>Landlord: {h.landlordName || "-"} {h.landlordPhone ? `(${h.landlordPhone})` : ""}</div>
                      {h.reasonForLeaving ? <div style={{ fontSize: 12 }}>Reason: {h.reasonForLeaving}</div> : null}
                    </div>
                  )) : <div style={{ color: text.muted }}>No history provided.</div>}
                </div>
              </Card>
            </div>
          )}
        </Section>
      </Card>
    </div>
  );
};

export default ApplicationsPage;
