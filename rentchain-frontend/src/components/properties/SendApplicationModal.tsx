import React from "react";
import { createApplicationLink } from "../../api/applicationLinksApi";
import { useToast } from "../ui/ToastProvider";
import { setOnboardingStep } from "../../api/onboardingApi";
import { track } from "../../lib/analytics";

type Props = {
  open: boolean;
  propertyId?: string | null;
  propertyName?: string | null;
  properties?: Array<{ id: string; name: string }>;
  onPropertyChange?: (nextId: string) => void;
  units?: Array<{ id: string; name: string }>;
  initialUnitId?: string | null;
  onUnitChange?: (nextId: string | null) => void;
  unit?: any | null;
  onClose: () => void;
};

export function SendApplicationModal({
  open,
  propertyId,
  propertyName,
  properties,
  onPropertyChange,
  units,
  initialUnitId,
  onUnitChange,
  unit,
  onClose,
}: Props) {
  const { showToast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [link, setLink] = React.useState<string | null>(null);
  const [applicantEmail, setApplicantEmail] = React.useState("");
  const [emailed, setEmailed] = React.useState<boolean | null>(null);
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const tenantEmail = (unit as any)?.tenantEmail || "";
  const propertyOptions = React.useMemo(() => {
    if (properties && properties.length) return properties;
    if (propertyId) {
      return [{ id: String(propertyId), name: propertyName || "Selected property" }];
    }
    return [];
  }, [properties, propertyId, propertyName]);
  const [selectedPropertyId, setSelectedPropertyId] = React.useState<string>(propertyId || "");
  const [selectedUnitId, setSelectedUnitId] = React.useState<string>(
    initialUnitId || ((unit as any)?.id ? String((unit as any).id) : "")
  );

  React.useEffect(() => {
    if (!open) {
      setLoading(false);
      setError(null);
      setLink(null);
      setApplicantEmail("");
      setEmailed(null);
      setEmailError(null);
    }
  }, [open]);

  React.useEffect(() => {
    if (open && tenantEmail) {
      setApplicantEmail(tenantEmail);
    }
  }, [open, tenantEmail]);

  React.useEffect(() => {
    if (open && propertyId) {
      setSelectedPropertyId(String(propertyId));
    }
  }, [open, propertyId]);

  React.useEffect(() => {
    if (!open) return;
    if (initialUnitId) {
      setSelectedUnitId(String(initialUnitId));
    } else if ((unit as any)?.id) {
      setSelectedUnitId(String((unit as any).id));
    } else {
      setSelectedUnitId("");
    }
  }, [open, initialUnitId, unit]);

  if (!open) return null;

  const handleGenerate = async () => {
    if (!selectedPropertyId) {
      setError("Missing property id");
      return;
    }
    setLoading(true);
    setError(null);
    setEmailed(null);
    setEmailError(null);
    try {
      const res = await createApplicationLink({
        propertyId: String(selectedPropertyId),
        unitId: selectedUnitId ? String(selectedUnitId) : null,
        applicantEmail: applicantEmail.trim() || null,
      });
      if ((res as any)?.ok === false) {
        const detail = (res as any)?.detail || (res as any)?.error || "Failed to create application link";
        throw new Error(String(detail));
      }
      const rawUrl =
        (res as any)?.data?.url ||
        (res as any)?.applicationUrl ||
        (res as any)?.link ||
        (res as any)?.url ||
        (res as any)?.inviteUrl ||
        null;
      if (!rawUrl) {
        throw new Error("Missing application link");
      }
      const fullUrl = (() => {
        try {
          return new URL(rawUrl, window.location.origin).toString();
        } catch {
          return rawUrl;
        }
      })();
      setLink(fullUrl);
      setEmailed(Boolean((res as any)?.emailed));
      setEmailError(((res as any)?.emailError as string) || null);
      await setOnboardingStep("applicationCreated", true).catch(() => {});
      track("onboarding_step_completed", { stepKey: "applicationCreated", method: "explicit" });
      if ((res as any)?.emailed) {
        showToast({
          message: "Application link sent",
          description: "The applicant received the email.",
          variant: "success",
        });
      } else {
        showToast({
          message: "Application link created",
          description: "Email not sent. Share the link with the applicant.",
          variant: "success",
        });
      }
    } catch (e: any) {
      const msg = e?.message || "Failed to create application link";
      setError(msg);
      showToast({ message: "Could not create link", description: msg, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      showToast({ message: "Link copied", variant: "success" });
    } catch {
      showToast({ message: "Copy failed", variant: "error" });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 1200,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(520px, 100%)",
          background: "#fff",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: "1rem" }}>Send application link</div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 16 }}
            aria-label="Close"
            >
            x
          </button>
        </div>

        {propertyOptions.length ? (
          <>
            <label style={{ display: "grid", gap: 6, fontSize: "0.9rem", color: "#111827" }}>
              Property
              <select
                value={selectedPropertyId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setSelectedPropertyId(nextId);
                  onPropertyChange?.(nextId);
                  if (nextId !== selectedPropertyId) {
                    setSelectedUnitId("");
                    onUnitChange?.(null);
                  }
                }}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  fontSize: "0.9rem",
                  background: "#fff",
                }}
                required
              >
                {propertyOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                This link will be for the selected property.
              </span>
            </label>
            {selectedPropertyId ? (
              <label style={{ display: "grid", gap: 6, fontSize: "0.9rem", color: "#111827" }}>
                Unit (optional)
                <select
                  value={selectedUnitId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setSelectedUnitId(nextId);
                    onUnitChange?.(nextId ? nextId : null);
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    fontSize: "0.9rem",
                    background: "#fff",
                  }}
                >
                  <option value="">Whole property / unspecified</option>
                  {(units || []).map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
                {!units || units.length === 0 ? (
                  <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                    No units found for this property.
                  </span>
                ) : null}
              </label>
            ) : null}
            {!unit ? (
              <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                Unit and rent details can be entered manually by the applicant.
              </div>
            ) : null}
          </>
        ) : (
          <div
            style={{
              padding: 10,
              borderRadius: 10,
              border: "1px solid #fde68a",
              background: "#fffbeb",
              color: "#92400e",
              fontSize: "0.9rem",
            }}
          >
            Create a property first to send an application link.
          </div>
        )}

        <label style={{ display: "grid", gap: 6, fontSize: "0.9rem", color: "#111827" }}>
          Applicant email
          <input
            value={applicantEmail}
            onChange={(e) => setApplicantEmail(e.target.value)}
            placeholder="applicant@email.com"
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              fontSize: "0.9rem",
            }}
          />
          <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
            We'll email the applicant a secure application link.
          </span>
        </label>

        {error ? (
          <div
            style={{
              padding: 10,
              borderRadius: 10,
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#991b1b",
              fontSize: "0.9rem",
            }}
          >
            {error}
          </div>
        ) : null}

        {link ? (
          <div
            style={{
              padding: 10,
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "#f8fafc",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Application link</div>
            <input
              readOnly
              value={link}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontSize: "0.9rem",
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={copyLink}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Copy link
              </button>
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "#0f172a",
                  color: "#fff",
                  textDecoration: "none",
                }}
              >
                Open link
              </a>
            </div>
            {emailed === true ? (
              <div style={{ fontSize: "0.85rem", color: "#374151" }}>Application link sent to applicant.</div>
            ) : emailed === false ? (
              <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                Application link created. Email not sent.
                {emailError ? ` (${emailError})` : ""}
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff" }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !selectedPropertyId}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #0f172a",
              background: "#0f172a",
              color: "#fff",
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "Generating..." : "Generate link"}
          </button>
        </div>
      </div>
    </div>
  );
}
