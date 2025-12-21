import React, { useState } from "react";

export type NewUnitDraft = {
  label: string;
  type: string;
  sizeSqft?: number | null;
  utilitiesIncluded?: string;
};

export type NewPropertyDraft = {
  name: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  region: string;
  postalCode: string;
  totalUnits: number;
  amenities: string;
  notes?: string;
  units: NewUnitDraft[];
};

interface AddPropertyModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: (draft: NewPropertyDraft) => void;
}

export const AddPropertyModal: React.FC<AddPropertyModalProps> = ({
  open,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [totalUnits, setTotalUnits] = useState<number | "">("");
  const [amenities, setAmenities] = useState("");
  const [notes, setNotes] = useState("");
  const [unitsText, setUnitsText] = useState(
    "101, 1 Bedroom, 550\n102, 1 Bedroom, 550"
  );

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const units: NewUnitDraft[] = [];
    const lines = unitsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length === 0) continue;
      const label = parts[0] || "";
      const type = parts[1] || "";
      const sizeNum = parts[2] ? Number(parts[2]) : NaN;
      units.push({
        label,
        type,
        sizeSqft: Number.isNaN(sizeNum) ? null : sizeNum,
      });
    }

    const draft: NewPropertyDraft = {
      name: name.trim(),
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim() || undefined,
      city: city.trim(),
      region: region.trim(),
      postalCode: postalCode.trim(),
      totalUnits:
        typeof totalUnits === "number"
          ? totalUnits
          : Number(totalUnits) || 0,
      amenities: amenities.trim(),
      notes: notes.trim() || undefined,
      units,
    };

    onSubmit?.(draft);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15,23,42,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: 520,
          maxHeight: "80vh",
          overflowY: "auto",
          borderRadius: 16,
          backgroundColor: "rgba(15,23,42,1)",
          border: "1px solid rgba(55,65,81,1)",
          padding: 16,
          boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 14,
                textTransform: "uppercase",
                letterSpacing: 0.08,
                color: "#9ca3af",
              }}
            >
              New property
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              Capture details needed to power RentChain automations.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              color: "#9ca3af",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginTop: 4,
          }}
        >
          <div>
            <label
              style={{ fontSize: 12, color: "#9ca3af", display: "block" }}
            >
              Property name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Main St. Apartments"
              style={{
                width: "100%",
                borderRadius: 8,
                border: "1px solid rgba(75,85,99,1)",
                padding: "6px 8px",
                backgroundColor: "rgba(15,23,42,1)",
                color: "#e5e7eb",
                fontSize: 13,
                marginTop: 2,
              }}
            />
          </div>

          <div>
            <label
              style={{ fontSize: 12, color: "#9ca3af", display: "block" }}
            >
              Address line 1
            </label>
            <input
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="123 Main St"
              style={{
                width: "100%",
                borderRadius: 8,
                border: "1px solid rgba(75,85,99,1)",
                padding: "6px 8px",
                backgroundColor: "rgba(15,23,42,1)",
                color: "#e5e7eb",
                fontSize: 13,
                marginTop: 2,
              }}
            />
          </div>

          <div>
            <label
              style={{ fontSize: 12, color: "#9ca3af", display: "block" }}
            >
              Address line 2 (optional)
            </label>
            <input
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              placeholder="Suite / Floor"
              style={{
                width: "100%",
                borderRadius: 8,
                border: "1px solid rgba(55,65,81,1)",
                padding: "6px 8px",
                backgroundColor: "rgba(15,23,42,1)",
                color: "#e5e7eb",
                fontSize: 13,
                marginTop: 2,
              }}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.1fr 0.9fr 0.9fr",
              gap: 8,
            }}
          >
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "#9ca3af",
                  display: "block",
                }}
              >
                City
              </label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={{
                  width: "100%",
                  borderRadius: 8,
                  border: "1px solid rgba(75,85,99,1)",
                  padding: "6px 8px",
                  backgroundColor: "rgba(15,23,42,1)",
                  color: "#e5e7eb",
                  fontSize: 13,
                  marginTop: 2,
                }}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "#9ca3af",
                  display: "block",
                }}
              >
                Region
              </label>
              <input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="NS / ON / etc."
                style={{
                  width: "100%",
                  borderRadius: 8,
                  border: "1px solid rgba(75,85,99,1)",
                  padding: "6px 8px",
                  backgroundColor: "rgba(15,23,42,1)",
                  color: "#e5e7eb",
                  fontSize: 13,
                  marginTop: 2,
                }}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "#9ca3af",
                  display: "block",
                }}
              >
                Postal code
              </label>
              <input
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                style={{
                  width: "100%",
                  borderRadius: 8,
                  border: "1px solid rgba(75,85,99,1)",
                  padding: "6px 8px",
                  backgroundColor: "rgba(15,23,42,1)",
                  color: "#e5e7eb",
                  fontSize: 13,
                  marginTop: 2,
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "0.8fr 1.2fr",
              gap: 8,
              alignItems: "flex-start",
            }}
          >
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "#9ca3af",
                  display: "block",
                }}
              >
                Total units
              </label>
              <input
                type="number"
                min={0}
                value={totalUnits}
                onChange={(e) =>
                  setTotalUnits(
                    e.target.value === \"\" ? \"\" : Number(e.target.value)\n                  )\n                }\n                style={{\n                  width: \"100%\",\n                  borderRadius: 8,\n                  border: \"1px solid rgba(75,85,99,1)\",\n                  padding: \"6px 8px\",\n                  backgroundColor: \"rgba(15,23,42,1)\",\n                  color: \"#e5e7eb\",\n                  fontSize: 13,\n                  marginTop: 2,\n                }}\n              />\n            </div>\n\n            <div>\n              <label\n                style={{\n                  fontSize: 12,\n                  color: \"#9ca3af\",\n                  display: \"block\",\n                }}\n              >\n                Amenities (building)\n              </label>\n              <input\n                value={amenities}\n                onChange={(e) => setAmenities(e.target.value)}\n                placeholder=\"Parking, laundry, elevator, storage, etc.\"\n                style={{\n                  width: \"100%\",\n                  borderRadius: 8,\n                  border: \"1px solid rgba(75,85,99,1)\",\n                  padding: \"6px 8px\",\n                  backgroundColor: \"rgba(15,23,42,1)\",\n                  color: \"#e5e7eb\",\n                  fontSize: 13,\n                  marginTop: 2,\n                }}\n              />\n            </div>\n          </div>\n\n          <div>\n            <label\n              style={{\n                fontSize: 12,\n                color: \"#9ca3af\",\n                display: \"block\",\n              }}\n            >\n              Units (one per line: \"Unit, Type, SizeSqft\")\n            </label>\n            <textarea\n              value={unitsText}\n              onChange={(e) => setUnitsText(e.target.value)}\n              rows={4}\n              style={{\n                width: \"100%\",\n                borderRadius: 8,\n                border: \"1px solid rgba(75,85,99,1)\",\n                padding: \"6px 8px\",\n                backgroundColor: \"rgba(15,23,42,1)\",\n                color: \"#e5e7eb\",\n                fontSize: 13,\n                marginTop: 2,\n                resize: \"vertical\",\n              }}\n            />\n          </div>\n\n          <div>\n            <label\n              style={{\n                fontSize: 12,\n                color: \"#9ca3af\",\n                display: \"block\",\n              }}\n            >\n              Notes (optional)\n            </label>\n            <textarea\n              value={notes}\n              onChange={(e) => setNotes(e.target.value)}\n              rows={2}\n              style={{\n                width: \"100%\",\n                borderRadius: 8,\n                border: \"1px solid rgba(55,65,81,1)\",\n                padding: \"6px 8px\",\n                backgroundColor: \"rgba(15,23,42,1)\",\n                color: \"#e5e7eb\",\n                fontSize: 13,\n                marginTop: 2,\n                resize: \"vertical\",\n              }}\n            />\n          </div>\n\n          <div\n            style={{\n              display: \"flex\",\n              justifyContent: \"flex-end\",\n              gap: 8,\n              marginTop: 8,\n            }}\n          >\n            <button\n              type=\"button\"\n              onClick={onClose}\n              style={{\n                borderRadius: 999,\n                border: \"1px solid rgba(55,65,81,1)\",\n                padding: \"6px 12px\",\n                backgroundColor: \"transparent\",\n                color: \"#e5e7eb\",\n                fontSize: 12,\n                cursor: \"pointer\",\n              }}\n            >\n              Cancel\n            </button>\n            <button\n              type=\"submit\"\n              style={{\n                borderRadius: 999,\n                border: \"none\",\n                padding: \"6px 12px\",\n                background:\n                  \"radial-gradient(circle at top left, rgba(56,189,248,0.4) 0, rgba(37,99,235,1) 45%, rgba(30,64,175,1) 100%)\",\n                color: \"#f9fafb\",\n                fontSize: 12,\n                fontWeight: 500,\n                cursor: \"pointer\",\n              }}\n            >\n              Save property\n            </button>\n          </div>\n        </form>\n      </div>\n    </div>\n  );\n};\n*** End Patch\n"} সংশ? There's escaped newline mid. It may break. Need correct patch. but output autop. should confirm file. Let's check quick. to=functions.shell_command. But running low time? Actually patch outputs inserted with weird escapes because convert. Might break TS (line breaks). need check file content; maybe lines have backslashes? Let's open portion lines around totalUnits. to=functions.shell_command. Let's check. We'll review after compile maybe long. We'll open relevant section. 
