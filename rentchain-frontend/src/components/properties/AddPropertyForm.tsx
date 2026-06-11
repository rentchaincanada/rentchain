import React, { useState } from "react";
import {
  createProperty,
  Property,
  PropertyInput,
  UnitInput,
} from "../../api/propertiesApi";
import { colors, radius, text } from "../../styles/tokens";
import { setOnboardingStep } from "../../api/onboardingApi";
import {
  previewUnitsCsv,
  type UnitCsvPreviewResponse,
  type UnitCsvPreviewRow,
} from "../../api/unitsImportApi";
import { useToast } from "@/components/ui/ToastProvider";
import { PROVINCE_OPTIONS } from "@/lib/provinces";
import { track } from "../../lib/analytics";
import { useAuth } from "../../context/useAuth";
import "../../styles/propertiesMobile.css";

interface AddPropertyFormProps {
  onCreated?: (property: Property) => void;
  onExistingPropertyId?: (id: string) => void;
}

interface UnitRow extends UnitInput {
  id: string;
  status?: "vacant" | "occupied" | null;
}

const makeId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const emptyUnitRow = (): UnitRow => ({
  id: makeId(),
  unitNumber: "",
  rent: 0,
  bedrooms: null,
  bathrooms: null,
  sqft: null,
  utilitiesIncluded: [],
});

