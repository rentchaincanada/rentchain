import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Application,
  fetchApplication,
  submitCosignerApplication,
  CosignerApplicationPayload,
} from "@/api/applicationsApi";

const CosignPage: React.FC = () => {
  const { applicationId } = useParams<{ applicationId: string }>();

  const [app, setApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState<CosignerApplicationPayload>({
    fullName: "",
    email: "",
    phone: "",
    monthlyIncome: undefined,
    address: "",
    city: "",
    provinceState: "",
    postalCode: "",
    relationshipToApplicant: "",
    notes: "",
    creditConsent: false,
  });

  useEffect(() => {
    if (!applicationId) {
      setError("No application ID provided.");
      setLoading(false);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchApplication(applicationId);
        if (!mounted) return;
        setApp(data);
      } catch (err: any) {
        console.error("[CosignPage] fetch error:", err);
        if (mounted) {
          setError(
            err?.message ?? "Failed to load application information."
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [applicationId]);

  const handleChange = (
    field: keyof CosignerApplicationPayload,
    value: string | number | boolean
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit: React.FormEventHandler = async (e) => {
    e.preventDefault();
    if (!applicationId) return;

    try {
      setError(null);
      const payload: CosignerApplicationPayload = {
        ...form,
        monthlyIncome:
          form.monthlyIncome && Number(form.monthlyIncome) > 0
            ? Number(form.monthlyIncome)
            : undefined,
        creditConsent: !!form.creditConsent,
      };

      await submitCosignerApplication(applicationId, payload);
      setSubmitted(true);
    } catch (err: any) {
      console.error("[CosignPage] submit error:", err);
      setError(
        err?.message ?? "Failed to submit co-signer application."
      );
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#e5e7eb",
        }}
      >
        Loading…
      </div>
    );
  }

  if (submitted) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          color: "#e5e7eb",
        }}
      >
        <div
          style={{
            maxWidth: 520,
            width: "100%",
            borderRadius: "1rem",
            border: "1px solid rgba(34,197,94,0.8)",
            background:
              "radial-gradient(circle at top left, rgba(21,128,61,0.6), rgba(15,23,42,0.98))",
            padding: "1.5rem 1.7rem",
            boxShadow: "0 20px 50px rgba(15,23,42,0.9)",
          }}
        >
          <h1
            style={{
              fontSize: "1.1rem",
              marginBottom: "0.6rem",
            }}
          >
            Thank you for completing the co-signer form.
          </h1>
          <p
            style={{
              fontSize: "0.9rem",
              opacity: 0.9,
            }}
          >
            The property management team has received your information and
            will contact you if any additional details are needed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "2rem 1rem",
        display: "flex",
        justifyContent: "center",
        color: "#e5e7eb",
        background:
          "radial-gradient(circle at top left, rgba(30,64,175,0.6), rgba(15,23,42,1))",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          borderRadius: "1.1rem",
          border: "1px solid rgba(30,64,175,0.9)",
          backgroundColor: "rgba(15,23,42,0.98)",
          boxShadow: "0 22px 55px rgba(15,23,42,0.95)",
          padding: "1.7rem 1.8rem",
        }}
      >
        <h1
          style={{
            fontSize: "1.2rem",
            marginBottom: "0.4rem",
          }}
        >
          Co-signer information
        </h1>

        {app && (
          <p
            style={{
              fontSize: "0.85rem",
              opacity: 0.85,
              marginBottom: "0.9rem",
            }}
          >
            You are completing this form as a co-signer for{" "}
            <strong>{app.fullName}</strong> on{" "}
            <strong>
              {app.propertyName} – Unit {app.unit}
            </strong>
            .
          </p>
        )}

        {error && (
          <div
            style={{
              marginBottom: "0.8rem",
              padding: "0.55rem 0.7rem",
              borderRadius: "0.75rem",
              backgroundColor: "rgba(127,29,29,0.25)",
              border: "1px solid rgba(248,113,113,0.8)",
              fontSize: "0.8rem",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Name + email */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1.1fr",
              gap: "0.7rem",
              marginBottom: "0.7rem",
            }}
          >
            <div>
              <label
                style={{
                  fontSize: "0.8rem",
                  opacity: 0.8,
                }}
              >
                Full name *
              </label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) =>
                  handleChange("fullName", e.target.value)
                }
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: "0.8rem",
                  opacity: 0.8,
                }}
              >
                Email *
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) =>
                  handleChange("email", e.target.value)
                }
                required
                style={inputStyle}
              />
            </div>
          </div>

          {/* Phone + relationship */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.1fr 1.4fr",
              gap: "0.7rem",
              marginBottom: "0.7rem",
            }}
          >
            <div>
              <label
                style={{
                  fontSize: "0.8rem",
                  opacity: 0.8,
                }}
              >
                Phone
              </label>
              <input
                type="tel"
                value={form.phone || ""}
                onChange={(e) =>
                  handleChange("phone", e.target.value)
                }
                style={inputStyle}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: "0.8rem",
                  opacity: 0.8,
                }}
              >
                Relationship to applicant
              </label>
              <input
                type="text"
                value={form.relationshipToApplicant || ""}
                onChange={(e) =>
                  handleChange("relationshipToApplicant", e.target.value)
                }
                style={inputStyle}
              />
            </div>
          </div>

          {/* Income */}
          <div
            style={{
              marginBottom: "0.7rem",
            }}
          >
            <label
              style={{
                fontSize: "0.8rem",
                opacity: 0.8,
              }}
            >
              Approximate monthly income (before tax)
            </label>
            <input
              type="number"
              min={0}
              value={form.monthlyIncome ?? ""}
              onChange={(e) =>
                handleChange("monthlyIncome", e.target.value)
              }
              style={inputStyle}
            />
          </div>

          {/* Address */}
          <div
            style={{
              marginBottom: "0.7rem",
            }}
          >
            <label
              style={{
                fontSize: "0.8rem",
                opacity: 0.8,
              }}
            >
              Current address
            </label>
            <input
              type="text"
              placeholder="Street address"
              value={form.address || ""}
              onChange={(e) => handleChange("address", e.target.value)}
              style={inputStyle}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.1fr 0.7fr 0.7fr",
              gap: "0.7rem",
              marginBottom: "0.7rem",
            }}
          >
            <div>
              <label
                style={{
                  fontSize: "0.8rem",
                  opacity: 0.8,
                }}
              >
                City
              </label>
              <input
                type="text"
                value={form.city || ""}
                onChange={(e) => handleChange("city", e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: "0.8rem",
                  opacity: 0.8,
                }}
              >
                Province / State
              </label>
              <input
                type="text"
                value={form.provinceState || ""}
                onChange={(e) =>
                  handleChange("provinceState", e.target.value)
                }
                style={inputStyle}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: "0.8rem",
                  opacity: 0.8,
                }}
              >
                Postal / ZIP
              </label>
              <input
                type="text"
                value={form.postalCode || ""}
                onChange={(e) =>
                  handleChange("postalCode", e.target.value)
                }
                style={inputStyle}
              />
            </div>
          </div>

          {/* Notes */}
          <div
            style={{
              marginBottom: "0.7rem",
            }}
          >
            <label
              style={{
                fontSize: "0.8rem",
                opacity: 0.8,
              }}
            >
              Any additional notes (optional)
            </label>
            <textarea
              value={form.notes || ""}
              onChange={(e) => handleChange("notes", e.target.value)}
              rows={3}
              style={{
                ...inputStyle,
                resize: "vertical",
              }}
            />
          </div>

          {/* Consent */}
          <div
            style={{
              marginBottom: "0.8rem",
              fontSize: "0.8rem",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.45rem",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={form.creditConsent}
                onChange={(e) =>
                  handleChange("creditConsent", e.target.checked)
                }
                style={{
                  marginTop: "0.15rem",
                }}
              />
              <span
                style={{
                  opacity: 0.85,
                }}
              >
                I consent to the landlord or property manager using this
                information to complete a credit check and assess my
                suitability as a co-signer on this tenancy.
              </span>
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!form.fullName || !form.email || !form.creditConsent}
            style={{
              padding: "0.45rem 1.1rem",
              borderRadius: "999px",
              border: "1px solid rgba(59,130,246,0.9)",
              backgroundColor: form.creditConsent
                ? "rgba(37,99,235,0.9)"
                : "rgba(37,99,235,0.4)",
              color: "#e5e7eb",
              fontSize: "0.85rem",
              cursor:
                !form.fullName || !form.email || !form.creditConsent
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            Submit co-signer information
          </button>
        </form>
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  marginTop: "0.22rem",
  padding: "0.35rem 0.55rem",
  borderRadius: "0.6rem",
  border: "1px solid rgba(51,65,85,0.9)",
  backgroundColor: "rgba(15,23,42,0.95)",
  color: "#e5e7eb",
  fontSize: "0.82rem",
  outline: "none",
};

export default CosignPage;
