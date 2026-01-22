import React, { useMemo, useState } from "react";
import { Card, Input } from "../../components/ui/Ui";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "../marketing/MarketingLayout";

type TemplateFile = {
  label: "PDF" | "DOCX" | "CSV";
  file: string;
};

type TemplateItem = {
  name: string;
  description: string;
  category: "Landlord Templates" | "Tenant Templates";
  files: TemplateFile[];
};

const templateUrl = (fileName: string) => `/templates/${fileName}`;

const templates: TemplateItem[] = [
  {
    name: "Late Rent Notice",
    description: "Notify a tenant of overdue rent and payment deadline.",
    category: "Landlord Templates",
    files: [
      { label: "PDF", file: "Late_Rent_Notice_Template.pdf" },
      { label: "DOCX", file: "Late_Rent_Notice_Template.docx" },
    ],
  },
  {
    name: "Notice of Entry",
    description: "Provide notice of entry for inspection, repairs, or showings.",
    category: "Landlord Templates",
    files: [
      { label: "PDF", file: "Notice_of_Entry_Template.pdf" },
      { label: "DOCX", file: "Notice_of_Entry_Template.docx" },
    ],
  },
  {
    name: "Lease Event Log",
    description: "Structured log for payments, notices, maintenance, and outcomes.",
    category: "Landlord Templates",
    files: [
      { label: "PDF", file: "Lease_Event_Log_Template.pdf" },
      { label: "DOCX", file: "Lease_Event_Log_Template.docx" },
      { label: "CSV", file: "Lease_Event_Log_Template.csv" },
    ],
  },
  {
    name: "Move-In / Move-Out Inspection Checklist",
    description: "Document unit condition with notes and photo references.",
    category: "Landlord Templates",
    files: [
      { label: "PDF", file: "Move_In_Out_Inspection_Checklist_Template.pdf" },
      { label: "DOCX", file: "Move_In_Out_Inspection_Checklist_Template.docx" },
    ],
  },
  {
    name: "Rent Ledger Summary Sheet",
    description: "Track charges, payments, balances, and notes.",
    category: "Landlord Templates",
    files: [
      { label: "PDF", file: "Rent_Ledger_Summary_Template.pdf" },
      { label: "DOCX", file: "Rent_Ledger_Summary_Template.docx" },
      { label: "CSV", file: "Rent_Ledger_Summary_Template.csv" },
    ],
  },
  {
    name: "Rental Application Checklist (Tenant)",
    description: "Checklist of common documents and info to prepare.",
    category: "Tenant Templates",
    files: [
      { label: "PDF", file: "Rental_Application_Checklist_Tenant.pdf" },
      { label: "DOCX", file: "Rental_Application_Checklist_Tenant.docx" },
    ],
  },
  {
    name: "Dispute Documentation Guide",
    description: "How to document issues with timelines, evidence, and outcomes.",
    category: "Tenant Templates",
    files: [
      { label: "PDF", file: "Dispute_Documentation_Guide_Template.pdf" },
      { label: "DOCX", file: "Dispute_Documentation_Guide_Template.docx" },
    ],
  },
];

const TemplatesPage: React.FC = () => {
  const [query, setQuery] = useState("");

  React.useEffect(() => {
    document.title = "Templates — RentChain";
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => {
      const haystack = `${t.name} ${t.description} ${t.category}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [query]);

  const landlordTemplates = filtered.filter((t) => t.category === "Landlord Templates");
  const tenantTemplates = filtered.filter((t) => t.category === "Tenant Templates");

  const renderTemplate = (item: TemplateItem) => (
    <Card key={item.name} style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: "1rem" }}>{item.name}</div>
        <div style={{ color: text.muted }}>{item.description}</div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.xs }}>
        {item.files.map((f) => (
          <a
            key={f.file}
            href={templateUrl(f.file)}
            download
            style={{
              border: "1px solid rgba(15,23,42,0.12)",
              borderRadius: 999,
              padding: "4px 10px",
              fontSize: "0.8rem",
              color: text.secondary,
              textDecoration: "none",
            }}
          >
            {f.label}
          </a>
        ))}
      </div>
    </Card>
  );

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
        <div>
          <h1 style={{ margin: 0 }}>Templates</h1>
          <p style={{ marginTop: spacing.sm, color: text.muted, maxWidth: 760 }}>
            Download general-purpose templates (not legal advice). Customize for your jurisdiction and consult counsel
            as needed.
          </p>
        </div>
        <Input
          placeholder="Search templates"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ maxWidth: 420 }}
        />

        {filtered.length === 0 ? (
          <div style={{ color: text.muted }}>No templates match your search.</div>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
          <h2 style={{ margin: 0 }}>Landlord Templates</h2>
          <div style={{ display: "grid", gap: spacing.md, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {landlordTemplates.map(renderTemplate)}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
          <h2 style={{ margin: 0 }}>Tenant Templates</h2>
          <div style={{ display: "grid", gap: spacing.md, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {tenantTemplates.map(renderTemplate)}
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
};

export default TemplatesPage;
