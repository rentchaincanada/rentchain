export function buildUnitsCsvTemplate() {
  const headers = [
    "unitNumber",
    "floor",
    "unitType",
    "status",
    "beds",
    "baths",
    "sqft",
    "marketRent",
    "deposit",
    "utilitiesIncluded",
    "amenities",
    "notes",
  ];

  const exampleRows = [
    [
      "101",
      "1",
      "1br",
      "vacant",
      "1",
      "1",
      "610",
      "1850",
      "1850",
      "heat;water",
      "balcony;parking",
      "Near elevator",
    ],
    [
      "102",
      "1",
      "studio",
      "occupied",
      "0",
      "1",
      "450",
      "1650",
      "1650",
      "heat",
      "parking",
      "",
    ],
  ];

  const lines = [
    headers.join(","),
    ...exampleRows.map((r) =>
      r
        .map((v) => {
          const s = String(v ?? "");
          if (s.includes(",") || s.includes('"') || s.includes("\n")) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        })
        .join(",")
    ),
  ];

  return lines.join("\n");
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
