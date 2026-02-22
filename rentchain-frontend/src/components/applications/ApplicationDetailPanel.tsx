// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import type {
  Application,
  ApplicationStatus,
  ApplicationTimelineEntry,
  Applicant,
} from "../../types/applications";
import { useSubscription } from "../../context/SubscriptionContext";
import { colors, text, radius, shadows, spacing } from "../../styles/tokens";
import { updateApplicationDetails, updateApplicationReferences } from "@/api/applicationsApi";
import { useToast } from "../ui/ToastProvider";
import { ConvertToTenantButton } from "./ConvertToTenantButton";
import { SCREENING_ENABLED } from "../../config/screening";

type ApplicationDetailPanelProps = {
  application: Application | null;
  timeline: ApplicationTimelineEntry[];
  onStatusChange: (status: ApplicationStatus) => void;
  onConvertToTenant: () => void;
  isConverting: boolean;
  onApplicationUpdated: (application: Application) => void;
  missingFields?: string[];
};

function splitNameParts(fullName?: string | null): { first: string; last: string } {
  if (!fullName) {
    return { first: "", last: "" };
  }
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { first: "", last: "" };
  }
  if (parts.length === 1) {
    return { first: parts[0], last: "" };
  }
  const first = parts[0];
  const last = parts.slice(1).join(" ");
  return { first, last };
}

const statusLabel: Record<ApplicationStatus, string> = {
  new: "New",
  in_review: "In review",
  approved: "Approved",
  rejected: "Rejected",
};

const SCREENING_STATUS_LABELS: Record<string, string> = {
  complete: "Completed",
  completed: "Completed",
  paid: "Paid",
  processing: "Processing",
  in_progress: "Processing",
  pending: "Pending",
  failed: "Unable to complete",
  not_requested: "Not requested",
};

function formatScreeningState(value?: string | null): string {
  const key = String(value || "")
    .trim()
    .toLowerCase();
  if (!key) return "Not requested";
  return SCREENING_STATUS_LABELS[key] || "Pending";
}

