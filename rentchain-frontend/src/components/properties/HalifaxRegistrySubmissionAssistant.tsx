import React, { useEffect, useMemo, useState } from "react";
import {
  exportHalifaxRegistrySubmission,
  fetchHalifaxRegistrySubmission,
  saveHalifaxRegistrySubmission,
  type HalifaxAddress,
  type HalifaxBuildingDraft,
  type HalifaxFieldMapEntry,
  type HalifaxFieldMetaEntry,
  type HalifaxSubmissionConsent,
  type HalifaxSubmissionDeclarations,
  type HalifaxSubmissionDraft,
  type HalifaxSubmissionFieldValues,
  type Property,
} from "../../api/propertiesApi";
import { Button, Card, Input, Pill } from "../ui/Ui";
import { useToast } from "../ui/ToastProvider";

type Props = {
  open: boolean;
  property: Property | null;
  onClose: () => void;
};

const STEP_TITLES = [
  "Consent & use notice",
  "Review property + owner",
  "Review building details",
  "Complete compliance fields",
  "Confirm declarations",
  "Validate + export",
] as const;

const RENTAL_UNIT_TYPES = [
  "Apartment(s)",
  "Backyard suite",
  "Basement apartment",
  "Bedroom only",
  "Cabin / cottage",
  "Condo",
  "Entire house",
  "Mobile home",
  "Other",
];

const BUILDING_TYPES = [
  "Apartment building",
  "Backyard suite",
  "Building with one or two units",
  "Building with three or more units",
  "Condo",
  "Detached house",
  "Duplex",
  "House",
  "Townhouse / row house",
  "Triplex / fourplex / row house",
  "Other",
];

const AMENITY_OPTIONS = ["Laundry", "Storage", "Gym / exercise", "Common room", "Outdoor area", "Parking"];
const FIRE_SAFETY_OPTIONS = [
  "Carbon monoxide alarm",
  "Emergency lighting",
  "Fire alarm system",
  "Fire extinguisher",
  "Smoke alarm(s)",
  "Sprinkler system",
  "Standpipe / hose system",
];
const ACCESSIBILITY_OPTIONS = ["Elevator", "Barrier-free entry", "Accessible washroom", "Accessible parking"];

function emptyAddress(): HalifaxAddress {
  return {
    line1: "",
    line2: "",
    city: "",
    province: "",
    postalCode: "",
    country: "Canada",
  };
}

function cloneDraft(draft: HalifaxSubmissionDraft): HalifaxSubmissionDraft {
  return JSON.parse(JSON.stringify(draft)) as HalifaxSubmissionDraft;
}

function updateAddress(address: HalifaxAddress, patch: Partial<HalifaxAddress>): HalifaxAddress {
  return { ...address, ...patch };
}

function downloadJson(filename: string, payload: Record<string, unknown>) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function stepForPath(path: string): number {
  if (path.startsWith("consent.")) return 0;
  if (path.startsWith("fieldValues.siteAddress") || path.startsWith("fieldValues.owner") || path.startsWith("fieldValues.primaryContact")) return 1;
  if (path.startsWith("fieldValues.buildings") && !path.includes("amenities") && !path.includes("fireLifeSafetySystems") && !path.includes("yearConstructed")) return 2;
  if (path.startsWith("fieldValues.propertyDescription") || path.includes("amenities") || path.includes("fireLifeSafetySystems") || path.includes("yearConstructed")) return 3;
  if (path.startsWith("declarations")) return 4;
  return 5;
}

function MissingFieldSummary({
  missingPaths,
  currentStep,
}: {
  missingPaths: HalifaxSubmissionDraft["validation"]["missingRequiredFields"];
  currentStep: number;
}) {
  const relevant = missingPaths.filter((item) => stepForPath(item.path) === currentStep);
  if (!relevant.length) return null;
  return (
    <Card style={{ display: "grid", gap: 8, border: "1px solid rgba(245,158,11,0.28)", background: "rgba(254,243,199,0.35)" }}>
      <div style={{ fontWeight: 700, color: "#92400e" }}>Focus items for this step</div>
      <div style={{ display: "grid", gap: 4, fontSize: 14, color: "#78350f" }}>
        {relevant.map((item) => (
          <div key={item.path}>• {item.label}</div>
        ))}
      </div>
    </Card>
  );
}