export const AddPropertyForm: React.FC<AddPropertyFormProps> = ({
  onCreated,
  onExistingPropertyId,
}) => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [pid, setPid] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("UNSET");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("Canada");
  const [totalUnits, setTotalUnits] = useState<number | "">("");
  const [amenitiesText, setAmenitiesText] = useState("");
  const [units, setUnits] = useState<UnitRow[]>([emptyUnitRow()]);
  const [csvPreview, setCsvPreview] = useState<UnitCsvPreviewResponse | null>(null);
  const [csvFilename, setCsvFilename] = useState("");
  const [isPreviewingCsv, setIsPreviewingCsv] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [complianceExpanded, setComplianceExpanded] = useState(false);
  const [unitsExpanded, setUnitsExpanded] = useState(false);
  const { showToast } = useToast();
  const inputStyle: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: radius.md,
    border: `1px solid ${colors.border}`,
    background: colors.card,
    color: text.primary,
  };

  const amenities = amenitiesText
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const clearCsvPreviewState = () => {
    setCsvPreview(null);
    setCsvFilename("");
  };

  const handleUnitChange = (
    id: string,
    field: keyof UnitRow,
    value: string
  ) => {
    clearCsvPreviewState();
    setUnits((prev) =>
      prev.map((u) => {
        if (u.id !== id) return u;
        if (
          field === "rent" ||
          field === "bedrooms" ||
          field === "bathrooms" ||
          field === "sqft"
        ) {
          const num = value === "" ? null : Number(value);
          return { ...u, [field]: num };
        }
        return { ...u, [field]: value };
      })
    );
  };

  const handleAddUnitRow = () => {
    clearCsvPreviewState();
    setUnits((prev) => [...prev, emptyUnitRow()]);
  };

  const handleRemoveUnitRow = (id: string) => {
    clearCsvPreviewState();
    setUnits((prev) => (prev.length <= 1 ? prev : prev.filter((u) => u.id !== id)));
  };
  const handleCsvUpload: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = String(reader.result ?? "");
        if (!text.trim()) {
          setErrorText(
            "CSV file appears empty or unreadable."
          );
          return;
        }
        setIsPreviewingCsv(true);
        const preview = await previewUnitsCsv(text);
        setCsvPreview(preview);
        setCsvFilename(file.name);
        const rows = preview.preview?.rows || preview.rows || [];
        const errors = preview.preview?.errors || preview.issues || [];
        const validRows = rows.filter((row) => row.status === "valid");

        if (errors.length > 0 || preview.headers?.valid === false) {
          setErrorText("CSV preview found issues. Fix the CSV and upload it again before creating the property.");
          setSuccessText(null);
          return;
        }

        if (validRows.length === 0) {
          setErrorText("CSV preview found no valid unit rows.");
          setSuccessText(null);
          return;
        }

        const parsed = validRows.map((row: UnitCsvPreviewRow) => ({
          id: makeId(),
          unitNumber: String(row.data.unitNumber || row.unitNumber || "").trim(),
          rent: typeof row.data.rent === "number" ? row.data.rent : 0,
          bedrooms: row.data.bedrooms ?? null,
          bathrooms: row.data.bathrooms ?? null,
          sqft: row.data.sqft ?? null,
          status: row.data.status ?? null,
          utilitiesIncluded: [],
        }));
        setUnits(parsed);
        setTotalUnits(parsed.length);
        setErrorText(null);
        setSuccessText(`Previewed ${parsed.length} units from CSV. Review the rows below before creating the property.`);
      } catch (err) {
        console.error("Error previewing CSV", err);
        setErrorText("Failed to preview CSV file");
      } finally {
        setIsPreviewingCsv(false);
      }
    };
    reader.onerror = () => {
      setErrorText("Failed to read CSV file");
    };
    reader.readAsText(file);
  };

  const handleSubmit: React.FormEventHandler = async (e) => {
    e.preventDefault();
    setErrorText(null);
    setSuccessText(null);

    if (!addressLine1.trim() || !city.trim()) {
      setErrorText("Address and City are required.");
      return;
    }

    const validUnits: UnitInput[] = units
      .filter(
        (u) =>
          u.unitNumber.trim() &&
          typeof u.rent === "number" &&
          !Number.isNaN(u.rent)
      )
      .map((u) => ({
        unitNumber: u.unitNumber.trim(),
        rent: Number(u.rent),
        bedrooms: u.bedrooms ?? null,
        bathrooms: u.bathrooms ?? null,
        sqft: u.sqft ?? null,
        status: u.status ?? null,
        utilitiesIncluded: u.utilitiesIncluded ?? [],
      }));

    const totalUnitCount =
      typeof totalUnits === "number" && totalUnits > 0
        ? totalUnits
        : validUnits.length;

    if (!totalUnitCount || Number.isNaN(totalUnitCount)) {
      setErrorText("Total units is required (we auto-create units).");
      return;
    }

    const csvErrors = csvPreview?.preview?.errors || csvPreview?.issues || [];
    if (csvErrors.length > 0 || csvPreview?.headers?.valid === false) {
      setErrorText("Resolve CSV preview issues before creating the property.");
      return;
    }

    const payload: PropertyInput = {
      name: name.trim() || undefined,
      pid: pid.trim() || undefined,
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim() || undefined,
      city: city.trim(),
      province: province.trim() || "UNSET",
      postalCode: postalCode.trim() || undefined,
      country: country.trim() || undefined,
      totalUnits: totalUnitCount,
      amenities,
      units: validUnits.length > 0 ? validUnits : undefined,
    };

    setIsSubmitting(true);
    try {
      if (import.meta.env.DEV) {
        console.debug("create property payload", {
          addressLine1: payload.addressLine1,
          address: (payload as any).address,
          unitsLength: payload.units?.length ?? 0,
        });
      }
      const { property } = await createProperty(payload);
      track("activation_property_created", {
        surface: "properties_page",
        source: "add_property_form",
        plan: user?.plan || "free",
        route: typeof window !== "undefined" ? window.location.pathname : undefined,
      });
      setSuccessText("Your first property is set up. Add a unit or invite a tenant next when you are ready.");
      if (onCreated) {
        onCreated(property);
      }
      try {
        await setOnboardingStep("propertyAdded", true);
      } catch {
        // ignore onboarding errors
      }

      setName("");
      setPid("");
      setAddressLine1("");
      setAddressLine2("");
      setCity("");
      setProvince("UNSET");
      setPostalCode("");
      setCountry("Canada");
      setTotalUnits("");
      setAmenitiesText("");
      setUnits([emptyUnitRow()]);
    } catch (err: any) {
      const status = err?.response?.status;
      const code = err?.response?.data?.code;
      const existingId =
        err?.response?.data?.existingId ||
        err?.response?.data?.existingID ||
        err?.response?.data?.propertyId ||
        null;

      if (status === 409 || code === "PROPERTY_EXISTS") {
        if (existingId) {
          setSuccessText(null);
          setErrorText(
            "That address already exists. We selected the existing property below."
          );
          onExistingPropertyId?.(String(existingId));
          return;
        }
        setErrorText("A property with this address already exists.");
        return;
      }

      const msg = err?.message || "Failed to create property.";
      setErrorText(msg);
      showToast({
        message: "Failed to create property",
        description: msg,
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const csvPreviewIssues = csvPreview?.preview?.errors || csvPreview?.issues || [];
  const isCreateDisabled = isSubmitting || isPreviewingCsv || csvPreviewIssues.length > 0 || csvPreview?.headers?.valid === false;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        style={{
          alignSelf: "flex-start",
          padding: "6px 12px",
          borderRadius: radius.pill,
          border: `1px solid ${colors.border}`,
          background: colors.card,
          color: text.primary,
          cursor: "pointer",
        }}
      >
        {expanded ? "Hide form" : "Show form"}
      </button>

      {!expanded ? null : (
        <form
          className="rc-add-property-form"
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              borderRadius: 12,
              border: "1px solid #dbe4f0",
              background: "#f8fbff",
              padding: 12,
              display: "grid",
              gap: 6,
            }}
          >
            <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#0f172a" }}>
              Only three details are required to get started
            </div>
            <div style={{ fontSize: "0.84rem", color: "#475569", lineHeight: 1.5 }}>
              Enter the street address, city, and total units. You can add amenities, unit details,
              and compliance information after your first property is set up.
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1.2fr)",
              columnGap: 20,
              rowGap: 16,
            }}
          >
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4 }}>
            Property Name (optional)
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Maple Street Apartments"
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #374151" }}
          />
          <div style={{ marginTop: 4, fontSize: "0.76rem", color: "#6b7280" }}>
            Use a simple name you will recognize later. You can leave this blank for now.
          </div>
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4 }}>
            City *
          </label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Halifax"
            required
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #374151" }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4 }}>
            Province
          </label>
          <select
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #374151" }}
          >
            {PROVINCE_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4 }}>
            Postal / ZIP
          </label>
          <input
            type="text"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            placeholder="B3J 2K9"
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #374151" }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4 }}>
            Country
          </label>
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #374151" }}
          />
        </div>
        <div style={{ gridColumn: "1 / span 2" }}>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4 }}>
            Address Line 1 *
          </label>
          <input
            type="text"
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            placeholder="123 Main Street"
            required
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #374151" }}
          />
          <div style={{ marginTop: 4, fontSize: "0.76rem", color: "#6b7280" }}>
            Start with the main street address for the property.
          </div>
        </div>
        <div style={{ gridColumn: "1 / span 2" }}>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4 }}>
            Address Line 2
          </label>
          <input
            type="text"
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
            placeholder="Suite, building, or other optional detail"
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #374151" }}
          />
        </div>
      </div>

      <div
        style={{
          borderRadius: 12,
          border: "1px solid #dbe4f0",
          background: "#f8fbff",
          padding: 12,
          display: "grid",
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={() => setComplianceExpanded((current) => !current)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            width: "100%",
            border: "none",
            background: "transparent",
            padding: 0,
            cursor: "pointer",
            color: "#0f172a",
          }}
        >
          <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>Compliance &amp; Registry (Optional)</span>
          <span style={{ fontSize: "0.8rem", color: "#475569" }}>
            {complianceExpanded ? "Hide" : "Add details"}
          </span>
        </button>
        {complianceExpanded ? (
          <div style={{ display: "grid", gap: 8 }}>
            <label style={{ display: "grid", gap: 6, fontSize: "0.85rem", color: "#111827" }}>
              Property Identifier (PID)
              <input
                type="text"
                value={pid}
                onChange={(e) => setPid(e.target.value)}
                placeholder="Optional PID"
                style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #374151" }}
              />
            </label>
            <div style={{ fontSize: "0.8rem", color: "#475569", lineHeight: 1.5 }}>
              Used for municipal registry matching and property verification in supported jurisdictions.
              Adding a PID can improve automatic matching and reduce manual review.
            </div>
          </div>
        ) : null}
      </div>

      <div>
        <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4 }}>
          Total Units (required — we auto-create units)
        </label>
        <input
          type="number"
          min={1}
          value={totalUnits === "" ? "" : totalUnits}
          onChange={(e) =>
            setTotalUnits(e.target.value === "" ? "" : Number(e.target.value))
          }
          style={{ width: "160px", padding: 8, borderRadius: 8, border: "1px solid #374151" }}
        />
        <div style={{ marginTop: 4, fontSize: "0.76rem", color: "#6b7280" }}>
          Enter the number of rentable units. RentChain will create simple numbered units for you.
        </div>
      </div>

      <div>
        <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4 }}>
          Building Amenities (comma separated)
        </label>
        <input
          type="text"
          value={amenitiesText}
          onChange={(e) => setAmenitiesText(e.target.value)}
          placeholder="Parking, On-site laundry, Gym"
          style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #374151" }}
        />
      </div>

      <div
        style={{
          borderRadius: 12,
          border: "1px dashed #4b5563",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={() => setUnitsExpanded((current) => !current)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            width: "100%",
            border: "none",
            background: "transparent",
            padding: 0,
            cursor: "pointer",
            color: "#0f172a",
          }}
        >
          <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>Units &amp; Rents (Optional)</span>
          <span style={{ fontSize: "0.8rem", color: "#475569" }}>
            {unitsExpanded ? "Hide details" : "Add details now"}
          </span>
        </button>
        <div style={{ fontSize: "0.8rem", color: "#6b7280", lineHeight: 1.5 }}>
          Skip this for now if you just want to get your first property live. RentChain will create
          simple numbered units from your total count.
        </div>
        {unitsExpanded ? (
          <>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div style={{ fontSize: "0.78rem", color: "#9ca3af" }}>
                Add unit numbers and rents now if you already have them.
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "0.78rem",
                }}
              >
                <label
                  style={{
                    padding: "4px 8px",
                    borderRadius: 999,
                    border: "1px solid #4b5563",
                    cursor: "pointer",
                  }}
                >
                  Import units from CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleCsvUpload}
                    style={{ display: "none" }}
                  />
                </label>
                <a className="rc-add-property-csv-link" href="/site/legal#templates">
                  CSV template
                </a>
                <span style={{ color: "#9ca3af" }}>
                  Expected headers: unitNumber, marketRent, beds, baths, sqft, status
                </span>
              </div>
            </div>

            {isPreviewingCsv ? (
              <div style={{ fontSize: "0.82rem", color: "#475569" }}>Previewing CSV...</div>
            ) : null}

            {csvPreview ? (
              <div
                style={{
                  border: "1px solid #dbe4f0",
                  borderRadius: 10,
                  background: "#ffffff",
                  padding: 10,
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.86rem", color: "#0f172a" }}>
                    CSV preview{csvFilename ? `: ${csvFilename}` : ""}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#475569" }}>
                    {(csvPreview.preview?.rows || csvPreview.rows || []).filter((row) => row.status === "valid").length} ready
                    {" | "}
                    {(csvPreview.preview?.errors || csvPreview.issues || []).length} issue(s)
                  </div>
                </div>
                {(csvPreview.headers?.missing?.length || csvPreview.headers?.unknown?.length) ? (
                  <div style={{ color: "#b91c1c", fontSize: "0.8rem", lineHeight: 1.45 }}>
                    {csvPreview.headers.missing.length ? `Missing: ${csvPreview.headers.missing.join(", ")}. ` : ""}
                    {csvPreview.headers.unknown.length ? `Unknown: ${csvPreview.headers.unknown.join(", ")}.` : ""}
                  </div>
                ) : null}
                {(csvPreview.preview?.errors || csvPreview.issues || []).length ? (
                  <div style={{ display: "grid", gap: 4 }}>
                    {(csvPreview.preview?.errors || csvPreview.issues || []).slice(0, 5).map((issue, idx) => (
                      <div key={`${issue.row}-${issue.code}-${idx}`} style={{ color: "#b91c1c", fontSize: "0.8rem" }}>
                        {issue.message}
                      </div>
                    ))}
                  </div>
                ) : null}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                    <thead>
                      <tr style={{ textAlign: "left", color: "#475569" }}>
                        <th style={{ padding: "6px" }}>Row</th>
                        <th style={{ padding: "6px" }}>Status</th>
                        <th style={{ padding: "6px" }}>Unit</th>
                        <th style={{ padding: "6px" }}>Rent</th>
                        <th style={{ padding: "6px" }}>Beds</th>
                        <th style={{ padding: "6px" }}>Baths</th>
                        <th style={{ padding: "6px" }}>Sqft</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(csvPreview.preview?.rows || csvPreview.rows || []).slice(0, 12).map((row) => (
                        <tr key={row.row} style={{ borderTop: "1px solid #e5e7eb" }}>
                          <td style={{ padding: "6px" }}>{row.row}</td>
                          <td style={{ padding: "6px", color: row.status === "valid" ? "#166534" : "#b91c1c" }}>
                            {row.status}
                          </td>
                          <td style={{ padding: "6px" }}>{row.data.unitNumber || row.unitNumber || ""}</td>
                          <td style={{ padding: "6px" }}>{row.data.rent ?? ""}</td>
                          <td style={{ padding: "6px" }}>{row.data.bedrooms ?? ""}</td>
                          <td style={{ padding: "6px" }}>{row.data.bathrooms ?? ""}</td>
                          <td style={{ padding: "6px" }}>{row.data.sqft ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div
              style={{
                overflowX: "auto",
              }}
            >
              <table
                className="rc-add-property-units-table"
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  marginTop: 8,
                }}
              >
                <thead>
                  <tr style={{ fontSize: "0.78rem", textAlign: "left", color: "#9ca3af" }}>
                    <th style={{ padding: "4px 6px" }}>Unit #</th>
                    <th style={{ padding: "4px 6px" }}>Rent *</th>
                    <th style={{ padding: "4px 6px" }}>Beds</th>
                    <th style={{ padding: "4px 6px" }}>Baths</th>
                    <th style={{ padding: "4px 6px" }}>Sqft</th>
                    <th style={{ padding: "4px 6px" }} />
                  </tr>
                </thead>
                <tbody>
                  {units.map((u) => (
                    <tr key={u.id}>
                      <td style={{ padding: "4px 6px" }}>
                        <input
                          type="text"
                          value={u.unitNumber}
                          onChange={(e) =>
                            handleUnitChange(u.id, "unitNumber", e.target.value)
                          }
                          placeholder="101"
                          style={{
                            width: "100%",
                            padding: 6,
                            borderRadius: 6,
                            border: "1px solid #374151",
                            fontSize: "0.8rem",
                          }}
                        />
                      </td>
                      <td style={{ padding: "4px 6px" }}>
                        <input
                          type="number"
                          min={0}
                          value={u.rent ?? ""}
                          onChange={(e) =>
                            handleUnitChange(u.id, "rent", e.target.value)
                          }
                          onFocus={() => {
                            if (
                              typeof window !== "undefined" &&
                              window.matchMedia("(max-width: 768px)").matches &&
                              String(u.rent ?? "") === "0"
                            ) {
                              handleUnitChange(u.id, "rent", "");
                            }
                          }}
                          placeholder="1800"
                          style={{
                            width: "100%",
                            padding: 6,
                            borderRadius: 6,
                            border: "1px solid #374151",
                            fontSize: "0.8rem",
                          }}
                        />
                      </td>
                      <td style={{ padding: "4px 6px" }}>
                        <input
                          type="number"
                          min={0}
                          value={u.bedrooms ?? ""}
                          onChange={(e) =>
                            handleUnitChange(u.id, "bedrooms", e.target.value)
                          }
                          placeholder="2"
                          style={{
                            width: "100%",
                            padding: 6,
                            borderRadius: 6,
                            border: "1px solid #374151",
                            fontSize: "0.8rem",
                          }}
                        />
                      </td>
                      <td style={{ padding: "4px 6px" }}>
                        <input
                          type="number"
                          min={0}
                          value={u.bathrooms ?? ""}
                          onChange={(e) =>
                            handleUnitChange(u.id, "bathrooms", e.target.value)
                          }
                          placeholder="1"
                          style={{
                            width: "100%",
                            padding: 6,
                            borderRadius: 6,
                            border: "1px solid #374151",
                            fontSize: "0.8rem",
                          }}
                        />
                      </td>
                      <td style={{ padding: "4px 6px" }}>
                        <input
                          type="number"
                          min={0}
                          value={u.sqft ?? ""}
                          onChange={(e) => handleUnitChange(u.id, "sqft", e.target.value)}
                          placeholder="750"
                          style={{
                            width: "100%",
                            padding: 6,
                            borderRadius: 6,
                            border: "1px solid #374151",
                            fontSize: "0.8rem",
                          }}
                        />
                      </td>
                      <td style={{ padding: "4px 6px", textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveUnitRow(u.id)}
                          className="rc-remove-unit-row"
                          style={{
                            fontSize: "0.75rem",
                            padding: "4px 8px",
                            borderRadius: 999,
                            border: "1px solid #cbd5e1",
                            background: "rgba(248,250,252,0.92)",
                            color: "#1f2937",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={handleAddUnitRow}
              className="rc-add-unit-row"
              style={{
                marginTop: 8,
                fontSize: "0.8rem",
                padding: "6px 12px",
                borderRadius: 999,
                border: "1px dashed #2563eb",
                background: "rgba(219,234,254,0.7)",
                color: "#1d4ed8",
                cursor: "pointer",
                alignSelf: "flex-start",
                fontWeight: 700,
              }}
            >
              + Add unit row
            </button>
          </>
        ) : null}
      </div>

      {errorText && (
        <div style={{ fontSize: "0.8rem", color: "#fca5a5" }}>{errorText}</div>
      )}
      {successText && (
        <div style={{ fontSize: "0.8rem", color: "#2563eb", fontWeight: 600 }}>
          {successText}
        </div>
      )}

      <button
        type="submit"
        disabled={isCreateDisabled}
        style={{
          alignSelf: "flex-start",
          padding: "8px 20px",
          borderRadius: 999,
          border: "1px solid #2563eb",
          background: "radial-gradient(circle at top left, #3b82f6, #1d4ed8)",
          color: "#f9fafb",
          fontSize: "0.85rem",
          fontWeight: 500,
          cursor: isCreateDisabled ? "default" : "pointer",
          opacity: isCreateDisabled ? 0.7 : 1,
        }}
      >
        {isSubmitting ? "Saving..." : isPreviewingCsv ? "Previewing CSV..." : "Create property"}
      </button>
    </form>
      )}
    </div>
  );
};
