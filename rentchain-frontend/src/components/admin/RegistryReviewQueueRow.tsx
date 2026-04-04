import React, { memo } from "react";
import { Link } from "react-router-dom";
import { Button, Pill } from "../ui/Ui";
import type { RegistryReviewItem } from "../../api/adminRegistryApi";

const rowStyle: React.CSSProperties = {
  border: "1px solid rgba(148,163,184,0.18)",
  borderRadius: 16,
  padding: 16,
  display: "grid",
  gap: 8,
  background: "#fff",
};

const rowHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const mutedTextStyle: React.CSSProperties = { color: "#64748b", fontSize: 13 };
const bodyTextStyle: React.CSSProperties = { color: "#475569", fontSize: 14 };
const linkedPropertyStyle: React.CSSProperties = { color: "#0f172a", fontSize: 13, fontWeight: 600 };
const notesStyle: React.CSSProperties = { color: "#92400e", fontSize: 14 };

function formatLocation(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(", ");
}

export const RegistryReviewQueueRow = memo(function RegistryReviewQueueRow({ item }: { item: RegistryReviewItem }) {
  const propertyAddress = item.property
    ? formatLocation([item.property.addressLine1, item.property.city, item.property.province, item.property.postalCode])
    : "";
  const candidateAddress = item.topCandidate
    ? formatLocation([item.topCandidate.addressLine1, item.topCandidate.city, item.topCandidate.province, item.topCandidate.postalCode])
    : "";

  return (
    <div style={rowStyle}>
      <div style={rowHeaderStyle}>
        <div>
          <div style={{ fontWeight: 700 }}>{item.normalizedRecord?.addressRaw || item.match.registryRecordId}</div>
          <div style={mutedTextStyle}>{item.normalizedRecord?.registrationNumber || item.match.registryRecordId}</div>
        </div>
        <Pill tone={item.match.matchStatus === "matched" ? "accent" : "muted"}>{item.match.matchStatus}</Pill>
      </div>
      <div style={bodyTextStyle}>
        Method: {item.match.matchMethod || "--"} · Score: {item.match.matchScore || 0}
      </div>
      <div style={bodyTextStyle}>Property: {item.property?.name || item.property?.addressLine1 || item.match.propertyId || "--"}</div>
      {item.property ? (
        <div style={mutedTextStyle}>
          Property document ID: {item.property.id} · Property PID: {item.property.pid || "--"} · Address: {propertyAddress}
        </div>
      ) : null}
      {item.normalizedRecord ? (
        <div style={mutedTextStyle}>
          Registry PID: {item.normalizedRecord.pid || "--"} · Registration number: {item.normalizedRecord.registrationNumber || "--"}
        </div>
      ) : null}
      {item.topCandidate ? (
        <div style={bodyTextStyle}>
          Top candidate: {item.topCandidate.propertyName || item.topCandidate.addressLine1 || item.topCandidate.propertyId}
        </div>
      ) : null}
      {item.topCandidate ? (
        <div style={mutedTextStyle}>
          Property document ID: {item.topCandidate.propertyId} · Property PID: {item.topCandidate.pid || "--"} · Units:{" "}
          {item.topCandidate.unitCount ?? "--"} · Address: {candidateAddress}
        </div>
      ) : null}
      {item.match.propertyId ? <div style={linkedPropertyStyle}>Currently linked property is active for this record.</div> : null}
      {item.reasonSummary?.length ? <div style={notesStyle}>Review notes: {item.reasonSummary.join(" ")}</div> : null}
      {!item.property && item.topCandidate ? <div style={bodyTextStyle}>Candidate score: {item.topCandidate.score}</div> : null}
      <div style={actionRowStyle}>
        <Link to={`/admin/registry/records/${encodeURIComponent(item.match.normalizedRecordId)}`}>
          <Button variant="secondary">Open record</Button>
        </Link>
        {item.match.propertyId ? (
          <Link to={`/admin/registry/properties/${encodeURIComponent(item.match.propertyId)}`}>
            <Button variant="secondary">Open property review</Button>
          </Link>
        ) : item.topCandidate ? (
          <Link
            to={`/admin/registry/properties/${encodeURIComponent(item.topCandidate.propertyId)}?normalizedRecordId=${encodeURIComponent(
              item.match.normalizedRecordId
            )}`}
          >
            <Button variant="secondary">Open candidate review</Button>
          </Link>
        ) : null}
      </div>
    </div>
  );
});
