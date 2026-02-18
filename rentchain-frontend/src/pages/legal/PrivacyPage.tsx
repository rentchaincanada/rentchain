import React, { useEffect } from "react";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "../marketing/MarketingLayout";

const PrivacyPage: React.FC = () => {
  useEffect(() => {
    document.title = "Privacy Policy — RentChain";
  }, []);

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, maxWidth: 760 }}>
        <div>
          <h1 style={{ margin: 0 }}>Privacy Policy</h1>
          <div style={{ marginTop: spacing.xs, color: text.subtle }}>Effective date: 2026-01-21</div>
        </div>
        <p style={{ margin: 0, color: text.muted }}>
          This Privacy Policy explains how RentChain (RentChain, we, our, us) collects, uses, shares, and protects
          personal information when you use our website and platform.
        </p>

        <h2 style={{ marginTop: spacing.lg }}>1) Information We Collect</h2>
        <ul style={{ marginTop: 0, marginBottom: 0, paddingLeft: "1.1rem", color: text.muted }}>
          <li>Account information: name, email, phone number, authentication details.</li>
          <li>Application information: rental application responses and documents provided by the user.</li>
          <li>
            Screening and verification information: consent records, screening request metadata, provider statuses, and
            outcomes necessary to deliver screening workflows.
          </li>
          <li>
            Usage and device information: IP address, device/browser information, and activity logs used for security
            and service operation.
          </li>
        </ul>

        <h2 style={{ marginTop: spacing.lg }}>2) How We Use Information</h2>
        <p style={{ margin: 0, color: text.muted }}>We use personal information to:</p>
        <ul style={{ marginTop: spacing.sm, marginBottom: 0, paddingLeft: "1.1rem", color: text.muted }}>
          <li>Provide and operate the RentChain platform</li>
          <li>Facilitate tenant-initiated screening and verification workflows</li>
          <li>Maintain audit logs and security controls</li>
          <li>Prevent fraud and abuse</li>
          <li>Improve platform reliability and performance</li>
          <li>Comply with legal obligations</li>
        </ul>
        <p style={{ marginTop: spacing.sm, marginBottom: 0, color: text.muted }}>We do not sell personal information.</p>

        <h2 style={{ marginTop: spacing.lg }}>3) Screening & Consumer Reports</h2>
        <p style={{ margin: 0, color: text.muted }}>
          Where screening is enabled, screening information is processed only with appropriate authorization and for
          lawful rental screening purposes. Screening outputs are provided by authorized third-party providers where
          applicable. RentChain is not a consumer reporting agency and does not create independent consumer credit
          files.
        </p>

        <h2 style={{ marginTop: spacing.lg }}>4) How We Share Information</h2>
        <p style={{ margin: 0, color: text.muted }}>We may share personal information with:</p>
        <ul style={{ marginTop: spacing.sm, marginBottom: 0, paddingLeft: "1.1rem", color: text.muted }}>
          <li>
            Screening and verification partners (for example, authorized providers) when a user initiates a screening
            workflow and proper authorization exists
          </li>
          <li>
            Service providers who support hosting, security, analytics, communications, and platform operations under
            contractual confidentiality obligations
          </li>
          <li>
            Authorities or regulators when required by law or to protect rights, safety, and platform integrity
          </li>
        </ul>
        <p style={{ marginTop: spacing.sm, marginBottom: 0, color: text.muted }}>
          Tenant information is not shared without authorization or a valid legal basis.
        </p>

        <h2 style={{ marginTop: spacing.lg }}>5) Data Retention</h2>
        <p style={{ margin: 0, color: text.muted }}>
          We retain personal information only as long as necessary for the purposes described above, including
          compliance, auditability, dispute handling, and legal obligations. Retention periods may vary by record type
          and jurisdiction. Users may request deletion of their account, subject to required retention for compliance
          and legitimate business purposes.
        </p>

        <h2 style={{ marginTop: spacing.lg }}>6) Security</h2>
        <p style={{ margin: 0, color: text.muted }}>
          We implement reasonable safeguards designed to protect personal information, including encryption in transit,
          access controls, audit logging, and secure infrastructure. No method of transmission or storage is completely
          secure.
        </p>

        <h2 style={{ marginTop: spacing.lg }}>7) Your Choices and Rights</h2>
        <p style={{ margin: 0, color: text.muted }}>Depending on your jurisdiction, you may have rights to:</p>
        <ul style={{ marginTop: spacing.sm, marginBottom: 0, paddingLeft: "1.1rem", color: text.muted }}>
          <li>Access your personal information</li>
          <li>Correct inaccuracies</li>
          <li>Request deletion</li>
          <li>Withdraw consent where applicable</li>
          <li>Obtain information about disclosures</li>
        </ul>
        <p style={{ marginTop: spacing.sm, marginBottom: 0, color: text.muted }}>
          To submit a request, contact: privacy@rentchain.ai
        </p>

        <h2 style={{ marginTop: spacing.lg }}>8) Cookies & Tracking</h2>
        <p style={{ margin: 0, color: text.muted }}>
          We may use essential cookies and limited analytics to operate and improve the service. We do not use cookies
          for third-party advertising.
        </p>

        <h2 style={{ marginTop: spacing.lg }}>9) Children's Privacy</h2>
        <p style={{ margin: 0, color: text.muted }}>
          RentChain is not intended for individuals under the age of majority in their jurisdiction.
        </p>

        <h2 style={{ marginTop: spacing.lg }}>10) Changes to this Policy</h2>
        <p style={{ margin: 0, color: text.muted }}>
          We may update this policy periodically. Updates will be posted with a revised effective date.
        </p>

        <h2 style={{ marginTop: spacing.lg }}>Contact</h2>
        <p style={{ margin: 0, color: text.muted }}>privacy@rentchain.ai</p>
      </div>
    </MarketingLayout>
  );
};

export default PrivacyPage;
