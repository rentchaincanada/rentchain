import React, { useEffect, useState } from "react";
import { useSubscription, SubscriptionPlan } from "../../context/SubscriptionContext";
import { useToast } from "../ui/ToastProvider";
import { AddPropertyForm } from "../properties/AddPropertyForm";
import type { Property } from "../../api/propertiesApi";

interface OnboardingWizardProps {
  open: boolean;
  onClose: () => void;
  onLaunchAddProperty?: () => void;
}

const STEPS = ["Plan", "Property", "Next"];
const ONBOARDING_STEP_KEY = "rentchain_onboarding_step";

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  open,
  onClose,
  onLaunchAddProperty,
}) => {
  const { plan, setPlan } = useSubscription();
  const { showToast } = useToast();
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(ONBOARDING_STEP_KEY) : null;
    if (stored) {
      const parsed = Number(stored);
      if (Number.isFinite(parsed) && parsed >= 0 && parsed < STEPS.length) {
        setStepIndex(parsed);
      }
    }
  }, []);

  const updateStep = (next: number) => {
    setStepIndex(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ONBOARDING_STEP_KEY, String(next));
    }
  };

  if (!open) return null;

  const goNext = () => {
    if (stepIndex < STEPS.length - 1) {
      updateStep(stepIndex + 1);
    } else {
      onClose();
      showToast({
        message: "Onboarding complete",
        description: "You can revisit setup anytime from the dashboard.",
        variant: "success",
      });
    }
  };

  const goPrev = () => {
    if (stepIndex > 0) updateStep(stepIndex - 1);
  };

  const handleSelectPlan = (p: SubscriptionPlan) => {
    setPlan(p);
    showToast({
      message: "Plan selected",
      description: `You are now previewing the ${p} plan experience.`,
      variant: "info",
    });
  };

  const isLastStep = stepIndex === STEPS.length - 1;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15,23,42,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: 720,
          maxHeight: "80vh",
          overflow: "hidden",
          borderRadius: 24,
          border: "1px solid rgba(55,65,81,1)",
          background:
            "radial-gradient(circle at top left, rgba(56,189,248,0.18) 0, rgba(15,23,42,1) 40%, rgba(15,23,42,1) 100%)",
          boxShadow: "0 30px 60px rgba(0,0,0,0.7)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid rgba(31,41,55,1)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: 0.09,
                color: "#9ca3af",
              }}
            >
              Welcome to RentChain
            </div>
            <div
              style={{
                fontSize: 14,
                color: "#e5e7eb",
                fontWeight: 500,
              }}
            >
              Guided setup for your first portfolio
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              color: "#9ca3af",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        {/* Step indicator */}
        <div
          style={{
            padding: "8px 16px",
            display: "flex",
            gap: 8,
            borderBottom: "1px solid rgba(31,41,55,1)",
          }}
        >
          {STEPS.map((label, idx) => {
            const active = idx === stepIndex;
            return (
              <div
                key={label}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: 0.08,
                  color: active ? "#bfdbfe" : "#6b7280",
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    border: active
                      ? "1px solid rgba(59,130,246,1)"
                      : "1px solid rgba(55,65,81,1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    backgroundColor: active
                      ? "rgba(30,64,175,1)"
                      : "rgba(15,23,42,1)",
                  }}
                >
                  {idx + 1}
                </div>
                <span>{label}</span>
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div
          style={{
            padding: 16,
            flex: 1,
            overflowY: "auto",
          }}
        >
          {stepIndex === 0 && (
            <StepPlanSelection currentPlan={plan} onSelectPlan={handleSelectPlan} />
          )}
          {stepIndex === 1 && (
            <StepProperty
              onLaunchAddProperty={onLaunchAddProperty}
              onPropertyCreated={() => updateStep(2)}
            />
          )}
          {stepIndex === 2 && <StepNextSteps />}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: 12,
            borderTop: "1px solid rgba(31,41,55,1)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: 999,
              border: "1px solid rgba(55,65,81,1)",
              padding: "4px 10px",
              backgroundColor: "transparent",
              color: "#e5e7eb",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Skip for now
          </button>
          <div
            style={{
              display: "flex",
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={goPrev}
              disabled={stepIndex === 0}
              style={{
                borderRadius: 999,
                border: "1px solid rgba(55,65,81,1)",
                padding: "4px 10px",
                backgroundColor: "transparent",
                color:
                  stepIndex === 0 ? "#4b5563" : "#e5e7eb",
                fontSize: 11,
                cursor: stepIndex === 0 ? "default" : "pointer",
              }}
            >
              Back
            </button>
            <button
              type="button"
              onClick={goNext}
              style={{
                borderRadius: 999,
                border: "none",
                padding: "4px 12px",
                background:
                  "linear-gradient(90deg, rgba(59,130,246,0.95), rgba(56,189,248,0.95))",
                color: "#f9fafb",
                fontSize: 11,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {isLastStep ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface StepPlanSelectionProps {
  currentPlan: SubscriptionPlan;
  onSelectPlan: (p: SubscriptionPlan) => void;
}

const StepPlanSelection: React.FC<StepPlanSelectionProps> = ({
  currentPlan,
  onSelectPlan,
}) => {
  const plans: { id: SubscriptionPlan; label: string; blurb: string }[] = [
    {
      id: "starter",
      label: "Starter",
      blurb: "Track payments and generate tenant history reports.",
    },
    {
      id: "core",
      label: "Core",
      blurb: "Starter + applications and property-level tracking.",
    },
    {
      id: "pro",
      label: "Pro",
      blurb: "Core + AI insights for tenants, properties, and portfolio.",
    },
    {
      id: "elite",
      label: "Elite",
      blurb: "Pro + on-chain audit relay and advanced automation.",
    },
  ];

  return (
    <div>
      <div
        style={{
          fontSize: 14,
          color: "#e5e7eb",
          marginBottom: 8,
        }}
      >
        Choose the experience you want to preview
      </div>
      <div
        style={{
          fontSize: 12,
          color: "#9ca3af",
          marginBottom: 12,
        }}
      >
        In demo mode, this doesn't bill you. It just changes which features are
        active so you can see what each plan unlocks.
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 8,
        }}
      >
        {plans.map((p) => {
          const active = p.id === currentPlan;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectPlan(p.id)}
              style={{
                textAlign: "left",
                borderRadius: 14,
                border: active
                  ? "1px solid rgba(59,130,246,1)"
                  : "1px solid rgba(55,65,81,1)",
                padding: 10,
                backgroundColor: active
                  ? "rgba(30,64,175,1)"
                  : "rgba(15,23,42,1)",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#e5e7eb",
                  marginBottom: 4,
                }}
              >
                {p.label}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#9ca3af",
                }}
              >
                {p.blurb}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const StepProperty: React.FC<{
  onLaunchAddProperty?: () => void;
  onPropertyCreated?: (property: Property) => void;
}> = ({ onLaunchAddProperty, onPropertyCreated }) => {
  return (
    <div>
      <div
        style={{
          fontSize: 14,
          color: "#e5e7eb",
          marginBottom: 8,
        }}
      >
        Add your first property
      </div>
      <div
        style={{
          fontSize: 12,
          color: "#9ca3af",
          marginBottom: 12,
        }}
      >
        RentChain works best when it knows your buildings and units. You can
        reuse the same forms from the Properties screen to add details like
        address, total units, layouts, and amenities.
      </div>
      <button
        type="button"
        onClick={onLaunchAddProperty}
        style={{
          borderRadius: 999,
          border: "1px solid rgba(148,163,184,0.7)",
          padding: "6px 12px",
          background:
            "radial-gradient(circle at top left, rgba(56,189,248,0.2) 0, rgba(15,23,42,1) 40%, rgba(15,23,42,1) 100%)",
          color: "#e5e7eb",
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        Open Add Property form
      </button>
      <div style={{ marginTop: 14 }}>
        <AddPropertyForm
          onCreated={(property) => {
            if (onPropertyCreated) {
              onPropertyCreated(property);
            }
          }}
        />
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#6b7280",
          marginTop: 8,
        }}
      >
        In demo mode, this may not save data permanently yet. For live landlord
        accounts, this step becomes your real property setup.
      </div>
    </div>
  );
};

const StepNextSteps: React.FC = () => {
  return (
    <div>
      <div
        style={{
          fontSize: 14,
          color: "#e5e7eb",
          marginBottom: 8,
        }}
      >
        What's next?
      </div>
      <ul
        style={{
          fontSize: 12,
          color: "#9ca3af",
          paddingLeft: 16,
          margin: 0,
        }}
      >
        <li>Use the Tenants page to add or review tenants per unit.</li>
        <li>Record a few payments to see ledgers and reports update.</li>
        <li>
          Download a tenant payment history report to preview what you can share
          with partners or lenders.
        </li>
        <li>
          Explore the Applications screen to test the screening and AI insights
          workflow.
        </li>
      </ul>
      <div
        style={{
          fontSize: 11,
          color: "#6b7280",
          marginTop: 10,
        }}
      >
        You can relaunch this setup guide from the dashboard whenever you want
        to adjust plans or add more properties.
      </div>
    </div>
  );
};