function badgeStyleForStatus(status: HalifaxFieldMetaEntry["status"]) {
  if (status === "prefilled_from_rentchain") {
    return { background: "rgba(37,99,235,0.1)", color: "#1d4ed8", border: "1px solid rgba(37,99,235,0.22)" };
  }
  if (status === "provided_by_user") {
    return { background: "rgba(22,163,74,0.1)", color: "#15803d", border: "1px solid rgba(22,163,74,0.22)" };
  }
  if (status === "needs_confirmation") {
    return { background: "rgba(245,158,11,0.12)", color: "#b45309", border: "1px solid rgba(245,158,11,0.24)" };
  }
  return { background: "rgba(239,68,68,0.08)", color: "#b91c1c", border: "1px solid rgba(239,68,68,0.2)" };
}

function labelForStatus(status: HalifaxFieldMetaEntry["status"]) {
  switch (status) {
    case "prefilled_from_rentchain":
      return "Pre-filled";
    case "provided_by_user":
      return "Manual entry";
    case "needs_confirmation":
      return "Needs confirmation";
    case "missing":
    default:
      return "Missing required";
  }
}

function FieldTrustBadge({ meta }: { meta?: HalifaxFieldMetaEntry | null }) {
  if (!meta) return null;
  const style = badgeStyleForStatus(meta.status);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        ...style,
      }}
    >
      {labelForStatus(meta.status)}
    </span>
  );
}

function SectionHeading({
  title,
  meta,
  note,
}: {
  title: string;
  meta?: HalifaxFieldMetaEntry | null;
  note?: string | null;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
      <div style={{ fontWeight: 700, color: "#0f172a" }}>{title}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {note ? <div style={{ color: "#64748b", fontSize: 12 }}>{note}</div> : null}
        <FieldTrustBadge meta={meta} />
      </div>
    </div>
  );
}

function AddressFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: HalifaxAddress;
  onChange: (next: HalifaxAddress) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 700, color: "#0f172a" }}>{label}</div>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Address line 1</span>
          <Input value={value.line1 || ""} onChange={(event) => onChange(updateAddress(value, { line1: event.target.value }))} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Address line 2</span>
          <Input value={value.line2 || ""} onChange={(event) => onChange(updateAddress(value, { line2: event.target.value }))} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span>City / Town</span>
          <Input value={value.city || ""} onChange={(event) => onChange(updateAddress(value, { city: event.target.value }))} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Province</span>
          <Input value={value.province || ""} onChange={(event) => onChange(updateAddress(value, { province: event.target.value }))} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Postal code</span>
          <Input value={value.postalCode || ""} onChange={(event) => onChange(updateAddress(value, { postalCode: event.target.value }))} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Country</span>
          <Input value={value.country || ""} onChange={(event) => onChange(updateAddress(value, { country: event.target.value }))} />
        </label>
      </div>
    </div>
  );
}

function ContactFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: HalifaxSubmissionFieldValues["owner"];
  onChange: (next: HalifaxSubmissionFieldValues["owner"]) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 700, color: "#0f172a" }}>{label}</div>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Name / company contact</span>
          <Input value={value.name || ""} onChange={(event) => onChange({ ...value, name: event.target.value })} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Company</span>
          <Input value={value.company || ""} onChange={(event) => onChange({ ...value, company: event.target.value })} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Email</span>
          <Input value={value.email || ""} onChange={(event) => onChange({ ...value, email: event.target.value })} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Phone</span>
          <Input value={value.phone || ""} onChange={(event) => onChange({ ...value, phone: event.target.value })} />
        </label>
      </div>
      <AddressFields label={`${label} mailing address`} value={value.address || emptyAddress()} onChange={(address) => onChange({ ...value, address })} />
    </div>
  );
}