export const ApplicationDetailPanel: React.FC<ApplicationDetailPanelProps> = ({
  application,
  timeline,
  onStatusChange,
  onConvertToTenant,
  isConverting,
  onApplicationUpdated,
  missingFields = [],
}) => {
  const [selectedApplicantIndex, setSelectedApplicantIndex] = useState(0);
  const { features } = useSubscription();
  const canUseAiScreening = features.hasTenantAI;
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [requiredFields, setRequiredFields] = useState({
    unitApplied: "",
    leaseStartDate: "",
    firstName: "",
    middleName: "",
    lastName: "",
    dateOfBirth: "",
    streetNumber: "",
    streetName: "",
    city: "",
    province: "",
    postalCode: "",
    consentCreditCheck: false,
  });
  const [isSavingRequired, setIsSavingRequired] = useState(false);
  const [referencesContacted, setReferencesContacted] = useState(false);
  const [referencesNotes, setReferencesNotes] = useState("");
  const [isSavingReferences, setIsSavingReferences] = useState(false);
  const requiredFieldInputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: `1px solid ${colors.border}`,
    background: colors.card,
    color: text.primary,
    fontSize: 13,
  };
  const { showToast } = useToast();

  const applicantsList: Applicant[] = useMemo(() => {
    if (!application) return [];
    if (application.applicants && application.applicants.length > 0) {
      return application.applicants;
    }

    const synthetic: Applicant = {
      id: application.id,
      role: "primary",
      fullName: application.fullName || application.applicantName || "Applicant",
      dateOfBirth: application.dateOfBirth ?? null,
      socialInsuranceNumber: application.socialInsuranceNumber ?? null,
      monthlyIncome: application.monthlyIncome ?? null,
      currentAddress: application.currentAddress ?? null,
      currentCity: application.currentCity ?? null,
      currentProvince: application.currentProvince ?? null,
      currentPostalCode: application.currentPostalCode ?? null,
      landlordReferenceName: application.landlordReferenceName ?? null,
      landlordReferencePhone: application.landlordReferencePhone ?? null,
      employmentReferenceName: application.employmentReferenceName ?? null,
      employmentReferencePhone: application.employmentReferencePhone ?? null,
      bankReferenceName: application.bankReferenceName ?? null,
      bankReferenceAccountMasked: application.bankReferenceAccountMasked ?? null,
      vehicleMake: application.vehicleMake ?? null,
      vehicleModel: application.vehicleModel ?? null,
      vehicleYear: application.vehicleYear ?? null,
      vehiclePlate: application.vehiclePlate ?? null,
      notes: application.notes ?? null,
    };

    return [synthetic];
  }, [application]);

  useEffect(() => {
    if (!application) return;
    const fallback = splitNameParts(application.fullName);

    setRequiredFields({
      unitApplied: application.unitApplied || application.unit || "",
      leaseStartDate: application.leaseStartDate || application.moveInDate || "",
      firstName: application.firstName || fallback.first,
      middleName: application.middleName || "",
      lastName: application.lastName || fallback.last,
      dateOfBirth: application.dateOfBirth || "",
      streetNumber: application.recentAddress?.streetNumber || "",
      streetName: application.recentAddress?.streetName || "",
      city: application.recentAddress?.city || "",
      province: application.recentAddress?.province || "",
      postalCode: application.recentAddress?.postalCode || "",
      consentCreditCheck: !!application.consentCreditCheck,
    });
    setReferencesContacted(!!application.referencesContacted);
    setReferencesNotes(application.referencesNotes || "");
  }, [application]);

  useEffect(() => {
    if (!applicantsList || applicantsList.length === 0) {
      if (selectedApplicantIndex !== 0) {
        setSelectedApplicantIndex(0);
      }
      return;
    }
    if (selectedApplicantIndex >= applicantsList.length) {
      setSelectedApplicantIndex(0);
    }
  }, [applicantsList, selectedApplicantIndex]);

  useEffect(() => {
    setSelectedApplicantIndex(0);
  }, [application?.id]);

  const trimField = (value: string | null | undefined) =>
    typeof value === "string" ? value.trim() : "";

  const requiredMissing = useMemo(() => {
    const missing: string[] = [];
    if (!trimField(requiredFields.unitApplied)) missing.push("unitApplied");
    if (!trimField(requiredFields.leaseStartDate)) missing.push("leaseStartDate");
    if (!trimField(requiredFields.firstName)) missing.push("firstName");
    if (!trimField(requiredFields.lastName)) missing.push("lastName");
    if (!trimField(requiredFields.dateOfBirth)) missing.push("dateOfBirth");
    if (!trimField(requiredFields.streetNumber)) missing.push("streetNumber");
    if (!trimField(requiredFields.streetName)) missing.push("streetName");
    if (!trimField(requiredFields.city)) missing.push("city");
    if (!trimField(requiredFields.province)) missing.push("province");
    if (!trimField(requiredFields.postalCode)) missing.push("postalCode");
    if (!requiredFields.consentCreditCheck) missing.push("consentCreditCheck");
    return missing;
  }, [requiredFields]);

  const combinedMissing = useMemo(() => {
    const merged = [...requiredMissing, ...(missingFields || [])];
    return Array.from(new Set(merged));
  }, [missingFields, requiredMissing]);

  const hasChanges = useMemo(() => {
    if (!application) return false;
    const fallback = splitNameParts(application.fullName);
    const baseline = {
      unitApplied: application.unitApplied || application.unit || "",
      leaseStartDate: application.leaseStartDate || application.moveInDate || "",
      firstName: application.firstName || fallback.first,
      middleName: application.middleName || "",
      lastName: application.lastName || fallback.last,
      dateOfBirth: application.dateOfBirth || "",
      streetNumber: application.recentAddress?.streetNumber || "",
      streetName: application.recentAddress?.streetName || "",
      city: application.recentAddress?.city || "",
      province: application.recentAddress?.province || "",
      postalCode: application.recentAddress?.postalCode || "",
      consentCreditCheck: !!application.consentCreditCheck,
    };

    return (
      trimField(requiredFields.unitApplied) !== trimField(baseline.unitApplied) ||
      trimField(requiredFields.leaseStartDate) !== trimField(baseline.leaseStartDate) ||
      trimField(requiredFields.firstName) !== trimField(baseline.firstName) ||
      trimField(requiredFields.middleName) !== trimField(baseline.middleName) ||
      trimField(requiredFields.lastName) !== trimField(baseline.lastName) ||
      trimField(requiredFields.dateOfBirth) !== trimField(baseline.dateOfBirth) ||
      trimField(requiredFields.streetNumber) !== trimField(baseline.streetNumber) ||
      trimField(requiredFields.streetName) !== trimField(baseline.streetName) ||
      trimField(requiredFields.city) !== trimField(baseline.city) ||
      trimField(requiredFields.province) !== trimField(baseline.province) ||
      trimField(requiredFields.postalCode) !== trimField(baseline.postalCode) ||
      requiredFields.consentCreditCheck !== baseline.consentCreditCheck
    );
  }, [application, requiredFields]);

  const handleSaveRequiredFields = async () => {
    if (!application) return;
    setIsSavingRequired(true);
    try {
      const payload = {
        unitApplied: trimField(requiredFields.unitApplied),
        leaseStartDate: trimField(requiredFields.leaseStartDate) || null,
        firstName: trimField(requiredFields.firstName),
        middleName: trimField(requiredFields.middleName) || null,
        lastName: trimField(requiredFields.lastName),
        dateOfBirth: trimField(requiredFields.dateOfBirth) || null,
        consentCreditCheck: requiredFields.consentCreditCheck,
        recentAddress: {
          streetNumber: trimField(requiredFields.streetNumber),
          streetName: trimField(requiredFields.streetName),
          city: trimField(requiredFields.city),
          province: trimField(requiredFields.province),
          postalCode: trimField(requiredFields.postalCode),
        },
      };
      const updated = await updateApplicationDetails(application.id, payload);
      onApplicationUpdated(updated);
      showToast({
        message: "Application updated",
        description: "Required fields saved for screening.",
        variant: "success",
      });
    } catch (err: any) {
      showToast({
        message: "Failed to save required fields",
        description: err?.message || "Please try again.",
        variant: "error",
      });
    } finally {
      setIsSavingRequired(false);
    }
  };

  const handleSaveReferences = async () => {
    if (!application) return;
    setIsSavingReferences(true);
    try {
      const updated = await updateApplicationReferences(application.id, {
        contacted: referencesContacted,
        notes: referencesNotes || null,
      });
      onApplicationUpdated(updated);
      showToast({
        message: "References updated",
        description: "Reference status saved.",
        variant: "success",
      });
    } catch (err: any) {
      showToast({
        message: "Failed to save references",
        description: err?.message || "Please try again.",
        variant: "error",
      });
    } finally {
      setIsSavingReferences(false);
    }
  };

  const currentApplicant =
    applicantsList[selectedApplicantIndex] ?? applicantsList[0] ?? null;

  const applicantDisplayLabel = currentApplicant
    ? currentApplicant.role === "primary"
      ? `${currentApplicant.fullName} (Primary)`
      : `${currentApplicant.fullName} (Co-applicant)`
    : null;
  const primaryName =
    applicantsList[0]?.fullName ||
    application?.fullName ||
    application?.applicantName ||
    "Applicant";
  const coAppCount = Math.max(applicantsList.length - 1, 0);

  const rentAmount =
    application?.requestedRent ?? application?.monthlyRent ?? 0;
  const applicantsTotalIncome = applicantsList.reduce(
    (sum, appl) => sum + (appl.monthlyIncome ?? 0),
    0
  );
  const ratio =
    rentAmount > 0 && applicantsTotalIncome > 0
      ? applicantsTotalIncome / rentAmount
      : null;
  const combinedIncome =
    applicantsTotalIncome + (application?.coSignerMonthlyIncome ?? 0);
  const maskedSin =
    currentApplicant &&
    currentApplicant.socialInsuranceNumber &&
    currentApplicant.socialInsuranceNumber.replace(/\s+/g, "").length >= 3
      ? `*** *** ${currentApplicant.socialInsuranceNumber
          .replace(/\s+/g, "")
          .slice(-3)}`
      : null;

  const screeningInsights = useMemo(() => {
    const insights: {
      id: string;
      title: string;
      detail?: string;
      severity: "good" | "medium" | "risk";
    }[] = [];

    if (ratio != null) {
      if (ratio >= 3) {
        insights.push({
          id: "affordability-strong",
          title: "Strong affordability",
          detail: `Income is about ${ratio.toFixed(
            1
          )}x the rent, which is comfortably above typical 3x guidelines.`,
          severity: "good",
        });
      } else if (ratio >= 2) {
        insights.push({
          id: "affordability-acceptable",
          title: "Acceptable affordability",
          detail: `Income is about ${ratio.toFixed(
            1
          )}x the rent. This is generally workable but not as strong as 3x+.`,
          severity: "medium",
        });
      } else {
        insights.push({
          id: "affordability-tight",
          title: "Tight affordability",
          detail: `Income is about ${ratio.toFixed(
            1
          )}x the rent, which may feel tight. Consider co-signer strength or additional assurances.`,
          severity: "risk",
        });
      }
    } else {
      insights.push({
        id: "affordability-unknown",
        title: "Income information incomplete",
        detail:
          "Monthly income is missing or incomplete, so affordability canâ€™t be fully assessed.",
        severity: "medium",
      });
    }

    const coSignerName = application?.coSignerName;
    const coSignerIncome = application?.coSignerMonthlyIncome;

    if (coSignerName && coSignerName.trim()) {
      if (
        coSignerIncome != null &&
        rentAmount > 0 &&
        coSignerIncome >= rentAmount * 3
      ) {
        insights.push({
          id: "cosigner-strong",
          title: "Strong co-signer support",
          detail: `Co-signer ${coSignerName} reports income at or above 3x the rent, which can significantly reduce risk.`,
          severity: "good",
        });
      } else if (coSignerIncome != null) {
        insights.push({
          id: "cosigner-present",
          title: "Co-signer present",
          detail: `Co-signer ${coSignerName} is listed with some income, which can help offset affordability concerns.`,
          severity: "medium",
        });
      } else {
        insights.push({
          id: "cosigner-present-no-income",
          title: "Co-signer present (income not provided)",
          detail:
            "A co-signer is listed, but income is not provided. You may want to confirm their capacity to support the lease.",
          severity: "medium",
        });
      }
    } else if (ratio != null && ratio < 2) {
      insights.push({
        id: "no-cosigner-low-ratio",
        title: "No co-signer with tight affordability",
        detail:
          "Affordability looks tight and no co-signer is listed. Consider requesting more documentation or an additional guarantor.",
        severity: "risk",
      });
    }

    if (combinedIncome > 0 && rentAmount > 0) {
      const combinedRatio = combinedIncome / rentAmount;
      insights.push({
        id: "combined-picture",
        title: "Combined income picture",
        detail: `Total declared monthly income (including co-signer) is about ${combinedRatio.toFixed(
          1
        )}x the rent.`,
        severity:
          combinedRatio >= 3 ? "good" : combinedRatio >= 2 ? "medium" : "risk",
      });
    }

    return insights;
  }, [
    ratio,
    combinedIncome,
    application?.coSignerName,
    application?.coSignerMonthlyIncome,
    rentAmount,
  ]);

  if (!application) {
    return (
      <div
        style={{
          padding: 24,
          color: text.muted,
          fontSize: 14,
        }}
      >
        Select an application to view details.
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: spacing.md,
        gap: spacing.md,
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.lg,
        boxShadow: shadows.sm,
      }}
    >
      {/* Header / identity */}
      <div
        style={{
          borderRadius: 16,
          padding: spacing.md,
          background: colors.panel,
          border: `1px solid ${colors.border}`,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 0.08,
              color: text.muted,
              marginBottom: 4,
            }}
          >
            Application
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: text.primary,
            }}
          >
            {primaryName}
            {coAppCount > 0 && (
              <span
                style={{
                  fontSize: 13,
                  color: text.muted,
                  marginLeft: 6,
                }}
              >
                (+{coAppCount} co-applicant{coAppCount > 1 ? "s" : ""})
              </span>
            )}
          </div>
        <div
          style={{
            fontSize: 13,
            color: text.muted,
            marginTop: 2,
          }}
        >
          {application.propertyName} Â· Unit{" "}
          {application.unitApplied || application.unit || application.unitLabel || "â€”"}
          {application.coSignerName && application.coSignerName.trim() && (
            <span style={{ color: text.subtle }}>
              {" "}
              Â· Co-signed by {application.coSignerName}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 12,
            color: text.subtle,
            marginTop: 4,
            }}
          >
            Submitted on {application.createdAt ? new Date(application.createdAt).toLocaleDateString() : "N/A"}
          </div>
          {applicantsList.length > 1 && (
            <div
              style={{
                marginTop: 8,
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
              }}
            >
              {applicantsList.map((appl, index) => {
                const isActive = index === selectedApplicantIndex;
                const isPrimary = appl.role === "primary";
                return (
                  <button
                    key={appl.id || `${appl.fullName}-${index}`}
                    type="button"
                    onClick={() => setSelectedApplicantIndex(index)}
                    style={{
                    padding: "3px 9px",
                    borderRadius: 999,
                    border: isActive
                        ? `1px solid ${colors.accent}`
                        : `1px solid ${colors.border}`,
                    backgroundColor: isActive
                        ? colors.accentSoft
                        : colors.card,
                    color: isActive ? text.primary : text.muted,
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                    {isPrimary ? "Primary" : "Co-app"}: {appl.fullName}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Status + convert */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          {/* Status pill */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 10px",
              borderRadius: 999,
              backgroundColor: colors.card,
              border: `1px solid ${colors.border}`,
              fontSize: 12,
              color: text.primary,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "999px",
                backgroundColor:
                  application.status === "approved"
                    ? "#22c55e"
                    : application.status === "rejected"
                    ? "#ef4444"
                    : application.status === "in_review"
                    ? "#eab308"
                    : "#60a5fa",
              }}
            />
            <span>{statusLabel[application.status]}</span>
          </div>

          <ConvertToTenantButton
            applicationId={application.id}
            applicationStatus={application.status}
            convertedTenantId={(application as any).convertedTenantId || null}
          />
        </div>
      </div>

      <div
        style={{
          borderRadius: 12,
          padding: spacing.sm,
          background: colors.panel,
          border: `1px solid ${colors.border}`,
          display: "flex",
          flexDirection: "column",
          gap: spacing.sm,
        }}
      >
        <div
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: 0.08,
            color: text.muted,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>Required for credit report</span>
          <span style={{ fontSize: 11, color: text.subtle }}>
            Missing {combinedMissing.length}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0,1fr))",
            gap: spacing.xs,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 12, color: text.subtle }}>Unit applied *</div>
            <input
              type="text"
              value={requiredFields.unitApplied}
              onChange={(e) =>
                setRequiredFields((prev) => ({
                  ...prev,
                  unitApplied: e.target.value,
                }))
              }
              style={requiredFieldInputStyle}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 12, color: text.subtle }}>Lease start date *</div>
            <input
              type="date"
              value={requiredFields.leaseStartDate}
              onChange={(e) =>
                setRequiredFields((prev) => ({
                  ...prev,
                  leaseStartDate: e.target.value,
                }))
              }
              style={requiredFieldInputStyle}
            />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0,1fr))",
            gap: spacing.xs,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 12, color: text.subtle }}>First name *</div>
            <input
              type="text"
              value={requiredFields.firstName}
              onChange={(e) =>
                setRequiredFields((prev) => ({
                  ...prev,
                  firstName: e.target.value,
                }))
              }
              style={requiredFieldInputStyle}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 12, color: text.subtle }}>Last name *</div>
            <input
              type="text"
              value={requiredFields.lastName}
              onChange={(e) =>
                setRequiredFields((prev) => ({
                  ...prev,
                  lastName: e.target.value,
                }))
              }
              style={requiredFieldInputStyle}
            />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0,1fr))",
            gap: spacing.xs,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 12, color: text.subtle }}>Middle name</div>
            <input
              type="text"
              value={requiredFields.middleName}
              onChange={(e) =>
                setRequiredFields((prev) => ({
                  ...prev,
                  middleName: e.target.value,
                }))
              }
              style={requiredFieldInputStyle}
              placeholder="Optional"
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 12, color: text.subtle }}>Date of birth *</div>
            <input
              type="date"
              value={requiredFields.dateOfBirth}
              onChange={(e) =>
                setRequiredFields((prev) => ({
                  ...prev,
                  dateOfBirth: e.target.value,
                }))
              }
              style={requiredFieldInputStyle}
            />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0,1fr))",
            gap: spacing.xs,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 12, color: text.subtle }}>Street number *</div>
            <input
              type="text"
              value={requiredFields.streetNumber}
              onChange={(e) =>
                setRequiredFields((prev) => ({
                  ...prev,
                  streetNumber: e.target.value,
                }))
              }
              style={requiredFieldInputStyle}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 12, color: text.subtle }}>Street name *</div>
            <input
              type="text"
              value={requiredFields.streetName}
              onChange={(e) =>
                setRequiredFields((prev) => ({
                  ...prev,
                  streetName: e.target.value,
                }))
              }
              style={requiredFieldInputStyle}
            />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0,1fr))",
            gap: spacing.xs,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 12, color: text.subtle }}>City *</div>
            <input
              type="text"
              value={requiredFields.city}
              onChange={(e) =>
                setRequiredFields((prev) => ({
                  ...prev,
                  city: e.target.value,
                }))
              }
              style={requiredFieldInputStyle}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 12, color: text.subtle }}>Province *</div>
            <input
              type="text"
              value={requiredFields.province}
              onChange={(e) =>
                setRequiredFields((prev) => ({
                  ...prev,
                  province: e.target.value,
                }))
              }
              style={requiredFieldInputStyle}
            />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0,1fr))",
            gap: spacing.xs,
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 12, color: text.subtle }}>Postal code *</div>
            <input
              type="text"
              value={requiredFields.postalCode}
              onChange={(e) =>
                setRequiredFields((prev) => ({
                  ...prev,
                  postalCode: e.target.value,
                }))
              }
              style={requiredFieldInputStyle}
            />
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: text.primary,
            }}
          >
            <input
              type="checkbox"
              checked={requiredFields.consentCreditCheck}
              onChange={(e) =>
                setRequiredFields((prev) => ({
                  ...prev,
                  consentCreditCheck: e.target.checked,
                }))
              }
              style={{ width: 18, height: 18 }}
            />
            Applicant consent to pull credit (required)
          </label>
        </div>

        {combinedMissing.length > 0 && (
          <div
            style={{
              fontSize: 12,
              color: colors.danger,
              background: "rgba(239,68,68,0.08)",
              border: `1px solid rgba(239,68,68,0.35)`,
              borderRadius: 10,
              padding: "6px 8px",
            }}
          >
            Missing: {combinedMissing.join(", ")}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={handleSaveRequiredFields}
            disabled={isSavingRequired || !hasChanges}
            style={{
              padding: "7px 12px",
              borderRadius: 10,
              border: `1px solid ${colors.accent}`,
              background: isSavingRequired ? colors.accentSoft : colors.accent,
              color: "#fff",
              fontWeight: 600,
              fontSize: 13,
              cursor: isSavingRequired || !hasChanges ? "not-allowed" : "pointer",
              opacity: isSavingRequired || !hasChanges ? 0.7 : 1,
            }}
          >
            {isSavingRequired ? "Saving..." : "Save required fields"}
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0,1fr))",
          gap: 10,
        }}
      >
        <div
          style={{
            borderRadius: 12,
            padding: 10,
            backgroundColor: colors.panel,
            border: `1px solid ${colors.border}`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 0.08,
              color: text.muted,
            }}
          >
            Monthly rent
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 14,
              fontWeight: 600,
              color: text.primary,
            }}
          >
            ${rentAmount.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>

        <div
          style={{
            borderRadius: 12,
            padding: 10,
            backgroundColor: colors.panel,
            border: `1px solid ${colors.border}`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 0.08,
              color: text.muted,
            }}
          >
            Monthly income
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 14,
              fontWeight: 600,
              color: applicantsTotalIncome ? text.primary : text.subtle,
            }}
          >
            {applicantsTotalIncome
              ? `$${applicantsTotalIncome.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              : "Not provided"}
          </div>
        </div>

        <div
          style={{
            borderRadius: 12,
            padding: 10,
            backgroundColor: colors.panel,
            border: `1px solid ${colors.border}`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 0.08,
              color: text.muted,
            }}
          >
            Income / rent ratio
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 14,
              fontWeight: 600,
              color: ratio && ratio >= 3 ? "#22c55e" : text.primary,
            }}
          >
            {ratio ? `${ratio.toFixed(1)}x` : "N/A"}
          </div>
        </div>
      </div>

      {/* Co-signer strip */}
      <div
        style={{
          marginTop: 8,
          borderRadius: 12,
          padding: 10,
          backgroundColor: colors.panel,
          border: `1px solid ${colors.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 0.08,
              color: text.muted,
            }}
          >
            Co-signer
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 13,
              fontWeight: 500,
              color:
                application.coSignerName && application.coSignerName.trim()
                  ? text.primary
                  : text.subtle,
            }}
          >
            {application.coSignerName && application.coSignerName.trim()
              ? application.coSignerName
              : "None"}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 2,
            fontSize: 12,
            color: text.muted,
          }}
        >
          {application.coSignerMonthlyIncome != null && (
            <div>
              Income: $
              {application.coSignerMonthlyIncome.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          )}
          {application.coSignerRelationship && (
            <div>{application.coSignerRelationship}</div>
          )}
        </div>
      </div>

      {/* Status controls */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginTop: 4,
        }}
      >
        {(["new", "in_review", "approved", "rejected"] as ApplicationStatus[]).map(
          (status) => (
            <button
              key={status}
              type="button"
              onClick={() => onStatusChange(status)}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                border:
                  application.status === status
                    ? `1px solid ${colors.accent}`
                    : `1px solid ${colors.border}`,
                backgroundColor:
                  application.status === status
                    ? colors.accentSoft
                    : colors.card,
                color:
                  application.status === status ? text.primary : text.muted,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {statusLabel[status]}
            </button>
          )
        )}
      </div>

      {/* Screening */}
      {!SCREENING_ENABLED ? (
        <div
          style={{
            marginTop: 12,
            borderRadius: 14,
            padding: 12,
            background: colors.panel,
            border: `1px solid ${colors.border}`,
          }}
        >
          <div
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: 0.08,
              color: text.muted,
              marginBottom: 6,
            }}
          >
            Screening
          </div>
          <div style={{ fontSize: 13, color: text.primary }}>
            Credit screening — coming soon
          </div>
        </div>
      ) : canUseAiScreening ? (
        <div
          style={{
            marginTop: 12,
            borderRadius: 14,
            padding: 12,
            background: colors.panel,
            border: `1px solid ${colors.border}`,
          }}
        >
          <div
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: 0.08,
              color: text.muted,
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>AI screening summary</span>
            <span
              style={{
                fontSize: 11,
                color: text.subtle,
              }}
            >
              Summary for application review
            </span>
          </div>
          <div style={{ fontSize: 12, color: text.subtle, marginBottom: 6 }}>
            Status: {formatScreeningState((application as any)?.screeningStatus)}
          </div>

          {screeningInsights.length === 0 ? (
            <div
              style={{
                fontSize: 13,
                color: text.subtle,
              }}
            >
              Not enough information yet to generate insights.
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {screeningInsights.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    fontSize: 13,
                    color: text.primary,
                  }}
                >
                  <span
                    style={{
                      marginTop: 3,
                      width: 8,
                      height: 8,
                      borderRadius: "999px",
                      display: "inline-block",
                      backgroundColor:
                        item.severity === "good"
                          ? "#22c55e"
                          : item.severity === "medium"
                          ? "#eab308"
                          : "#ef4444",
                      boxShadow:
                        item.severity === "good"
                          ? "0 0 0 3px rgba(34,197,94,0.25)"
                          : item.severity === "medium"
                          ? "0 0 0 3px rgba(234,179,8,0.25)"
                          : "0 0 0 3px rgba(239,68,68,0.25)",
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontWeight: 500,
                        color: text.primary,
                      }}
                    >
                      {item.title}
                    </div>
                    {item.detail && (
                      <div
                        style={{
                          marginTop: 2,
                          fontSize: 12,
                          color: text.subtle,
                        }}
                      >
                        {item.detail}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            borderRadius: 16,
            border: `1px solid ${colors.border}`,
            padding: 12,
            marginTop: 8,
            backgroundColor: colors.panel,
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: text.primary,
              marginBottom: 4,
              fontWeight: 500,
            }}
          >
            AI screening is available on Pro plans
          </div>
          <div
            style={{
              fontSize: 12,
              color: text.muted,
            }}
          >
            Upgrade to <span style={{ fontWeight: 500 }}>Pro</span> or{" "}
            <span style={{ fontWeight: 500 }}>Elite</span> to see a smart summary of
            income, affordability, co-signer strength, and risk signals for each
            application.
          </div>
        </div>
      )}

      {/* Applicant details & references */}
      <div
        style={{
          marginTop: 12,
          borderRadius: 14,
          padding: 12,
          backgroundColor: colors.panel,
          border: `1px solid ${colors.border}`,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: 0.08,
            color: text.muted,
            marginBottom: 4,
          }}
        >
          Applicant details & references
        </div>

        {/* Personal & address */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0,1fr))",
            gap: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 0.08,
                color: text.muted,
              }}
            >
              Date of birth
            </div>
            <div
              style={{
                marginTop: 3,
              fontSize: 13,
              color:
                currentApplicant?.dateOfBirth || application.dateOfBirth
                  ? "#e5e7eb"
                  : "#6b7280",
            }}
          >
            {currentApplicant?.dateOfBirth ||
              application.dateOfBirth ||
              "Not provided"}
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 0.08,
                color: "#9ca3af",
              }}
            >
              Social Insurance Number
            </div>
            <div
              style={{
                marginTop: 3,
              fontSize: 13,
              color: maskedSin ? "#e5e7eb" : "#6b7280",
            }}
          >
            {maskedSin || "Not provided"}
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 0.08,
                color: "#9ca3af",
              }}
            >
              Current address
            </div>
            <div
              style={{
                marginTop: 3,
              fontSize: 13,
              color:
                currentApplicant?.currentAddress || application.currentAddress
                  ? "#e5e7eb"
                  : "#6b7280",
            }}
          >
              {currentApplicant?.currentAddress ||
                application.currentAddress ||
                "Not provided"}
              {(currentApplicant?.currentCity ||
                currentApplicant?.currentProvince ||
                currentApplicant?.currentPostalCode ||
                application.currentCity ||
                application.currentProvince ||
                application.currentPostalCode) && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#9ca3af",
                    marginTop: 2,
                  }}
                >
                  {[
                    currentApplicant?.currentCity || application.currentCity,
                    currentApplicant?.currentProvince ||
                      application.currentProvince,
                  ]
                    .filter(Boolean)
                    .join(", ")}{" "}
                  {currentApplicant?.currentPostalCode ||
                    application.currentPostalCode}
                </div>
              )}
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 0.08,
                color: "#9ca3af",
              }}
            >
              Vehicle
            </div>
            <div
              style={{
                marginTop: 3,
              fontSize: 13,
              color:
                  currentApplicant?.vehicleMake ||
                  currentApplicant?.vehicleModel ||
                  currentApplicant?.vehiclePlate ||
                  application.vehicleMake ||
                  application.vehicleModel ||
                  application.vehiclePlate
                    ? "#e5e7eb"
                    : "#6b7280",
            }}
          >
              {currentApplicant?.vehicleMake ||
              currentApplicant?.vehicleModel ||
              currentApplicant?.vehiclePlate ||
              application.vehicleMake ||
              application.vehicleModel ||
              application.vehiclePlate
                ? `${[
                    currentApplicant?.vehicleYear || application.vehicleYear,
                    currentApplicant?.vehicleMake || application.vehicleMake,
                    currentApplicant?.vehicleModel || application.vehicleModel,
                  ]
                    .filter(Boolean)
                    .join(" ")}${
                    currentApplicant?.vehiclePlate || application.vehiclePlate
                      ? ` Â· Plate ${
                          currentApplicant?.vehiclePlate ||
                          application.vehiclePlate
                        }`
                      : ""
                  }`
                : "No vehicle info"}
          </div>
        </div>
        </div>

        <div
          style={{
            marginTop: 8,
            padding: spacing.sm,
            borderRadius: 12,
            border: `1px solid ${colors.border}`,
            background: colors.panel,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: 0.08,
              color: text.muted,
            }}
          >
            References
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: text.primary,
            }}
          >
            <input
              type="checkbox"
              checked={referencesContacted}
              onChange={(e) => setReferencesContacted(e.target.checked)}
              style={{ width: 18, height: 18 }}
              disabled={isSavingReferences}
            />
            References contacted
          </label>
          <textarea
            value={referencesNotes}
            onChange={(e) => setReferencesNotes(e.target.value)}
            placeholder="Notes about the reference call..."
            rows={3}
            style={{
              width: "100%",
              padding: "0.5rem 0.6rem",
              borderRadius: 10,
              border: `1px solid ${colors.border}`,
              background: colors.card,
              color: text.primary,
              fontSize: 13,
              resize: "vertical",
              minHeight: 72,
            }}
            disabled={isSavingReferences}
          />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={handleSaveReferences}
              disabled={isSavingReferences}
              style={{
                padding: "6px 12px",
                borderRadius: 10,
                border: `1px solid ${colors.accent}`,
                background: isSavingReferences ? colors.accentSoft : colors.accent,
                color: "#fff",
                fontWeight: 600,
                fontSize: 13,
                cursor: isSavingReferences ? "not-allowed" : "pointer",
                opacity: isSavingReferences ? 0.7 : 1,
              }}
            >
              {isSavingReferences ? "Saving..." : "Save references"}
            </button>
          </div>
        </div>

        {/* References & notes */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0,1fr))",
            gap: 10,
            marginTop: 8,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 0.08,
                color: "#9ca3af",
              }}
            >
              Landlord reference
            </div>
            <div
              style={{
                marginTop: 3,
              fontSize: 13,
              color:
                currentApplicant?.landlordReferenceName ||
                application.landlordReferenceName
                  ? "#e5e7eb"
                  : "#6b7280",
            }}
          >
              {currentApplicant?.landlordReferenceName ||
                application.landlordReferenceName ||
                "Not provided"}
              {(currentApplicant?.landlordReferencePhone ||
                application.landlordReferencePhone) && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#9ca3af",
                    marginTop: 2,
                  }}
                >
                  {currentApplicant?.landlordReferencePhone ||
                    application.landlordReferencePhone}
                </div>
              )}
          </div>
        </div>

          <div>
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 0.08,
                color: "#9ca3af",
              }}
            >
              Employment reference
            </div>
            <div
              style={{
                marginTop: 3,
              fontSize: 13,
              color:
                currentApplicant?.employmentReferenceName ||
                application.employmentReferenceName
                  ? "#e5e7eb"
                  : "#6b7280",
            }}
          >
              {currentApplicant?.employmentReferenceName ||
                application.employmentReferenceName ||
                "Not provided"}
              {(currentApplicant?.employmentReferencePhone ||
                application.employmentReferencePhone) && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#9ca3af",
                    marginTop: 2,
                  }}
                >
                  {currentApplicant?.employmentReferencePhone ||
                    application.employmentReferencePhone}
                </div>
              )}
          </div>
        </div>

          <div>
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 0.08,
                color: "#9ca3af",
              }}
            >
              Bank reference
            </div>
            <div
              style={{
                marginTop: 3,
              fontSize: 13,
              color:
                currentApplicant?.bankReferenceName ||
                application.bankReferenceName
                  ? "#e5e7eb"
                  : "#6b7280",
            }}
          >
              {currentApplicant?.bankReferenceName ||
                application.bankReferenceName ||
                "Not provided"}
              {(currentApplicant?.bankReferenceAccountMasked ||
                application.bankReferenceAccountMasked) && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#9ca3af",
                    marginTop: 2,
                  }}
                >
                  {currentApplicant?.bankReferenceAccountMasked ||
                    application.bankReferenceAccountMasked}
                </div>
              )}
          </div>
        </div>
        </div>

        <div
          style={{
            marginTop: 8,
          }}
        >
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 0.08,
              color: "#9ca3af",
            }}
          >
            Notes
          </div>
          <div
            style={{
              marginTop: 3,
              fontSize: 13,
              color:
                currentApplicant?.notes || application.notes
                  ? "#e5e7eb"
                  : "#6b7280",
            }}
          >
            {currentApplicant?.notes ||
              application.notes ||
              "No notes recorded for this application."}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.xs,
          }}
        >
          <div
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: 0.08,
              color: "#9ca3af",
            }}
          >
            Activity
          </div>
          <button
            type="button"
            onClick={() => setTimelineOpen((open) => !open)}
            style={{
              border: `1px solid ${colors.border}`,
              background: colors.panel,
              color: text.primary,
              borderRadius: radius.sm,
              padding: "4px 8px",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {timelineOpen ? "Hide timeline" : "Show timeline"}
          </button>
        </div>
        {timelineOpen &&
          (timeline.length === 0 ? (
            <div
              style={{
                fontSize: 13,
                color: "#6b7280",
                marginTop: 6,
              }}
            >
              No activity yet for this application.
            </div>
          ) : (
            <div
              style={{
                position: "relative",
                paddingLeft: 18,
                borderLeft: "1px solid rgba(55,65,81,0.7)",
                marginLeft: 4,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginTop: 8,
              }}
            >
              {timeline.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    position: "relative",
                    paddingLeft: 10,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: -9,
                      top: 6,
                      width: 10,
                      height: 10,
                      borderRadius: "999px",
                      backgroundColor:
                        entry.status === "approved"
                          ? "#22c55e"
                          : entry.status === "rejected"
                          ? "#ef4444"
                          : entry.status === "in_review"
                          ? "#eab308"
                          : "#38bdf8",
                      boxShadow: "0 0 0 3px rgba(37,99,235,0.12)",
                    }}
                  />
                  <div
                    style={{
                      padding: "6px 10px",
                      borderRadius: 10,
                      backgroundColor: colors.panel,
                      border: `1px solid ${colors.border}`,
                      fontSize: 13,
                      color: text.primary,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: text.muted,
                        marginBottom: 2,
                      }}
                    >
                      {new Date(entry.date).toLocaleString()}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span>{entry.label}</span>
                      {entry.actor && (
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 6px",
                            borderRadius: radius.sm,
                            background: "rgba(148,163,184,0.16)",
                            color: "#cbd5e1",
                          }}
                        >
                          {entry.actor}
                        </span>
                      )}
                    </div>
                    {entry.notes && (
                      <div
                        style={{
                          marginTop: 2,
                          fontSize: 12,
                          color: text.subtle,
                        }}
                      >
                        {entry.notes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
      </div>
    </div>
  );
};

