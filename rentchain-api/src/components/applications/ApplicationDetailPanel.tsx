import React from "react";
import type {
  Application,
  ApplicationStatus,
  ApplicationTimelineEntry,
} from "../../types/applications";

type ApplicationDetailPanelProps = {
  application: Application | null;
  timeline: ApplicationTimelineEntry[];
  onStatusChange: (status: ApplicationStatus) => void;
  onConvertToTenant: () => void;
  isConverting: boolean;
};

const statusLabel: Record<ApplicationStatus, string> = {
  New: "New",
  "In Review": "In review",
  Approved: "Approved",
  Rejected: "Rejected",
};

export const ApplicationDetailPanel: React.FC<ApplicationDetailPanelProps> = ({
  application,
  timeline,
  onStatusChange,
  onConvertToTenant,
  isConverting,
}) => {
  if (!application) {
    return (
      <div
        style={{
          padding: 24,
          color: "#9ca3af",
          fontSize: 14,
        }}
      >
        Select an application to view details.
      </div>
    );
  }

  const rentAmount = application.requestedRent ?? 0;
  const ratio =
    application.monthlyIncome && rentAmount
      ? application.monthlyIncome / rentAmount
      : null;

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: 16,
        gap: 16,
        background:
          "radial-gradient(circle at top, #020617 0, #020617 40%, #020617 100%)",
        borderLeft: "1px solid rgba(15,23,42,0.9)",
      }}
    >
      {/* Header / identity */}
      <div
        style={{
          borderRadius: 16,
          padding: 16,
          background:
            "radial-gradient(circle at top left, rgba(56,189,248,0.18) 0, rgba(15,23,42,0.95) 45%, rgba(2,6,23,1) 100%)",
          border: "1px solid rgba(148,163,184,0.4)",
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
              color: "#9ca3af",
              marginBottom: 4,
            }}
          >
            Application
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "#e5e7eb",
            }}
          >
            {application.fullName}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "#9ca3af",
              marginTop: 2,
            }}
          >
            {application.propertyName} · Unit {application.unit}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#6b7280",
              marginTop: 4,
            }}
          >
            Submitted on{" "}
            {application.createdAt
              ? new Date(application.createdAt).toLocaleDateString()
              : "N/A"}
          </div>
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
              backgroundColor: "rgba(15,23,42,0.9)",
              border: "1px solid rgba(148,163,184,0.6)",
              fontSize: 12,
              color: "#e5e7eb",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "999px",
                backgroundColor:
                  application.status === "Approved"
                    ? "#22c55e"
                    : application.status === "Rejected"
                    ? "#ef4444"
                    : application.status === "In Review"
                    ? "#eab308"
                    : "#60a5fa",
              }}
            />
            <span>{statusLabel[application.status]}</span>
          </div>

          {/* Convert button */}
          <button
            type="button"
            onClick={onConvertToTenant}
            disabled={isConverting || application.status === "Rejected"}
            style={{
              padding: "7px 14px",
              borderRadius: 999,
              border: "none",
              background:
                "linear-gradient(135deg, #38bdf8 0%, #6366f1 40%, #a855f7 100%)",
              color: "#0b1120",
              fontSize: 13,
              fontWeight: 600,
              cursor:
                isConverting || application.status === "Rejected"
                  ? "not-allowed"
                  : "pointer",
              opacity:
                isConverting || application.status === "Rejected" ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {isConverting ? "Converting…" : "Convert to tenant"}
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
            backgroundColor: "rgba(15,23,42,0.9)",
            border: "1px solid rgba(31,41,55,1)",
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
            Monthly rent
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 14,
              fontWeight: 600,
              color: "#e5e7eb",
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
            backgroundColor: "rgba(15,23,42,0.9)",
            border: "1px solid rgba(31,41,55,1)",
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
            Monthly income
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 14,
              fontWeight: 600,
              color: application.monthlyIncome ? "#e5e7eb" : "#6b7280",
            }}
          >
            {application.monthlyIncome
              ? `$${application.monthlyIncome.toLocaleString(undefined, {
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
            backgroundColor: "rgba(15,23,42,0.9)",
            border: "1px solid rgba(31,41,55,1)",
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
            Income / rent ratio
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 14,
              fontWeight: 600,
              color: ratio && ratio >= 3 ? "#22c55e" : "#eab308",
            }}
          >
            {ratio ? `${ratio.toFixed(1)}x` : "N/A"}
          </div>
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
        {(["New", "In Review", "Approved", "Rejected"] as ApplicationStatus[]).map(
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
                    ? "1px solid rgba(96,165,250,0.9)"
                    : "1px solid rgba(75,85,99,0.9)",
                backgroundColor:
                  application.status === status
                    ? "rgba(37,99,235,0.25)"
                    : "rgba(15,23,42,0.9)",
                color:
                  application.status === status ? "#e5e7eb" : "#9ca3af",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {statusLabel[status]}
            </button>
          )
        )}
      </div>

      {/* Timeline */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <div
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: 0.08,
            color: "#9ca3af",
            marginBottom: 6,
          }}
        >
          Activity
        </div>
        {timeline.length === 0 ? (
          <div
            style={{
              fontSize: 13,
              color: "#6b7280",
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
                      entry.status === "Approved"
                        ? "#22c55e"
                        : entry.status === "Rejected"
                        ? "#ef4444"
                        : entry.status === "In Review"
                        ? "#eab308"
                        : "#38bdf8",
                    boxShadow: "0 0 0 3px rgba(15,23,42,0.6)",
                  }}
                />
                <div
                  style={{
                    padding: "6px 10px",
                    borderRadius: 10,
                    backgroundColor: "rgba(15,23,42,0.9)",
                    border: "1px solid rgba(55,65,81,0.9)",
                    fontSize: 13,
                    color: "#e5e7eb",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: "#9ca3af",
                      marginBottom: 2,
                    }}
                  >
                    {entry.date}
                  </div>
                  <div>{entry.label}</div>
                  {entry.notes && (
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 12,
                        color: "#9ca3af",
                      }}
                    >
                      {entry.notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
