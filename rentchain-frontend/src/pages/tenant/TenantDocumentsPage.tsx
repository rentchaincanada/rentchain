import React, { useEffect, useState } from "react";
import { getTenantDocuments, TenantDocument } from "../../api/tenantPortalApi";
import { useTenantOutletContext } from "./TenantLayout.clean";

const cardStyle: React.CSSProperties = {
  background: "rgba(17, 24, 39, 0.8)",
  border: "1px solid rgba(255, 255, 255, 0.05)",
  borderRadius: 16,
  padding: "18px 20px",
  boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export const TenantDocumentsPage: React.FC = () => {
  const { lease } = useTenantOutletContext();
  const [docs, setDocs] = useState<TenantDocument[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getTenantDocuments();
        setDocs(data);
      } catch (err: any) {
        setError(err?.message || "Failed to load documents");
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ color: "#9ca3af", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Documents & Notices
          </div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Issued items</div>
          <div style={{ color: "#9ca3af", fontSize: 13 }}>
            {lease?.propertyName || "Your lease"} · {lease?.unitNumber ? `Unit ${lease.unitNumber}` : "Unit"}
          </div>
        </div>
        <span
          style={{
            fontSize: 12,
            color: "#9ca3af",
            background: "rgba(59,130,246,0.08)",
            padding: "6px 10px",
            borderRadius: 10,
            border: "1px solid rgba(59,130,246,0.15)",
          }}
        >
          Read only
        </span>
      </div>

      {error ? (
        <div style={{ color: "#fca5a5" }}>{error}</div>
      ) : isLoading ? (
        <div style={{ color: "#cbd5e1" }}>Loading documents…</div>
      ) : docs.length === 0 ? (
        <div style={{ color: "#9ca3af" }}>No documents or notices have been issued yet.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#94a3b8", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <th style={{ padding: "10px 6px" }}>Issued</th>
                <th style={{ padding: "10px 6px" }}>Type</th>
                <th style={{ padding: "10px 6px" }}>Title</th>
                <th style={{ padding: "10px 6px" }}>Description</th>
                <th style={{ padding: "10px 6px" }}>File</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "10px 6px", color: "#e5e7eb", fontWeight: 600 }}>{formatDate(d.issuedAt)}</td>
                  <td style={{ padding: "10px 6px", color: "#cbd5e1" }}>
                    <span
                      style={{
                        background: "rgba(59,130,246,0.12)",
                        color: "#bfdbfe",
                        padding: "6px 10px",
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {d.type === "notice" ? "Notice" : "Document"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 6px", color: "#e5e7eb", fontWeight: 700 }}>{d.title || "Untitled"}</td>
                  <td style={{ padding: "10px 6px", color: "#cbd5e1" }}>{d.description || "—"}</td>
                  <td style={{ padding: "10px 6px" }}>
                    {d.fileUrl ? (
                      <a
                        href={d.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#93c5fd", textDecoration: "underline", fontWeight: 600 }}
                      >
                        View
                      </a>
                    ) : (
                      <span style={{ color: "#9ca3af" }}>No file</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TenantDocumentsPage;
