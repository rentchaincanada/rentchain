import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import AskRentChainWidget from "../../components/help/AskRentChainWidget";
import { Card } from "../../components/ui/Ui";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "./MarketingLayout";
import { templateUrl } from "../../utils/templateUrl";
import { useLocale } from "../../i18n";

const LegalHelpPage: React.FC = () => {
  const { t } = useLocale();

  useEffect(() => {
    document.title = `${t("legal.headline")} — RentChain`;
  }, [t]);

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
        <div>
          <h1 style={{ margin: 0 }}>{t("legal.headline")}</h1>
        </div>

        <div>
          <h2 style={{ marginTop: 0 }}>{t("legal.ask_title")}</h2>
          <AskRentChainWidget compact defaultOpen={false} />
        </div>

        <Card>
          <h2 style={{ marginTop: 0 }}>{t("legal.section_legal")}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
            <div>
              <h3 style={{ marginTop: 0 }}>{t("legal.privacy_title")}</h3>
              <p style={{ margin: 0, color: text.muted }}>
                {t("legal.privacy_body")}
              </p>
            </div>
            <div>
              <h3 style={{ marginTop: 0 }}>{t("legal.consent_title")}</h3>
              <p style={{ margin: 0, color: text.muted }}>
                {t("legal.consent_body")}
              </p>
            </div>
            <div>
              <h3 style={{ marginTop: 0 }}>{t("legal.noblackbox_title")}</h3>
              <p style={{ margin: 0, color: text.muted }}>
                {t("legal.noblackbox_body")}
              </p>
            </div>
            <div>
              <h3 style={{ marginTop: 0 }}>{t("legal.platform_title")}</h3>
              <p style={{ margin: 0, color: text.muted }}>
                {t("legal.platform_body")}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>{t("legal.section_terms")}</h2>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted }}>
            <li>
              <Link to="/terms" style={{ color: text.secondary }}>
                {t("legal.terms_service")}
              </Link>
            </li>
            <li>
              <Link to="/privacy" style={{ color: text.secondary }}>
                {t("legal.terms_privacy")}
              </Link>
            </li>
            <li>
              <Link to="/acceptable-use" style={{ color: text.secondary }}>
                {t("legal.terms_acceptable")}
              </Link>
            </li>
          </ul>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>{t("legal.section_help")}</h2>
          <p style={{ marginTop: 0, color: text.muted }}>
            {t("legal.help_library")}{" "}
            <Link to="/help/templates" style={{ color: text.secondary }}>
              {t("legal.help_library_link")}
            </Link>
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.lg }}>
            <div style={{ flex: "1 1 280px" }}>
              <h3 style={{ marginTop: 0 }}>{t("legal.help_landlords")}</h3>
              <ul style={{ paddingLeft: "1.1rem", color: text.muted }}>
                <li>{t("legal.help_getting_started")}</li>
                <li>{t("legal.help_guides")}</li>
              </ul>
              <ul style={{ paddingLeft: "1.1rem", color: text.muted, display: "grid", gap: spacing.xs }}>
                <li style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
                  <span>{t("legal.template_late_rent")}</span>
                  <span style={{ display: "flex", gap: spacing.xs }}>
                    <a href={templateUrl("/templates/Late_Rent_Notice_Template.pdf")} download target="_blank" rel="noopener noreferrer">PDF</a>
                    <a href={templateUrl("/templates/Late_Rent_Notice_Template.docx")} download target="_blank" rel="noopener noreferrer">DOCX</a>
                  </span>
                </li>
                <li style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
                  <span>{t("legal.template_notice_entry")}</span>
                  <span style={{ display: "flex", gap: spacing.xs }}>
                    <a href={templateUrl("/templates/Notice_of_Entry_Template.pdf")} download target="_blank" rel="noopener noreferrer">PDF</a>
                    <a href={templateUrl("/templates/Notice_of_Entry_Template.docx")} download target="_blank" rel="noopener noreferrer">DOCX</a>
                  </span>
                </li>
                <li style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
                  <span>{t("legal.template_lease_event")}</span>
                  <span style={{ display: "flex", gap: spacing.xs }}>
                    <a href={templateUrl("/templates/Lease_Event_Log_Template.pdf")} download target="_blank" rel="noopener noreferrer">PDF</a>
                    <a href={templateUrl("/templates/Lease_Event_Log_Template.docx")} download target="_blank" rel="noopener noreferrer">DOCX</a>
                    <a href={templateUrl("/templates/Lease_Event_Log_Template.csv")} download target="_blank" rel="noopener noreferrer">CSV</a>
                  </span>
                </li>
                <li style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
                  <span>{t("legal.template_move_in_out")}</span>
                  <span style={{ display: "flex", gap: spacing.xs }}>
                    <a href={templateUrl("/templates/Move_In_Out_Inspection_Checklist_Template.pdf")} download target="_blank" rel="noopener noreferrer">PDF</a>
                    <a href={templateUrl("/templates/Move_In_Out_Inspection_Checklist_Template.docx")} download target="_blank" rel="noopener noreferrer">DOCX</a>
                  </span>
                </li>
                <li style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
                  <span>{t("legal.template_rent_ledger")}</span>
                  <span style={{ display: "flex", gap: spacing.xs }}>
                    <a href={templateUrl("/templates/Rent_Ledger_Summary_Template.pdf")} download target="_blank" rel="noopener noreferrer">PDF</a>
                    <a href={templateUrl("/templates/Rent_Ledger_Summary_Template.docx")} download target="_blank" rel="noopener noreferrer">DOCX</a>
                    <a href={templateUrl("/templates/Rent_Ledger_Summary_Template.csv")} download target="_blank" rel="noopener noreferrer">CSV</a>
                  </span>
                </li>
              </ul>
            </div>
            <div style={{ flex: "1 1 280px" }}>
              <h3 style={{ marginTop: 0 }}>{t("legal.help_tenants")}</h3>
              <ul style={{ paddingLeft: "1.1rem", color: text.muted }}>
                <li>{t("legal.help_understanding")}</li>
                <li>{t("legal.help_guides")}</li>
              </ul>
              <ul style={{ paddingLeft: "1.1rem", color: text.muted, display: "grid", gap: spacing.xs }}>
                <li style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
                  <span>{t("legal.template_rental_checklist")}</span>
                  <span style={{ display: "flex", gap: spacing.xs }}>
                    <a href={templateUrl("/templates/Rental_Application_Checklist_Tenant.pdf")} download target="_blank" rel="noopener noreferrer">PDF</a>
                    <a href={templateUrl("/templates/Rental_Application_Checklist_Tenant.docx")} download target="_blank" rel="noopener noreferrer">DOCX</a>
                  </span>
                </li>
                <li style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
                  <span>{t("legal.template_dispute_guide")}</span>
                  <span style={{ display: "flex", gap: spacing.xs }}>
                    <a href={templateUrl("/templates/Dispute_Documentation_Guide_Template.pdf")} download target="_blank" rel="noopener noreferrer">PDF</a>
                    <a href={templateUrl("/templates/Dispute_Documentation_Guide_Template.docx")} download target="_blank" rel="noopener noreferrer">DOCX</a>
                  </span>
                </li>
              </ul>
            </div>
          </div>
          <p style={{ marginTop: spacing.sm, color: text.subtle }}>
            {t("legal.templates_disclaimer")}
          </p>
          <p style={{ marginTop: spacing.md, color: text.muted }}>
            {t("legal.help_contact")}
          </p>
        </Card>
      </div>
    </MarketingLayout>
  );
};

export default LegalHelpPage;
