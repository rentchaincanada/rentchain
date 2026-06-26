import React from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Ui";
import {
  ReviewAssignmentStatusControls,
  type ReviewAssignmentTarget,
  type ReviewLifecycleStatus,
} from "./ReviewAssignmentStatusControls";

export type ReviewWorkspaceUiLink = {
  label: string;
  destination?: string | null;
  sensitivityClass?: "sensitive" | "restricted" | string | null;
};

export type ReviewWorkspaceUiResource = {
  label: string;
  resourceType: string;
};

export type ReviewWorkspaceUiModel = {
  workspaceReference: string;
  workspaceType: string;
  reviewStatus: string;
  reviewPriority: string;
  routingReason: string;
  assignmentLabel: string;
  manualReviewScope: string;
  manualReviewScopeId: string;
  sensitivityClass: "sensitive" | "restricted" | string;
  visibilityClass: "landlord_operational" | "admin_support" | string;
  manualOnly: true;
  autonomousActionsEnabled: false;
  evidenceLinks: ReviewWorkspaceUiLink[];
  relatedResources: ReviewWorkspaceUiResource[];
};

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function safeLabel(value: string, fallback: string) {
  const raw = String(value || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  if (!raw) return fallback;
  if (/^(Lease|Property|Tenant|Unit|Decision)\s+[A-Za-z0-9:_-]{12,}$/i.test(raw)) return fallback;
  return raw;
}

function metadataCell(labelText: string, value: string) {
  return (
    <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
      <span style={{ color: "#64748b", fontSize: 13, fontWeight: 900, textTransform: "uppercase", lineHeight: 1.4 }}>{labelText}</span>
      <span style={{ color: "#0f172a", fontSize: 15, fontWeight: 900, overflowWrap: "anywhere", lineHeight: 1.4 }}>{value}</span>
    </div>
  );
}

export function ReviewWorkspacePanel({
  workspace,
  onManualReviewChange,
}: {
  workspace: ReviewWorkspaceUiModel;
  onManualReviewChange?: (
    workspace: ReviewWorkspaceUiModel,
    next: { status: ReviewLifecycleStatus; assignment: ReviewAssignmentTarget }
  ) => void | Promise<void>;
}) {
  return (
    <Card
      style={{
        borderRadius: 8,
        padding: 12,
        background: "#f8fafc",
        border: "1px solid #dbe3ef",
        display: "grid",
        gap: 10,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "start" }}>
        <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
          <strong style={{ color: "#0f172a", fontSize: 14 }}>Review workspace readiness</strong>
          <span style={{ color: "#475569", fontSize: 13, lineHeight: 1.45 }}>
            Manual-only review context. This panel does not create a workspace, route work automatically, or change source records.
          </span>
        </div>
        <span
          style={{
            border: "1px solid #bfdbfe",
            background: "#dbeafe",
            color: "#1d4ed8",
            borderRadius: 999,
            padding: "8px 12px",
            fontSize: 13,
            fontWeight: 900,
            whiteSpace: "nowrap",
            minHeight: 44,
            display: "inline-flex",
            alignItems: "center",
            lineHeight: 1.4,
          }}
        >
          Manual only
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
          gap: 8,
          minWidth: 0,
        }}
      >
        {metadataCell("Workspace type", label(workspace.workspaceType))}
        {metadataCell("Review status", workspace.reviewStatus)}
        {metadataCell("Priority", workspace.reviewPriority)}
        {metadataCell("Routing reason", workspace.routingReason)}
        {metadataCell("Assignment", workspace.assignmentLabel)}
        {metadataCell("Sensitivity", label(workspace.sensitivityClass))}
        {metadataCell("Visibility", label(workspace.visibilityClass))}
      </div>

      <ReviewAssignmentStatusControls
        itemId={workspace.workspaceReference}
        title={label(workspace.workspaceType)}
        initialStatus={workspace.reviewStatus}
        initialAssignment={workspace.assignmentLabel}
        onChange={(next) => onManualReviewChange?.(workspace, next)}
      />

      <div style={{ display: "grid", gap: 5, minWidth: 0 }}>
        <span style={{ color: "#334155", fontSize: 12, fontWeight: 900 }}>Scoped evidence linkage</span>
        {workspace.evidenceLinks.length ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {workspace.evidenceLinks.map((link) =>
              link.destination ? (
                <Link key={`${link.label}:${link.destination}`} to={link.destination} style={{
                  color: "#2563eb",
                  fontSize: 14,
                  fontWeight: 900,
                  padding: "8px 0",
                  minHeight: 44,
                  display: "inline-flex",
                  alignItems: "center",
                  textDecoration: "none",
                  borderRadius: 4,
                  lineHeight: 1.4,
                }}>
                  {safeLabel(link.label, "Source workflow evidence")}
                </Link>
              ) : (
                <span key={link.label} style={{
                  color: "#475569",
                  fontSize: 14,
                  fontWeight: 800,
                  padding: "8px 0",
                  minHeight: 44,
                  display: "inline-flex",
                  alignItems: "center",
                  lineHeight: 1.4,
                }}>
                  {safeLabel(link.label, "Source workflow evidence")}
                </span>
              )
            )}
          </div>
        ) : (
          <span style={{ color: "#64748b", fontSize: 13 }}>Evidence can be attached during a manual review handoff.</span>
        )}
      </div>

      <div style={{ display: "grid", gap: 5, minWidth: 0 }}>
        <span style={{ color: "#334155", fontSize: 12, fontWeight: 900 }}>Related resources</span>
        {workspace.relatedResources.length ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {workspace.relatedResources.map((resource) => (
              <span
                key={`${resource.resourceType}:${resource.label}`}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 999,
                  padding: "8px 12px",
                  color: "#475569",
                  fontSize: 13,
                  fontWeight: 800,
                  background: "#fff",
                  minHeight: 44,
                  display: "inline-flex",
                  alignItems: "center",
                  lineHeight: 1.4,
                }}
              >
                {safeLabel(resource.label, `${label(resource.resourceType)} context`)}
              </span>
            ))}
          </div>
        ) : (
          <span style={{ color: "#64748b", fontSize: 13 }}>No related resources are displayed outside the scoped source workflow.</span>
        )}
      </div>

      <div style={{ color: "#64748b", fontSize: 12 }}>
        Internal workspace reference: Manual review handoff preview
      </div>
    </Card>
  );
}
