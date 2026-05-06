import React from "react";
import {
  fetchInstitutionExportPreview,
  type InstitutionExportPackage,
  type InstitutionExportPackageType,
  type InstitutionExportSection,
} from "@/api/institutionExportsApi";
import { MacShell } from "@/components/layout/MacShell";
import { Button, Card, Section } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";

const PACKAGE_OPTIONS: Array<{ value: InstitutionExportPackageType; label: string }> = [
  { value: "lender_due_diligence", label: "Lender due diligence" },
  { value: "insurance_review", label: "Insurance review" },
  { value: "government_program_review", label: "Government program review" },
  { value: "auditor_review", label: "Auditor review" },
  { value: "internal_admin_review", label: "Internal admin review" },
];

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusTone(status: string) {
  if (status === "blocked") return { color: "#991b1b", background: "#fee2e2", border: "#fecaca" };
  if (status === "included" || status === "preview_ready") {
    return { color: "#166534", background: "#dcfce7", border: "#bbf7d0" };
  }
  return { color: "#475569", background: "#f8fafc", border: "#e2e8f0" };
}

function Badge({ children, status }: { children: React.ReactNode; status: string }) {
  const tone = statusTone(status);
  return (
    <span
      style={{
        border: `1px solid ${tone.border}`,
        borderRadius: 999,
        background: tone.background,
        color: tone.color,
        padding: "3px 9px",
        fontSize: 12,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Failed to load institution export preview";
}

function SectionRow({ section }: { section: InstitutionExportSection }) {
  return (
    <Card style={{ borderRadius: 8, padding: 12, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <strong style={{ color: "#0f172a" }}>{section.label}</strong>
          <div style={{ color: "#64748b", fontSize: 13 }}>{section.recordsCount} records</div>
        </div>
        <Badge status={section.status}>{label(section.status)}</Badge>
      </div>
      {section.blockedReasons.length ? (
        <div style={{ color: "#92400e", fontSize: 13 }}>{section.blockedReasons.join(" ")}</div>
      ) : null}
    </Card>
  );
}

function PreviewSummary({ data }: { data: InstitutionExportPackage }) {
  const preview = data.payloadPreview || {};
  const propertySummary = preview.propertySummary || {};
  const leaseSummary = preview.leaseSummary || {};
  const occupancySummary = preview.occupancySummary || {};
  const decisionSummary = preview.decisionSummary || {};
  const maintenanceSummary = preview.maintenanceSummary || {};

  const rows = [
    ["Properties", propertySummary.propertyCount],
    ["Units", propertySummary.unitCount],
    ["Active leases", leaseSummary.activeLeaseCount],
    ["Occupancy rate", occupancySummary.occupancyRate == null ? "Unavailable" : `${occupancySummary.occupancyRate}%`],
    ["Decisions", decisionSummary.total],
    ["Critical decisions", decisionSummary.critical],
    ["Maintenance records", maintenanceSummary.total],
  ];

  return (
    <Card style={{ borderRadius: 8, display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 900 }}>Preview payload summary</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
        {rows.map(([name, value]) => (
          <div key={String(name)} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 10 }}>
            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{name}</div>
            <strong style={{ color: "#0f172a", fontSize: 18 }}>{String(value ?? 0)}</strong>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function InstitutionExportsPage() {
  const { showToast } = useToast();
  const [packageType, setPackageType] = React.useState<InstitutionExportPackageType>("lender_due_diligence");
  const [data, setData] = React.useState<InstitutionExportPackage | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadPreview = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const preview = await fetchInstitutionExportPreview(packageType);
      setData(preview);
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      showToast({ message: "Failed to load institution export preview", description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [packageType, showToast]);

  React.useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  return (
    <MacShell title="Institution export preview" showTopNav={false}>
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Institution export preview</h1>
            <div style={{ color: "#475569", maxWidth: 900 }}>
              Preview only. No data is submitted externally. Manual review required before sharing with any institution.
              Sensitive tenant data may be excluded or redacted.
            </div>
          </div>
        </Section>

        <Section style={{ display: "flex", alignItems: "end", gap: 12, flexWrap: "wrap" }}>
          <label style={{ display: "grid", gap: 5, color: "#334155", fontSize: 13, fontWeight: 800 }}>
            Package type
            <select
              value={packageType}
              onChange={(event) => setPackageType(event.target.value as InstitutionExportPackageType)}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "8px 10px",
                color: "#0f172a",
                background: "#fff",
                minWidth: 240,
              }}
            >
              {PACKAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" onClick={loadPreview} disabled={loading}>
            Preview package
          </Button>
        </Section>

        {loading ? <Card>Loading institution export preview...</Card> : null}
        {!loading && error ? (
          <Card style={{ color: "#b91c1c" }}>We couldn't load the institution export preview right now.</Card>
        ) : null}

        {!loading && !error && data ? (
          <>
            <Section style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>Readiness</div>
                  <h2 style={{ margin: "2px 0 0", fontSize: "1.1rem" }}>{label(data.packageType)}</h2>
                </div>
                <Badge status={data.status}>{label(data.status)}</Badge>
              </div>
              <div style={{ color: "#475569", lineHeight: 1.55 }}>
                Audience: {label(data.audience)}. Manual only: {data.manualOnly ? "Yes" : "No"}. External submission enabled:{" "}
                {data.externalSubmissionEnabled ? "Yes" : "No"}.
              </div>
              {data.blockedReasons.length ? (
                <Card style={{ borderRadius: 8, color: "#92400e", background: "#fffbeb" }}>
                  {data.blockedReasons.join(" ")}
                </Card>
              ) : null}
            </Section>

            <Section style={{ display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 900 }}>Included sections</div>
              <div style={{ display: "grid", gap: 10 }}>
                {data.sections.map((section) => (
                  <SectionRow key={section.sectionKey} section={section} />
                ))}
              </div>
            </Section>

            <Section style={{ display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 900 }}>Redactions</div>
              {data.redactions.map((redaction) => (
                <Card key={redaction.fieldCategory} style={{ borderRadius: 8, padding: 12 }}>
                  <strong style={{ color: "#0f172a" }}>{label(redaction.fieldCategory)}</strong>
                  <div style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>{redaction.reason}</div>
                </Card>
              ))}
            </Section>

            <PreviewSummary data={data} />
          </>
        ) : null}
      </div>
    </MacShell>
  );
}
