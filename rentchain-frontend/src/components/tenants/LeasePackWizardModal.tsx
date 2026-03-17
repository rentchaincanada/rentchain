import React from "react";
import { Button } from "../ui/Ui";
import {
  activateLeaseDraft,
  createLeaseDraft,
  generateLeaseDraftPdf,
  getLeaseSnapshot,
  LeaseDraftPayload,
  LeaseTermType,
  updateLeaseDraft,
} from "@/api/leasePacksApi";
import type { Lease } from "@/api/leasesApi";
import { useToast } from "../ui/ToastProvider";
import { apiJson } from "@/api/http";
import { normalizeProvinceCode, provinceLabelFromCode, type ProvinceCode } from "@/lib/provinces";
import { LeaseRiskCard } from "@/components/leases/LeaseRiskCard";

interface Props {
  open: boolean;
  onClose: () => void;
  tenant: any;
  lease: any;
  landlordName: string;
}

type FormState = {
  termType: LeaseTermType;
  startDate: string;
  endDate: string;
  baseRent: string;
  parking: string;
  dueDay: string;
  paymentMethod: string;
  utilitiesIncluded: string[];
  deposit: string;
  additionalClauses: string;
};

const utilities = ["heat", "water", "electricity", "internet", "parking"];

function dollarsToCents(value: string): number {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function centsToDollars(value: unknown): string {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "";
  return (n / 100).toFixed(2);
}

export const LeasePackWizardModal: React.FC<Props> = ({
  open,
  onClose,
  tenant,
  lease,
  landlordName,
}) => {
  const defaultStart = new Date().toISOString().slice(0, 10);
  const [draftId, setDraftId] = React.useState<string>("");
  const [snapshotId, setSnapshotId] = React.useState<string>("");
  const [downloadUrl, setDownloadUrl] = React.useState<string>("");
  const [error, setError] = React.useState<string>("");
  const [saving, setSaving] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [activating, setActivating] = React.useState(false);
  const [activatedLeaseId, setActivatedLeaseId] = React.useState<string>("");
  const [activatedLease, setActivatedLease] = React.useState<Lease | null>(null);
  const [provinceCode, setProvinceCode] = React.useState<ProvinceCode | null>(null);
  const [provinceLoading, setProvinceLoading] = React.useState(false);
  const [state, setState] = React.useState<FormState>({
    termType: "fixed",
    startDate: String(tenant?.leaseStart || lease?.startDate || defaultStart),
    endDate: String(tenant?.leaseEnd || lease?.endDate || ""),
    baseRent: String(lease?.monthlyRent || tenant?.monthlyRent || ""),
    parking: "0",
    dueDay: "1",
    paymentMethod: "etransfer",
    utilitiesIncluded: [],
    deposit: "",
    additionalClauses: "",
  });
  const hasInitializedRef = React.useRef(false);
  const { showToast } = useToast();

  const tenantId = String(tenant?.id || tenant?.tenantId || "").trim();
  const tenantName = String(tenant?.fullName || tenant?.name || tenant?.email || "Tenant").trim();
  const propertyId = String(tenant?.propertyId || lease?.propertyId || "").trim();
  const unitId = String(tenant?.unitId || lease?.unitId || tenant?.unit || lease?.unitNumber || "").trim();
  const propertyAddress = String(tenant?.propertyName || lease?.propertyName || propertyId || "").trim();
  const unitLabel = String(tenant?.unit || lease?.unitNumber || unitId || "").trim();

  const payload = React.useMemo<LeaseDraftPayload>(() => {
    return {
      propertyId,
      unitId,
      tenantIds: tenantId ? [tenantId] : [],
      province: "NS",
      termType: state.termType,
      startDate: state.startDate,
      endDate: state.termType === "fixed" ? state.endDate || null : null,
      baseRentCents: dollarsToCents(state.baseRent),
      parkingCents: dollarsToCents(state.parking),
      dueDay: Number(state.dueDay || 1),
      paymentMethod: state.paymentMethod || "etransfer",
      utilitiesIncluded: state.utilitiesIncluded,
      depositCents: state.deposit ? dollarsToCents(state.deposit) : null,
      additionalClauses: state.additionalClauses,
    };
  }, [propertyId, state, tenantId, unitId]);

  React.useEffect(() => {
    let cancelled = false;
    async function resolveProvince() {
      if (!open) return;
      const fromTenantOrLease =
        normalizeProvinceCode(String(tenant?.province || lease?.province || "")) || null;
      if (fromTenantOrLease && fromTenantOrLease !== "UNSET") {
        if (!cancelled) setProvinceCode(fromTenantOrLease);
        return;
      }
      if (!propertyId) {
        if (!cancelled) setProvinceCode("UNSET");
        return;
      }

      setProvinceLoading(true);
      try {
        const resp = await apiJson<any>("/properties");
        const list = Array.isArray(resp?.items)
          ? resp.items
          : Array.isArray(resp?.properties)
            ? resp.properties
            : [];
        const match = list.find(
          (item: any) =>
            String(item?.id || "").trim() === propertyId || String(item?.propertyId || "").trim() === propertyId
        );
        const resolved = normalizeProvinceCode(String(match?.province || "")) || "UNSET";
        if (!cancelled) setProvinceCode(resolved);
      } catch {
        if (!cancelled) setProvinceCode("UNSET");
      } finally {
        if (!cancelled) setProvinceLoading(false);
      }
    }
    void resolveProvince();
    return () => {
      cancelled = true;
    };
  }, [open, propertyId, tenant?.province, lease?.province]);

  const isNsProvince = provinceCode === "NS";
  const isOntario = provinceCode === "ON";
  const provinceUnset = !provinceCode || provinceCode === "UNSET";
  const blockingProvinceError =
    !provinceLoading && provinceUnset ? "Set property province to generate lease pack" : "";

  React.useEffect(() => {
    if (!open) {
      setDraftId("");
      setSnapshotId("");
      setDownloadUrl("");
      setActivatedLeaseId("");
      setActivatedLease(null);
      setError("");
      hasInitializedRef.current = false;
      return;
    }
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    if (!propertyId || !unitId || !tenantId) {
      setError("Missing tenant/property/unit data to create a lease pack draft.");
    }
  }, [open, propertyId, tenantId, unitId]);

  React.useEffect(() => {
    if (!open || !draftId) return;
    const t = window.setTimeout(() => {
      setSaving(true);
      updateLeaseDraft(draftId, payload)
        .catch((err: any) => setError(err?.message || "Failed to save draft changes."))
        .finally(() => setSaving(false));
    }, 500);
    return () => window.clearTimeout(t);
  }, [draftId, open, payload]);

  const toggleUtility = (key: string) => {
    setState((prev) => ({
      ...prev,
      utilitiesIncluded: prev.utilitiesIncluded.includes(key)
        ? prev.utilitiesIncluded.filter((x) => x !== key)
        : [...prev.utilitiesIncluded, key],
    }));
  };

  const handleGenerate = async () => {
    if (!isNsProvince) {
      setError("Schedule A generation is available for Nova Scotia properties only.");
      return;
    }
    if (import.meta.env.MODE !== "production") {
      console.debug("[leasepack] generate clicked", {
        termType: state.termType,
        startDate: state.startDate,
        endDate: state.endDate || null,
        baseRentCents: dollarsToCents(state.baseRent),
        draftId: draftId || null,
      });
    }
    if (!propertyId || !unitId || !tenantId) {
      setError("Missing tenant/property/unit data to create a lease pack draft.");
      return;
    }
    if (!state.startDate) {
      setError("Start date is required.");
      return;
    }
    if (state.termType === "fixed" && !state.endDate) {
      setError("End date required for fixed term.");
      return;
    }
    if (dollarsToCents(state.baseRent) <= 0) {
      setError("Base rent must be greater than 0.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      let nextDraftId = draftId;
      if (!nextDraftId) {
        const created = await createLeaseDraft(payload);
        nextDraftId = created.draftId;
        setDraftId(created.draftId);
      } else {
        await updateLeaseDraft(nextDraftId, payload);
      }
      const generated = await generateLeaseDraftPdf(nextDraftId, {
        tenantNames: [tenantName],
        propertyAddress,
        unitLabel,
      });
      setSnapshotId(generated.snapshotId);
      setDownloadUrl(generated.scheduleAUrl);
    } catch (err: any) {
      setError(err?.message || "Failed to generate Schedule A PDF.");
    } finally {
      setGenerating(false);
    }
  };

  const handleRedownload = async () => {
    if (!snapshotId) return;
    try {
      const snap = await getLeaseSnapshot(snapshotId);
      const url = snap.snapshot.generatedFiles?.[0]?.url;
      if (url) setDownloadUrl(url);
    } catch (err: any) {
      setError(err?.message || "Failed to fetch snapshot.");
    }
  };

  const handleActivateLease = async () => {
    if (!isNsProvince) {
      setError("Lease activation from this modal is available for Nova Scotia Schedule A flow only.");
      return;
    }
    if (!draftId) {
      setError("Generate Schedule A PDF first, then activate the lease.");
      return;
    }
    setActivating(true);
    setError("");
    try {
      const result = await activateLeaseDraft(draftId);
      setActivatedLeaseId(result.leaseId);
      setActivatedLease(result.lease);
      showToast({
        message: "Lease activated",
        description: "Lifecycle automation is now enabled for this tenant lease.",
        variant: "success",
      });
      window.dispatchEvent(
        new CustomEvent("lease:activated", {
          detail: { tenantId, leaseId: result.leaseId, draftId },
        })
      );
    } catch (err: any) {
      setError(err?.message || "Failed to activate lease.");
    } finally {
      setActivating(false);
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 3500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(820px, 96vw)",
          maxHeight: "92vh",
          overflow: "auto",
          borderRadius: 12,
          border: "1px solid #d1d5db",
          background: "#ffffff",
          padding: 16,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>
              Create Lease Pack ({provinceCode && provinceCode !== "UNSET" ? provinceCode : "Province required"})
            </div>
            <div style={{ fontSize: 12, color: "#4b5563" }}>
              {isNsProvince
                ? "This Schedule A is an addendum to Nova Scotia Standard Form of Lease (Form P)."
                : isOntario
                  ? "Ontario lease pack documents are available for Ontario properties."
                  : "Set property province to continue."}
            </div>
          </div>
          <Button onClick={onClose} style={{ padding: "6px 10px" }}>
            Close
          </Button>
        </div>

        <div style={{ fontSize: 13, color: "#4b5563" }}>
          {isNsProvince ? "Form P reference template:" : "Lease template library:"}{" "}
          <a href="/help/templates" style={{ color: "#2563eb", textDecoration: "underline" }}>
            Templates
          </a>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          <Field label="Landlord">
            <div>{landlordName || "Landlord"}</div>
          </Field>
          <Field label="Tenant">
            <div>{tenantName}</div>
          </Field>
          <Field label="Property">
            <div>{propertyAddress || propertyId || "Unknown"}</div>
          </Field>
          <Field label="Unit">
            <div>{unitLabel || unitId || "Unknown"}</div>
          </Field>
          <Field label="Province">
            <div>{provinceCode ? provinceLabelFromCode(provinceCode) : provinceLoading ? "Loading..." : "Unknown"}</div>
          </Field>
        </div>

        {blockingProvinceError ? (
          <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", padding: 10, borderRadius: 8 }}>
            {blockingProvinceError}
          </div>
        ) : null}

        {!blockingProvinceError && !isNsProvince ? (
          <div
            style={{
              border: "1px solid #d1d5db",
              background: "#f9fafb",
              color: "#374151",
              padding: 12,
              borderRadius: 8,
              fontSize: 13,
            }}
          >
            {isOntario
              ? "Ontario pack selected. Nova Scotia Schedule A generation is not used for Ontario properties."
              : "Select a supported province to continue."}
          </div>
        ) : null}

        {isNsProvince ? (
          <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          <Field label="Term type">
            <select
              value={state.termType}
              onChange={(e) => setState((prev) => ({ ...prev, termType: e.target.value as LeaseTermType }))}
            >
              <option value="fixed">Fixed</option>
              <option value="month-to-month">Month-to-month</option>
              <option value="year-to-year">Year-to-year</option>
            </select>
          </Field>
          <Field label="Start date">
            <input
              type="date"
              value={state.startDate}
              onChange={(e) => setState((prev) => ({ ...prev, startDate: e.target.value }))}
            />
          </Field>
          <Field label={state.termType === "fixed" ? "End date *" : "End date (optional)"}>
            <input
              type="date"
              value={state.endDate}
              disabled={state.termType !== "fixed"}
              onChange={(e) => setState((prev) => ({ ...prev, endDate: e.target.value }))}
            />
          </Field>
          <Field label="Due day">
            <input
              type="number"
              min={1}
              max={31}
              value={state.dueDay}
              onChange={(e) => setState((prev) => ({ ...prev, dueDay: e.target.value }))}
            />
          </Field>
          <Field label="Base rent (CAD)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={state.baseRent}
              onChange={(e) => setState((prev) => ({ ...prev, baseRent: e.target.value }))}
            />
          </Field>
          <Field label="Parking (CAD)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={state.parking}
              onChange={(e) => setState((prev) => ({ ...prev, parking: e.target.value }))}
            />
          </Field>
          <Field label="Deposit (CAD)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={state.deposit}
              onChange={(e) => setState((prev) => ({ ...prev, deposit: e.target.value }))}
            />
          </Field>
          <Field label="Payment method">
            <select
              value={state.paymentMethod}
              onChange={(e) => setState((prev) => ({ ...prev, paymentMethod: e.target.value }))}
            >
              <option value="etransfer">eTransfer</option>
              <option value="bank">Bank transfer</option>
              <option value="cheque">Cheque</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </select>
          </Field>
        </div>

        <Field label="Utilities included">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {utilities.map((u) => (
              <label key={u} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={state.utilitiesIncluded.includes(u)}
                  onChange={() => toggleUtility(u)}
                />
                <span>{u}</span>
              </label>
            ))}
          </div>
        </Field>

        <Field label="Additional clauses">
          <textarea
            rows={5}
            value={state.additionalClauses}
            onChange={(e) => setState((prev) => ({ ...prev, additionalClauses: e.target.value }))}
            style={{ width: "100%", borderRadius: 8, border: "1px solid #d1d5db", padding: 8, fontSize: 13 }}
          />
        </Field>
          </>
        ) : null}

        {error ? (
          <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", padding: 10, borderRadius: 8 }}>
            {error}
          </div>
        ) : null}

        {isNsProvince ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ color: "#4b5563", fontSize: 12 }}>
            {saving ? "Saving draft..." : draftId ? `Draft: ${draftId}` : "Preparing draft..."}
            {snapshotId ? ` • Snapshot: ${snapshotId}` : ""}
            {activatedLeaseId ? ` • Lease: ${activatedLeaseId}` : ""}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {snapshotId ? (
              <Button type="button" onClick={handleRedownload} style={{ padding: "8px 12px" }}>
                Refresh Download URL
              </Button>
            ) : null}
            {downloadUrl ? (
              <Button type="button" onClick={() => window.open(downloadUrl, "_blank")} style={{ padding: "8px 12px" }}>
                Download Schedule A PDF
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={saving || generating}
              style={{ padding: "8px 12px" }}
            >
              {generating ? "Generating..." : "Generate Schedule A PDF"}
            </Button>
            {snapshotId ? (
              <Button
                type="button"
                onClick={handleActivateLease}
                disabled={activating}
                style={{ padding: "8px 12px" }}
              >
                {activating ? "Activating..." : "Activate Lease"}
              </Button>
            ) : null}
          </div>
        </div>
        ) : null}
        {isNsProvince && snapshotId ? (
          <div style={{ color: "#4b5563", fontSize: 12 }}>
            Activating creates the official lease record and enables lifecycle automation.
          </div>
        ) : null}

        {activatedLeaseId ? (
          <LeaseRiskCard risk={activatedLease?.risk ?? null} />
        ) : null}
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label style={{ display: "grid", gap: 6 }}>
    <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>{label}</span>
    <div
      style={{
        border: "1px solid #d1d5db",
        borderRadius: 8,
        padding: 8,
        fontSize: 13,
      }}
    >
      {children}
    </div>
  </label>
);
