export function buildUnitsCsvTemplate() {
  const headers = [
    "unitNumber",
    "marketRent",
    "beds",
    "baths",
    "sqft",
    "status",
    "occupantName",
    "leaseEndDate",
  ];

  const exampleRows = [
    ["101", "1850", "1", "1", "610", "vacant", "", ""],
    ["102", "1650", "0", "1", "450", "occupied", "Jane Tenant", "2027-06-10"],
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
