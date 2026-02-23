import { normalizeProvinceCode, type ProvinceCode } from "./provinces";

export type LeasePackDocument = {
  id: string;
  name: string;
  format: "PDF" | "DOCX";
  url: string;
};

export type LeasePackDefinition = {
  province: Exclude<ProvinceCode, "UNSET">;
  title: string;
  version: string;
  bundleUrl: string;
  contents: LeasePackDocument[];
};

const NS_PACK: LeasePackDefinition = {
  province: "NS",
  title: "Nova Scotia Lease Pack v1",
  version: "ns-lease-pack-v1",
  bundleUrl: "/templates/ns/lease-pack-v1-bundle.zip",
  contents: [
    {
      id: "ns-summary-pdf",
      name: "Lease Data Summary",
      format: "PDF",
      url: "/templates/ns/lease-data-summary.pdf",
    },
    {
      id: "ns-clauses-pdf",
      name: "Additional Clauses Attachment",
      format: "PDF",
      url: "/templates/ns/additional-clauses-attachment.pdf",
    },
    {
      id: "ns-clauses-docx",
      name: "Additional Clauses Attachment",
      format: "DOCX",
      url: "/templates/ns/additional-clauses-attachment.docx",
    },
  ],
};

const ON_PACK: LeasePackDefinition = {
  province: "ON",
  title: "Ontario Lease Pack v1",
  version: "ontario-lease-pack-v1",
  bundleUrl: "/templates/on/lease-pack-v1-bundle.zip",
  contents: [
    {
      id: "on-summary-pdf",
      name: "Ontario Lease Data Summary",
      format: "PDF",
      url: "/templates/on/lease-data-summary.pdf",
    },
    {
      id: "on-payment-pdf",
      name: "Payment Terms Summary",
      format: "PDF",
      url: "/templates/on/payment-terms-summary.pdf",
    },
    {
      id: "on-clauses-pdf",
      name: "Additional Clauses Attachment",
      format: "PDF",
      url: "/templates/on/additional-clauses-attachment.pdf",
    },
    {
      id: "on-clauses-docx",
      name: "Additional Clauses Attachment",
      format: "DOCX",
      url: "/templates/on/additional-clauses-attachment.docx",
    },
    {
      id: "on-compliance-pdf",
      name: "Compliance Summary",
      format: "PDF",
      url: "/templates/on/compliance-summary.pdf",
    },
  ],
};

export function getLeasePackForProvince(provinceInput?: string | null): LeasePackDefinition | null {
  const code = normalizeProvinceCode(provinceInput);
  if (!code || code === "UNSET") return null;
  if (code === "ON") return ON_PACK;
  if (code === "NS") return NS_PACK;
  return null;
}

export function listProvinceLeasePacks(): LeasePackDefinition[] {
  return [ON_PACK, NS_PACK];
}