function MultiSelectChips({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: string[];
  values: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ fontWeight: 700, color: "#0f172a" }}>{label}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {options.map((option) => {
          const active = values.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() =>
                onChange(active ? values.filter((entry) => entry !== option) : [...values, option])
              }
              style={{
                padding: "8px 10px",
                borderRadius: 999,
                border: active ? "1px solid rgba(37,99,235,0.38)" : "1px solid rgba(15,23,42,0.12)",
                background: active ? "rgba(37,99,235,0.1)" : "#fff",
                color: active ? "#1d4ed8" : "#334155",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BuildingEditor({
  building,
  index,
  fieldMeta,
  onChange,
  onRemove,
  showComplianceOnly,
}: {
  building: HalifaxBuildingDraft;
  index: number;
  fieldMeta?: {
    buildingType?: HalifaxFieldMetaEntry | null;
    residentialUnitsRented?: HalifaxFieldMetaEntry | null;
    yearConstructed?: HalifaxFieldMetaEntry | null;
    fireLifeSafetySystems?: HalifaxFieldMetaEntry | null;
  };
  onChange: (next: HalifaxBuildingDraft) => void;
  onRemove?: () => void;
  showComplianceOnly?: boolean;
}) {
  if (showComplianceOnly) {
    return (
      <Card style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div style={{ fontWeight: 700 }}>Building {index + 1} compliance details</div>
        </div>
        <SectionHeading title="Amenity / shared-space details" />
        <MultiSelectChips
          label="Amenity / shared-space details"
          options={AMENITY_OPTIONS}
          values={building.amenities}
          onChange={(amenities) => onChange({ ...building, amenities })}
        />
        <SectionHeading title="Fire / life-safety systems" meta={fieldMeta?.fireLifeSafetySystems} />
        <MultiSelectChips
          label="Fire / life-safety systems"
          options={FIRE_SAFETY_OPTIONS}
          values={building.fireLifeSafetySystems}
          onChange={(fireLifeSafetySystems) => onChange({ ...building, fireLifeSafetySystems })}
        />
        <MultiSelectChips
          label="Accessibility / building features"
          options={ACCESSIBILITY_OPTIONS}
          values={building.accessibilityFeatures}
          onChange={(accessibilityFeatures) => onChange({ ...building, accessibilityFeatures })}
        />
        <label style={{ display: "grid", gap: 6 }}>
          <SectionHeading title="Year constructed" meta={fieldMeta?.yearConstructed} />
          <span>Year constructed</span>
          <Input
            value={building.yearConstructed == null ? "" : String(building.yearConstructed)}
            onChange={(event) =>
              onChange({
                ...building,
                yearConstructed: event.target.value ? Number(event.target.value) : null,
              })
            }
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Notes / building description</span>
          <textarea
            value={building.notes || ""}
            onChange={(event) => onChange({ ...building, notes: event.target.value })}
            rows={4}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #dbe4f0" }}
          />
        </label>
      </Card>
    );
  }

  return (
    <Card style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>Building {index + 1}</div>
        {onRemove ? (
          <button type="button" onClick={onRemove} style={{ border: "none", background: "transparent", color: "#b91c1c", cursor: "pointer", fontWeight: 600 }}>
            Remove
          </button>
        ) : null}
      </div>
      <AddressFields
        label="Primary civic address"
        value={building.primaryAddress || emptyAddress()}
        onChange={(primaryAddress) => onChange({ ...building, primaryAddress })}
      />
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <label style={{ display: "grid", gap: 6 }}>
          <SectionHeading title="Residential units rented" meta={fieldMeta?.residentialUnitsRented} />
          <span>Residential units rented</span>
          <Input
            value={building.residentialUnitsRented == null ? "" : String(building.residentialUnitsRented)}
            onChange={(event) =>
              onChange({ ...building, residentialUnitsRented: event.target.value ? Number(event.target.value) : null })
            }
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Short-term rental units</span>
          <Input
            value={building.shortTermRentalUnits == null ? "" : String(building.shortTermRentalUnits)}
            onChange={(event) =>
              onChange({ ...building, shortTermRentalUnits: event.target.value ? Number(event.target.value) : null })
            }
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Total residential units</span>
          <Input
            value={building.totalResidentialUnits == null ? "" : String(building.totalResidentialUnits)}
            onChange={(event) =>
              onChange({ ...building, totalResidentialUnits: event.target.value ? Number(event.target.value) : null })
            }
          />
        </label>
      </div>
      <label style={{ display: "grid", gap: 6 }}>
        <SectionHeading title="Building type" meta={fieldMeta?.buildingType} />
        <span>Building type</span>
        <select
          value={building.buildingType || ""}
          onChange={(event) => onChange({ ...building, buildingType: event.target.value || null })}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #dbe4f0" }}
        >
          <option value="">Select building type</option>
          {BUILDING_TYPES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      {building.buildingType === "Other" ? (
        <label style={{ display: "grid", gap: 6 }}>
          <span>Other building type</span>
          <Input value={building.otherBuildingType || ""} onChange={(event) => onChange({ ...building, otherBuildingType: event.target.value })} />
        </label>
      ) : null}
      <MultiSelectChips
        label="Rental unit types"
        options={RENTAL_UNIT_TYPES}
        values={building.rentalUnitTypes}
        onChange={(rentalUnitTypes) => onChange({ ...building, rentalUnitTypes })}
      />
      {building.rentalUnitTypes.includes("Other") ? (
        <label style={{ display: "grid", gap: 6 }}>
          <span>Other rental unit type</span>
          <Input value={building.otherRentalUnitType || ""} onChange={(event) => onChange({ ...building, otherRentalUnitType: event.target.value })} />
        </label>
      ) : null}
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontWeight: 700 }}>Commercial units present?</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["Yes", "No"].map((option) => {
            const value = option === "Yes";
            const active = building.hasCommercialUnits === value;
            return (
              <button
                key={option}
                type="button"
                onClick={() => onChange({ ...building, hasCommercialUnits: value })}
                style={{
                  padding: "8px 10px",
                  borderRadius: 999,
                  border: active ? "1px solid rgba(37,99,235,0.38)" : "1px solid rgba(15,23,42,0.12)",
                  background: active ? "rgba(37,99,235,0.1)" : "#fff",
                  color: active ? "#1d4ed8" : "#334155",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

export function HalifaxRegistrySubmissionAssistant({ open, property, onClose }: Props) {
  const propertyId = property?.id || null;
  const { showToast } = useToast();
  const [draft, setDraft] = useState<HalifaxSubmissionDraft | null>(null);
  const [fieldMap, setFieldMap] = useState<HalifaxFieldMapEntry[]>([]);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !propertyId) return;
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchHalifaxRegistrySubmission(propertyId);
        if (!active) return;
        setDraft(cloneDraft(result.submission));
        setFieldMap(result.fieldMap || []);
        setStep(0);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || "Failed to load Halifax registry submission assistant.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [open, propertyId]);

  const updateDraft = (mutator: (current: HalifaxSubmissionDraft) => HalifaxSubmissionDraft) => {
    setDraft((current) => (current ? mutator(current) : current));
  };

  const updateFieldMeta = (
    path: string,
    meta: Partial<HalifaxFieldMetaEntry>
  ) => {
    updateDraft((current) => ({
      ...current,
      fieldMeta: {
        ...current.fieldMeta,
        [path]: {
          source: meta.source || current.fieldMeta?.[path]?.source || "manual",
          status: meta.status || current.fieldMeta?.[path]?.status || "provided_by_user",
          confirmed: meta.confirmed ?? current.fieldMeta?.[path]?.confirmed ?? true,
        },
      },
    }));
  };

  const markProvidedByUser = (path: string) =>
    updateFieldMeta(path, {
      source: "manual",
      status: "provided_by_user",
      confirmed: true,
    });

  const blockingCount =
    (draft?.validation.missingRequiredFields.length || 0) +
    (draft?.validation.missingConsentItems.length || 0);
  const autoFilledCount = useMemo(
    () => fieldMap.filter((entry) => entry.source !== "user_input_required" && entry.source !== "unsupported").length,
    [fieldMap]
  );
  const canMovePastConsent = Boolean(draft?.consent.preparationAuthorized);
  const canExport = Boolean(draft?.validation.exportReady);

  const persistDraft = async (nextDraft: HalifaxSubmissionDraft, toastMessage?: string) => {
    if (!propertyId) return;
    setSaving(true);
    try {
      const result = await saveHalifaxRegistrySubmission(propertyId, {
        fieldValues: nextDraft.fieldValues,
        fieldMeta: nextDraft.fieldMeta,
        declarations: nextDraft.declarations,
        consent: nextDraft.consent,
        status: nextDraft.status,
      });
      setDraft(cloneDraft(result.submission));
      if (toastMessage) {
        showToast({
          message: toastMessage,
          description: result.submission.validation.exportReady
            ? "This property is ready to export as a Halifax draft."
            : "Consent, declaration confirmation, or required Halifax fields still need attention.",
        });
      }
    } catch (err: any) {
      setError(err?.message || "Failed to save Halifax registry submission draft.");
      showToast({
        message: "Save failed",
        description: err?.message || "Failed to save Halifax registry submission draft.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Halifax Registry Submission Assistant"
      onMouseDown={() => {
        if (!saving && !exporting) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.46)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
        zIndex: 1300,
      }}
    >
      <div
        onMouseDown={(event) => event.stopPropagation()}
        style={{
          width: "min(1080px, 100%)",
          maxHeight: "90vh",
          overflow: "auto",
          background: "#fff",
          borderRadius: 18,
          padding: 18,
          display: "grid",
          gap: 16,
          boxShadow: "0 22px 70px rgba(15,23,42,0.22)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.7 }}>
              Compliance / Registry
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>Prepare Halifax rental registry submission</div>
            <div style={{ color: "#475569", lineHeight: 1.5, maxWidth: 760 }}>
              Review the data RentChain already knows, answer the missing Halifax compliance questions, and export a submission-ready payload for guided municipal filing.
            </div>
            <div style={{ color: "#334155", fontSize: 13 }}>
              This assistant prepares a Halifax registry draft for your review. It does not submit directly to Halifax.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill tone="muted">{property?.name || property?.addressLine1 || "Property"}</Pill>
            {draft ? <Pill tone={draft.status === "ready" || draft.status === "exported" ? "accent" : "muted"}>{draft.status.replace(/_/g, " ")}</Pill> : null}
          </div>
        </div>

        {loading ? <Card>Loading Halifax submission assistant…</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>{error}</Card> : null}

        {!loading && draft ? (
          <>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <Pill tone={canExport ? "accent" : "muted"}>
                  {canExport ? "Ready to export" : `${blockingCount} readiness blocker${blockingCount === 1 ? "" : "s"}`}
                </Pill>
                <Pill tone="muted">{draft.validation.completionPercent}% complete</Pill>
                <Pill tone="muted">{autoFilledCount} fields prefilled from RentChain</Pill>
              </div>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                {STEP_TITLES.map((title, index) => (
                  <button
                    key={title}
                    type="button"
                    onClick={() => {
                      if (index > 0 && !canMovePastConsent) return;
                      setStep(index);
                    }}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: index === step ? "1px solid rgba(37,99,235,0.35)" : "1px solid rgba(15,23,42,0.08)",
                      background: index === step ? "rgba(37,99,235,0.08)" : "#fff",
                      color: index === step ? "#1d4ed8" : "#334155",
                      textAlign: "left",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    <div style={{ fontSize: 12, opacity: 0.8 }}>Step {index + 1}</div>
                    <div>{title}</div>
                  </button>
                ))}
              </div>
            </div>

            <MissingFieldSummary missingPaths={draft.validation.missingRequiredFields} currentStep={step} />

            {step === 0 ? (
              <div style={{ display: "grid", gap: 14 }}>
                <Card style={{ display: "grid", gap: 10, background: "rgba(37,99,235,0.04)" }}>
                  <div style={{ fontWeight: 700 }}>Consent & use notice</div>
                  <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.6 }}>
                    RentChain can use your stored property and account information, together with any extra details you add here,
                    to prepare a Halifax rental registry submission draft for this property. This version does not submit
                    directly to Halifax, and you remain responsible for reviewing the information before municipal use.
                  </div>
                  <label
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "start",
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: "1px solid #dbe4f0",
                      background: "#fff",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={draft.consent.preparationAuthorized}
                      onChange={(event) =>
                        updateDraft((current) => ({
                          ...current,
                          consent: {
                            ...current.consent,
                            preparationAuthorized: event.target.checked,
                          } as HalifaxSubmissionConsent,
                        }))
                      }
                    />
                    <span style={{ lineHeight: 1.5 }}>
                      I authorize RentChain to use my stored property and account information to prepare a Halifax rental
                      registry submission draft for this property.
                    </span>
                  </label>
                  {!draft.consent.preparationAuthorized ? (
                    <div style={{ color: "#92400e", fontSize: 13 }}>
                      You’ll be able to continue once this authorization is checked.
                    </div>
                  ) : null}
                </Card>
              </div>
            ) : null}

            {step === 1 ? (
              <div style={{ display: "grid", gap: 14 }}>
                <Card style={{ display: "grid", gap: 8, background: "rgba(37,99,235,0.04)" }}>
                  <div style={{ fontWeight: 700 }}>Prefill overview</div>
                  <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.5 }}>
                    Property address, PID, and any saved landlord contact details were prefilled where available. Review them here before moving on to the Halifax-only questions.
                  </div>
                </Card>
                <SectionHeading title="Site / property address" meta={draft.fieldMeta["fieldValues.siteAddress.line1"]} />
                <AddressFields
                  label="Site / property address"
                  value={draft.fieldValues.siteAddress || emptyAddress()}
                  onChange={(siteAddress) => {
                    updateDraft((current) => ({ ...current, fieldValues: { ...current.fieldValues, siteAddress } }));
                    markProvidedByUser("fieldValues.siteAddress.line1");
                  }}
                />
                <SectionHeading title="Property Identifier (PID)" meta={draft.fieldMeta["fieldValues.propertyIdentifierPid"]} />
                <label style={{ display: "grid", gap: 6 }}>
                  <span>Property Identifier (PID)</span>
                  <Input
                    value={draft.fieldValues.propertyIdentifierPid || ""}
                    onChange={(event) => {
                      updateDraft((current) => ({
                        ...current,
                        fieldValues: { ...current.fieldValues, propertyIdentifierPid: event.target.value },
                      }));
                      markProvidedByUser("fieldValues.propertyIdentifierPid");
                    }}
                  />
                </label>
                <SectionHeading title="Property owner" meta={draft.fieldMeta["fieldValues.owner.name"]} note="Name / email / phone are tracked separately below." />
                <ContactFields
                  label="Property owner"
                  value={draft.fieldValues.owner}
                  onChange={(owner) => {
                    updateDraft((current) => ({ ...current, fieldValues: { ...current.fieldValues, owner } }));
                    markProvidedByUser("fieldValues.owner.name");
                    markProvidedByUser("fieldValues.owner.email");
                    markProvidedByUser("fieldValues.owner.phone");
                  }}
                />
                <Card style={{ display: "grid", gap: 10 }}>
                  <SectionHeading title="Primary contact" />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[
                      { label: "Same as owner", value: true },
                      { label: "Different contact", value: false },
                    ].map((option) => {
                      const active = draft.fieldValues.primaryContactSameAsOwner === option.value;
                      return (
                        <button
                          key={option.label}
                          type="button"
                          onClick={() => {
                            updateDraft((current) => ({
                              ...current,
                              fieldValues: {
                                ...current.fieldValues,
                                primaryContactSameAsOwner: option.value,
                              },
                            }));
                            markProvidedByUser("fieldValues.primaryContactSameAsOwner");
                          }}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 999,
                            border: active ? "1px solid rgba(37,99,235,0.35)" : "1px solid rgba(15,23,42,0.12)",
                            background: active ? "rgba(37,99,235,0.08)" : "#fff",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  {draft.fieldValues.primaryContactSameAsOwner === false ? (
                    <ContactFields
                      label="Primary contact details"
                      value={draft.fieldValues.primaryContact}
                      onChange={(primaryContact) => {
                        updateDraft((current) => ({
                          ...current,
                          fieldValues: { ...current.fieldValues, primaryContact },
                        }));
                        markProvidedByUser("fieldValues.primaryContact.name");
                      }}
                    />
                  ) : null}
                </Card>
              </div>
            ) : null}

            {step === 2 ? (
              <div style={{ display: "grid", gap: 14 }}>
                <Card style={{ display: "grid", gap: 8, background: "rgba(15,23,42,0.03)" }}>
                  <div style={{ fontWeight: 700 }}>Building guidance</div>
                  <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.5 }}>
                    Halifax supports up to five buildings on the same property in this flow. If you have more than five, mark that below so the export stays honest and reviewable.
                  </div>
                </Card>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontWeight: 700 }}>More than five buildings on the same property?</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[
                      { label: "Yes", value: true },
                      { label: "No", value: false },
                    ].map((option) => {
                      const active = draft.fieldValues.moreThanFiveBuildings === option.value;
                      return (
                        <button
                          key={option.label}
                          type="button"
                          onClick={() => {
                            updateDraft((current) => ({
                              ...current,
                              fieldValues: {
                                ...current.fieldValues,
                                moreThanFiveBuildings: option.value,
                              },
                            }));
                            markProvidedByUser("fieldValues.moreThanFiveBuildings");
                          }}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 999,
                            border: active ? "1px solid rgba(37,99,235,0.35)" : "1px solid rgba(15,23,42,0.12)",
                            background: active ? "rgba(37,99,235,0.08)" : "#fff",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {draft.fieldValues.buildings.map((building, index) => (
                  <BuildingEditor
                    key={building.id}
                    building={building}
                    index={index}
                    fieldMeta={{
                      buildingType: draft.fieldMeta[`fieldValues.buildings[${index}].buildingType`] || draft.fieldMeta["fieldValues.buildings[0].buildingType"],
                      residentialUnitsRented:
                        draft.fieldMeta[`fieldValues.buildings[${index}].residentialUnitsRented`] ||
                        draft.fieldMeta["fieldValues.buildings[0].residentialUnitsRented"],
                    }}
                    onChange={(nextBuilding) =>
                      {
                        updateDraft((current) => {
                          if (!current) return current;
                          const buildings = [...current.fieldValues.buildings];
                          buildings[index] = nextBuilding;
                          return {
                            ...current,
                            fieldValues: {
                              ...current.fieldValues,
                              buildings,
                            },
                          };
                        });
                        markProvidedByUser(`fieldValues.buildings[${index}].buildingType`);
                        markProvidedByUser(`fieldValues.buildings[${index}].residentialUnitsRented`);
                      }
                    }
                    onRemove={
                      draft.fieldValues.buildings.length > 1
                        ? () =>
                            updateDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    fieldValues: {
                                      ...current.fieldValues,
                                      buildings: current.fieldValues.buildings.filter((_, buildingIndex) => buildingIndex !== index),
                                    },
                                  }
                                : current
                            )
                        : undefined
                    }
                  />
                ))}
                {draft.fieldValues.buildings.length < 5 ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      updateDraft((current) => {
                        if (!current) return current;
                        return {
                          ...current,
                          fieldValues: {
                            ...current.fieldValues,
                            buildings: [
                              ...current.fieldValues.buildings,
                              {
                                ...current.fieldValues.buildings[0],
                                id: `building-${current.fieldValues.buildings.length + 1}`,
                                primaryAddress: { ...current.fieldValues.siteAddress },
                                rentalUnitTypes: [],
                                buildingType: null,
                                otherBuildingType: null,
                                residentialUnitsRented: null,
                                shortTermRentalUnits: null,
                                totalResidentialUnits: null,
                                hasCommercialUnits: null,
                                amenities: [],
                                fireLifeSafetySystems: [],
                                accessibilityFeatures: [],
                                yearConstructed: null,
                                notes: null,
                              },
                            ],
                          },
                        };
                      })
                    }
                  >
                    Add building
                  </Button>
                ) : null}
              </div>
            ) : null}

            {step === 3 ? (
              <div style={{ display: "grid", gap: 14 }}>
                <Card style={{ display: "grid", gap: 8, background: "rgba(37,99,235,0.04)" }}>
                  <div style={{ fontWeight: 700 }}>Compliance details</div>
                  <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.5 }}>
                    These fields are usually not already in RentChain. Add them here so the export is submission-ready and easier to review before municipal filing.
                  </div>
                </Card>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>Property notes / description</span>
                  <textarea
                    value={draft.fieldValues.propertyDescription || ""}
                    onChange={(event) =>
                      updateDraft((current) => ({
                        ...current,
                        fieldValues: { ...current.fieldValues, propertyDescription: event.target.value },
                      }))
                    }
                    rows={4}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #dbe4f0" }}
                  />
                </label>
                {draft.fieldValues.buildings.map((building, index) => (
                  <BuildingEditor
                    key={`${building.id}-compliance`}
                    building={building}
                    index={index}
                    showComplianceOnly
                    fieldMeta={{
                      yearConstructed:
                        draft.fieldMeta[`fieldValues.buildings[${index}].yearConstructed`] ||
                        draft.fieldMeta["fieldValues.buildings[0].yearConstructed"],
                      fireLifeSafetySystems:
                        draft.fieldMeta[`fieldValues.buildings[${index}].fireLifeSafetySystems`] ||
                        draft.fieldMeta["fieldValues.buildings[0].fireLifeSafetySystems"],
                    }}
                    onChange={(nextBuilding) =>
                      {
                        updateDraft((current) => {
                          if (!current) return current;
                          const buildings = [...current.fieldValues.buildings];
                          buildings[index] = nextBuilding;
                          return {
                            ...current,
                            fieldValues: {
                              ...current.fieldValues,
                              buildings,
                            },
                          };
                        });
                        markProvidedByUser(`fieldValues.buildings[${index}].yearConstructed`);
                        markProvidedByUser(`fieldValues.buildings[${index}].fireLifeSafetySystems`);
                      }
                    }
                  />
                ))}
              </div>
            ) : null}

            {step === 4 ? (
              <div style={{ display: "grid", gap: 14 }}>
                <Card style={{ display: "grid", gap: 8, background: "rgba(15,23,42,0.03)" }}>
                  <div style={{ fontWeight: 700 }}>Declarations</div>
                  <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.5 }}>
                    This assistant prepares a Halifax submission-ready export. It does not file directly with Halifax in this v1 flow.
                  </div>
                </Card>
                {[
                  {
                    key: "acknowledged" as const,
                    label: "I understand this draft is prepared by RentChain for review and export and is not automatically submitted to Halifax.",
                  },
                  {
                    key: "maintenancePlanConfirmed" as const,
                    label: "I confirm a maintenance / property management plan exists or will be maintained as required.",
                  },
                  {
                    key: "ownerDeclarationConfirmed" as const,
                    label: "I am authorized to make owner or operator declarations for this property, and I understand that municipal registration requirements remain my responsibility.",
                  },
                  {
                    key: "informationAccurateConfirmed" as const,
                    label: "I confirm the information in this draft is accurate to the best of my knowledge.",
                  },
                ].map((item) => (
                  <label
                    key={item.key}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "start",
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: "1px solid #dbe4f0",
                      background: "#fff",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={draft.declarations[item.key]}
                      onChange={(event) => {
                        updateDraft((current) => ({
                          ...current,
                          declarations: {
                            ...current.declarations,
                            [item.key]: event.target.checked,
                          } as HalifaxSubmissionDeclarations,
                        }));
                        markProvidedByUser("declarations.acknowledged");
                      }}
                    />
                    <span style={{ lineHeight: 1.5 }}>{item.label}</span>
                  </label>
                ))}
              </div>
            ) : null}

            {step === 5 ? (
              <div style={{ display: "grid", gap: 14 }}>
                <Card style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>Validation summary</div>
                      <div style={{ color: "#475569", fontSize: 14 }}>
                        Readiness score: {draft.validation.readinessScore} / 100
                      </div>
                    </div>
                    <Pill tone={draft.validation.exportReady ? "accent" : "muted"}>
                      {draft.validation.exportReady ? "Ready to export" : "Draft not ready yet"}
                    </Pill>
                  </div>
                  {draft.validation.missingConsentItems.length ? (
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontWeight: 700, color: "#92400e" }}>Consent / declaration requirements</div>
                      {draft.validation.missingConsentItems.map((item) => (
                        <div key={item.path} style={{ color: "#78350f", fontSize: 14 }}>
                          • {item.section}: {item.label}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {draft.validation.missingRequiredFields.length ? (
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontWeight: 700, color: "#92400e" }}>Missing required Halifax fields</div>
                      {draft.validation.missingRequiredFields.map((item) => (
                        <div key={item.path} style={{ color: "#78350f", fontSize: 14 }}>
                          • {item.section}: {item.label}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: "#166534", fontSize: 14 }}>
                      Required fields, consent, and declarations are complete. You can export a structured Halifax draft payload now.
                    </div>
                  )}
                  {draft.validation.warnings.length ? (
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontWeight: 700, color: "#334155" }}>Warnings / review items</div>
                      {draft.validation.warnings.map((warning, index) => (
                        <div key={`${warning}-${index}`} style={{ color: "#475569", fontSize: 14 }}>
                          • {warning}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </Card>
                <Card style={{ display: "grid", gap: 8, background: "rgba(15,23,42,0.03)" }}>
                  <div style={{ fontWeight: 700 }}>Export contents</div>
                  <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.5 }}>
                    The JSON export includes Halifax-grouped property, owner, contact, building, declaration, validation, consent, and draft-preparation metadata. It is suitable for guided submission today and future municipal integrations later.
                  </div>
                </Card>
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button type="button" variant="secondary" onClick={onClose} disabled={saving || exporting}>
                  Close
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (!draft) return;
                    void persistDraft(draft, "Halifax draft saved");
                  }}
                  disabled={saving || exporting}
                >
                  {saving ? "Saving..." : "Save draft"}
                </Button>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setStep((current) => Math.max(0, current - 1))}
                  disabled={step === 0 || saving || exporting}
                >
                  Back
                </Button>
                {step < STEP_TITLES.length - 1 ? (
                  <Button
                    type="button"
                    onClick={() => setStep((current) => Math.min(STEP_TITLES.length - 1, current + 1))}
                    disabled={saving || exporting || (step === 0 && !canMovePastConsent)}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => {
                      if (!propertyId || !draft) return;
                      void (async () => {
                        await persistDraft(draft);
                        setExporting(true);
                        try {
                          const result = await exportHalifaxRegistrySubmission(propertyId);
                          downloadJson(
                            `halifax-registry-submission-${propertyId}.json`,
                            result.exportPayload
                          );
                          setDraft(cloneDraft(result.submission));
                          showToast({
                            message: "Halifax export ready",
                            description:
                              result.submission.validation.missingRequiredFields.length === 0
                                ? "Submission-ready JSON export downloaded."
                                : "Draft export downloaded with validation warnings for follow-up.",
                          });
                        } catch (err: any) {
                          setError(err?.message || "Failed to export Halifax submission payload.");
                          showToast({
                            message: "Export failed",
                            description: err?.message || "Failed to export Halifax submission payload.",
                            variant: "error",
                          });
                        } finally {
                          setExporting(false);
                        }
                      })();
                    }}
                    disabled={saving || exporting || !canExport}
                  >
                    {exporting ? "Exporting..." : "Export JSON"}
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
