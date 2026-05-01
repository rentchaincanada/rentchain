export type ExportFormat = "csv" | "xls" | "pdf";

function isoDateStamp(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildDatedExportFilename(params: {
  prefix: string;
  format: ExportFormat;
  date?: Date;
}): string {
  const date = params.date || new Date();
  return `${params.prefix}-${isoDateStamp(date)}.${params.format}`;
}

export function getExportContentType(format: ExportFormat): string {
  switch (format) {
    case "csv":
      return "text/csv; charset=utf-8";
    case "xls":
      return "application/vnd.ms-excel";
    case "pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

export function setAttachmentExportHeaders(
  res: { setHeader(name: string, value: string): unknown },
  params: {
    filename: string;
    format: ExportFormat;
  }
): void {
  res.setHeader("Content-Type", getExportContentType(params.format));
  res.setHeader("Content-Disposition", `attachment; filename="${params.filename}"`);
}
