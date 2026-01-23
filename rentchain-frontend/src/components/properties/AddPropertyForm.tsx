import React, { useState } from "react";
import {
  createProperty,
  Property,
  PropertyInput,
  UnitInput,
} from "../../api/propertiesApi";
import { colors, radius, text } from "../../styles/tokens";
import { setOnboardingStep } from "../../api/onboardingApi";
import { useToast } from "@/components/ui/ToastProvider";

interface AddPropertyFormProps {
  onCreated?: (property: Property) => void;
  onExistingPropertyId?: (id: string) => void;
}

interface UnitRow extends UnitInput {
  id: string;
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
  const [name, setName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("Canada");
  const [totalUnits, setTotalUnits] = useState<number | "">("");
  const [amenitiesText, setAmenitiesText] = useState("");
  const [units, setUnits] = useState<UnitRow[]>([emptyUnitRow()]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
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

  const handleUnitChange = (
    id: string,
    field: keyof UnitRow,
    value: string
  ) => {
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
    setUnits((prev) => [...prev, emptyUnitRow()]);
  };

  const handleRemoveUnitRow = (id: string) => {
    setUnits((prev) => (prev.length <= 1 ? prev : prev.filter((u) => u.id !== id)));
  };

  const parseUnitsCsv = (text: string): UnitRow[] => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return [];

    const [headerLine, ...dataLines] = lines;
    const headers = headerLine.split(",").map((h) => h.trim().toLowerCase());

    const idxUnit = headers.indexOf("unitnumber");
    const idxRent = headers.indexOf("rent");
    const idxBeds = headers.indexOf("bedrooms");
    const idxBaths = headers.indexOf("bathrooms");
    const idxSqft = headers.indexOf("sqft");

    const rows: UnitRow[] = [];

    for (const line of dataLines) {
      const cols = line.split(",").map((c) => c.trim());
      if (cols.length === 0) continue;

      const unitNumber = idxUnit >= 0 ? cols[idxUnit] : cols[0] ?? "";

      const rentRaw = idxRent >= 0 ? cols[idxRent] : "";
      const rent = rentRaw ? Number(rentRaw) : NaN;

      if (!unitNumber || Number.isNaN(rent)) {
        continue;
      }

      const bedrooms =
        idxBeds >= 0 && cols[idxBeds] ? Number(cols[idxBeds]) : null;
      const bathrooms =
        idxBaths >= 0 && cols[idxBaths] ? Number(cols[idxBaths]) : null;
      const sqft = idxSqft >= 0 && cols[idxSqft] ? Number(cols[idxSqft]) : null;

      rows.push({
        id: makeId(),
        unitNumber,
        rent,
        bedrooms,
        bathrooms,
        sqft,
        utilitiesIncluded: [],
      });
    }

    return rows;
  };

  const handleCsvUpload: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const parsed = parseUnitsCsv(text);
        if (parsed.length === 0) {
          setErrorText(
            "CSV parsed but no valid rows were found. Make sure headers include at least unitNumber and rent."
          );
          return;
        }
        setUnits(parsed);
        setTotalUnits(parsed.length);
        setErrorText(null);
        setSuccessText(
          `Loaded ${parsed.length} units from CSV. You can still edit them below before saving.`
        );
      } catch (err) {
        console.error("Error parsing CSV", err);
        setErrorText("Failed to parse CSV file");
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

    const payload: PropertyInput = {
      name: name.trim() || undefined,
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim() || undefined,
      city: city.trim(),
      province: province.trim() || undefined,
      postalCode: postalCode.trim() || undefined,
      country: country.trim() || undefined,
      totalUnits: totalUnitCount,
      amenities,
      units: validUnits.length > 0 ? validUnits : undefined,
    };

    setIsSubmitting(true);
    try {
      const { property } = await createProperty(payload);
      setSuccessText("Property created and units captured successfully.");
      if (onCreated) {
        onCreated(property);
      }
      try {
        await setOnboardingStep("addProperty", true);
      } catch {
        // ignore onboarding errors
      }

      setName("");
      setAddressLine1("");
      setAddressLine2("");
      setCity("");
      setProvince("");
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
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
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
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #374151" }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4 }}>
            City *
          </label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #374151" }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4 }}>
            Province / State
          </label>
          <input
            type="text"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #374151" }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4 }}>
            Postal / ZIP
          </label>
          <input
            type="text"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
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
            required
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #374151" }}
          />
        </div>
        <div style={{ gridColumn: "1 / span 2" }}>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4 }}>
            Address Line 2
          </label>
          <input
            type="text"
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #374151" }}
          />
        </div>
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
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
            Units &amp; Rents
          </div>
          <div style={{ fontSize: "0.78rem", color: text.subtle }}>
            Optional: skip to auto-create numbered units from your total count.
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
            <span style={{ color: text.subtle }}>
              Expected headers: unitNumber, rent, bedrooms, bathrooms, sqft
            </span>
          </div>
        </div>

        <div
          style={{
            overflowX: "auto",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: 8,
            }}
          >
            <thead>
              <tr style={{ fontSize: "0.78rem", textAlign: "left", color: text.subtle }}>
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
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(15,23,42,0.06)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                      style={{
                        fontSize: "0.75rem",
                        padding: "4px 8px",
                        borderRadius: 999,
                        border: "1px solid #6b7280",
                        background: "transparent",
                        color: text.primary,
                        cursor: "pointer",
                        transition: "background 150ms ease",
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
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(15,23,42,0.06)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
          style={{
            marginTop: 8,
            fontSize: "0.8rem",
            padding: "6px 12px",
            borderRadius: 999,
            border: "1px dashed #4b5563",
            background: "transparent",
            color: text.primary,
            cursor: "pointer",
            alignSelf: "flex-start",
            transition: "background 150ms ease",
          }}
        >
          + Add unit row
        </button>
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
        disabled={isSubmitting}
        style={{
          alignSelf: "flex-start",
          padding: "8px 20px",
          borderRadius: 999,
          border: "1px solid #2563eb",
          background: "radial-gradient(circle at top left, #3b82f6, #1d4ed8)",
          color: "#f9fafb",
          fontSize: "0.85rem",
          fontWeight: 500,
          cursor: isSubmitting ? "default" : "pointer",
          opacity: isSubmitting ? 0.7 : 1,
        }}
      >
        {isSubmitting ? "Saving..." : "Add property"}
      </button>
    </form>
      )}
    </div>
  );
};
