// @ts-nocheck
// rentchain-frontend/src/pages/ApplicationsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchApplications,
  fetchApplication,
  buildScreeningPayload,
  fetchApplicationTimeline,
} from "@/api/applicationsApi";
import { updateApplicationStatus as updateApplicationStatusApi } from "@/api/applicationsApi";
import { convertApplicationToTenant as convertApplicationToTenantApi } from "@/api/applicationsApi";
import { deriveScreeningReadiness } from "../api/applicationsScreeningApi";
import { useSubscription } from "../context/SubscriptionContext";
import { fetchApplicationEvents } from "../api/eventsApi";
import type { Application, ApplicationStatus, ApplicationTimelineEntry } from "../types/applications";
import { ScreeningDetailModal } from "../components/applications/ScreeningDetailModal";
import { ApplicationDetailPanel } from "../components/applications/ApplicationDetailPanel";
import { PrintApplicationView } from "../components/applications/PrintApplicationView";
import { useToast } from "../components/ui/ToastProvider";
import { Card, Section, Input, Button, Pill } from "../components/ui/Ui";
import { spacing, colors, text, radius } from "../styles/tokens";
import { useAuth } from "../context/useAuth";

const timelineLabelMap: Record<string, string> = {
  created: "Application created",
  phone_code_sent: "Verification code sent",
  phone_verified: "Phone verified",
  submitted: "Application submitted",
  references_contacted: "References contacted",
  screening_requested: "Screening requested",
  screening_paid: "Screening payment received",
  screening_completed: "Screening completed",
};

const buildTimelineForApplication = (app: Application): ApplicationTimelineEntry[] => {
  const entries: ApplicationTimelineEntry[] = [];
  if (app.submittedAt) {
    entries.push({
      id: `submitted-${app.id}`,
      date: app.submittedAt,
      label: "Application submitted",
      status: app.status === "new" ? "new" : undefined,
    });
  }
  if (app.inReviewAt) {
    entries.push({
      id: `in_review-${app.id}`,
      date: app.inReviewAt,
      label: "Application moved to review",
      status: "in_review",
    });
  }
  if (app.approvedAt) {
    entries.push({
      id: `approved-${app.id}`,
      date: app.approvedAt,
      label: "Application approved",
      status: "approved",
    });
  }
  if (app.rejectedAt) {
    entries.push({
      id: `rejected-${app.id}`,
      date: app.rejectedAt,
      label: "Application rejected",
      status: "rejected",
    });
  }
  return entries;
};

const ApplicationsPage: React.FC = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const subscription = useSubscription();

  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Application | null>(null);
  const [timeline, setTimeline] = useState<ApplicationTimelineEntry[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [printApp, setPrintApp] = useState<Application | null>(null);
  const [screeningModalApp, setScreeningModalApp] = useState<Application | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await fetchApplications();
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
  }, [selectedId]);

  useEffect(() => {
    const loadDetail = async () => {
      if (!selectedId) {
        setDetail(null);
        setTimeline([]);
        setEvents([]);
        return;
      }
      setLoadingDetail(true);
      try {
        const [app, tline, ev] = await Promise.all([
          fetchApplication(selectedId),
          fetchApplicationTimeline(selectedId),
          fetchApplicationEvents(selectedId),
        ]);
        setDetail(app);
        const builtTimeline = buildTimelineForApplication(app || {});
        setTimeline([...(tline || []), ...builtTimeline]);
        setEvents(ev || []);
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
      const name = (a.fullName || a.name || "").toLowerCase();
      const email = (a.email || "").toLowerCase();
      const property = (a.propertyName || "").toLowerCase();
      return name.includes(q) || email.includes(q) || property.includes(q);
    });
  }, [applications, search]);

  const setStatus = async (id: string, status: ApplicationStatus) => {
    try {
      await updateApplicationStatusApi(id, status);
      setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
      setDetail((prev) => (prev && prev.id === id ? { ...prev, status } : prev));
      showToast({ message: `Status updated to ${status}`, variant: "success" });
    } catch (err: any) {
      showToast({ message: "Failed to update status", description: err?.message || "", variant: "error" });
    }
  };

  const convertToTenant = async (id: string) => {
    try {
      await convertApplicationToTenantApi(id);
      showToast({ message: "Converted to tenant", variant: "success" });
    } catch (err: any) {
      showToast({ message: "Failed to convert", description: err?.message || "", variant: "error" });
    }
  };

  const requestScreening = async (app: Application) => {
    try {
      const payload = buildScreeningPayload(app, user);
      setScreeningModalApp(payload as any);
    } catch (err: any) {
      showToast({ message: "Unable to start screening", description: err?.message || "", variant: "error" });
    }
  };

  const readiness = deriveScreeningReadiness(detail || ({} as Application), subscription);

  return (
    <div style={{ display: "grid", gap: spacing.lg }}>
      <Card elevated>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>Applications</h1>
            <div style={{ color: text.muted, fontSize: "0.95rem" }}>
              Review, screen, and convert applications.
            </div>
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, property"
            style={{ width: 280 }}
          />
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
                <div style={{ fontWeight: 700, color: text.primary }}>{app.fullName || app.name || "Applicant"}</div>
                <div style={{ color: text.muted, fontSize: 12 }}>{app.email || "No email"}</div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <Pill>{app.propertyName || "Property"}</Pill>
                  <Pill>{app.status || "new"}</Pill>
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
            <ApplicationDetailPanel
              application={detail}
              timeline={timeline}
              events={events}
              onStatusChange={(status) => void setStatus(detail.id, status)}
              onConvertTenant={() => void convertToTenant(detail.id)}
              onRequestScreening={() => void requestScreening(detail)}
              readiness={readiness}
            />
          )}
        </Section>
      </Card>

      {screeningModalApp ? (
        <ScreeningDetailModal
          open={!!screeningModalApp}
          onClose={() => setScreeningModalApp(null)}
          application={screeningModalApp}
          onConvertedTenant={() => void convertToTenant(screeningModalApp.id)}
        />
      ) : null}

      {printApp ? (
        <PrintApplicationView application={printApp} onClose={() => setPrintApp(null)} />
      ) : null}
    </div>
  );
};

export default ApplicationsPage;
