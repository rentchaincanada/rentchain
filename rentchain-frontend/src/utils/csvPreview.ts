export function normalizeCsvPreviewText(text: string) {
  return String(text ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/^[\uFFFD]+/, "")
    .replace(/\u0000/g, "")
    .replace(/[\u200B-\u200D\u2060]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

export function parseCsvPreview(text: string, maxRows = 10) {
  const lines = normalizeCsvPreviewText(text)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return { headers: [], rows: [] as string[][] };

  const parseLine = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === "," && !inQuotes) {
        out.push(cur.replace(/^\uFEFF/, "").trim());
        cur = "";
        continue;
      }
      cur += ch;
    }
    out.push(cur.replace(/^\uFEFF/, "").trim());
    return out;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1, 1 + maxRows).map(parseLine);

  return { headers, rows };
}
