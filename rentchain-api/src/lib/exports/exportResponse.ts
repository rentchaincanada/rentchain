import { governanceMetadata, type GovernanceSensitivity } from "../governance/platformGovernance";

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
    sensitivity?: GovernanceSensitivity;
  }
): void {
  res.setHeader("Content-Type", getExportContentType(params.format));
  res.setHeader("Content-Disposition", `attachment; filename="${params.filename}"`);
  const governance = governanceMetadata({
    sensitivity: params.sensitivity || "confidential",
    retentionCategory: "export_metadata",
  });
  res.setHeader("X-RentChain-Governance", "metadata-only");
  res.setHeader("X-RentChain-Export-Sensitivity", governance.sensitivity);
  res.setHeader("X-RentChain-Retention-Category", governance.retentionCategory);
}
