// src/components/dev/DevAuthGate.tsx
import React, { useEffect, useState } from "react";

interface DevAuthGateProps {
  children: React.ReactNode;
}

const STORAGE_KEY = "dev_auth_unlocked";

export const DevAuthGate: React.FC<DevAuthGateProps> = ({ children }) => {
  const [unlocked, setUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  // If not in dev mode, do NOT gate anything
  if (!import.meta.env.DEV) {
    return <>{children}</>;
  }

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "1") {
      setUnlocked(true);
    }
  }, []);

  const devPassword =
    import.meta.env.VITE_DEV_PASSWORD || "rentchain-dev"; // 🔑 default

  function handleUnlock() {
    if (passwordInput === devPassword) {
      localStorage.setItem(STORAGE_KEY, "1");
      setUnlocked(true);
      setError(null);
    } else {
      setError("Incorrect password. Try again.");
    }
  }

  if (unlocked) {
    return <>{children}</>;
  }

  // Locked screen
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at top, #020617 0, #020617 35%, #020617 70%, #020617 100%)",
        color: "#e5e7eb",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          padding: "1.75rem 1.75rem 1.5rem",
          borderRadius: "1.25rem",
          border: "1px solid rgba(148,163,184,0.4)",
          background:
            "linear-gradient(145deg, rgba(15,23,42,0.96), rgba(30,64,175,0.8))",
          boxShadow:
            "0 30px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(15,23,42,0.9)",
        }}
      >
        <div
          style={{
            fontSize: "0.75rem",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "#9ca3af",
            marginBottom: "0.35rem",
          }}
        >
          RentChain Dev
        </div>
        <div
          style={{
            fontSize: "1.1rem",
            fontWeight: 600,
            marginBottom: "0.85rem",
          }}
        >
          Enter dev access password
        </div>
        <div
          style={{
            fontSize: "0.8rem",
            color: "#cbd5f5",
            marginBottom: "1rem",
          }}
        >
          This preview is protected. Ask the developer for the dev password.
        </div>

        <div>
          <div style={{ marginBottom: "0.75rem" }}>
            <input
              type="password"
              autoFocus
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleUnlock();
                }
              }}
              placeholder="Dev password"
              style={{
                width: "100%",
                padding: "0.55rem 0.75rem",
                borderRadius: "0.75rem",
                border: "1px solid rgba(148,163,184,0.8)",
                backgroundColor: "rgba(15,23,42,0.9)",
                color: "#e5e7eb",
                fontSize: "0.85rem",
                outline: "none",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                marginBottom: "0.65rem",
                fontSize: "0.75rem",
                color: "#fecaca",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleUnlock}
            style={{
              width: "100%",
              padding: "0.55rem 0.75rem",
              borderRadius: "999px",
              border: "none",
              fontSize: "0.85rem",
              fontWeight: 500,
              cursor: "pointer",
              background:
                "linear-gradient(135deg, rgba(59,130,246,1), rgba(56,189,248,1))",
              color: "#e5e7eb",
              boxShadow: "0 0 18px rgba(37,99,235,0.8)",
            }}
          >
            Unlock
          </button>
        </div>

        <div
          style={{
            marginTop: "0.75rem",
            fontSize: "0.7rem",
            color: "#9ca3af",
            textAlign: "center",
          }}
        >
          Dev-only protection. Not for production use.
        </div>
      </div>
    </div>
  );
};
