import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";

function destinationForRole(role?: string | null) {
  const normalized = String(role || "").trim().toLowerCase();
  if (normalized === "tenant") return { to: "/tenant", label: "Return to tenant portal" };
  if (normalized === "admin" || normalized === "support") return { to: "/admin", label: "Return to admin workspace" };
  if (normalized === "contractor") return { to: "/contractor", label: "Return to contractor workspace" };
  return { to: "/dashboard", label: "Return to RentChain" };
}

export default function SigningCompletePage() {
  const { user, ready, isLoading } = useAuth();
  const destination = user ? destinationForRole(user.role || user.actorRole) : null;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#f8fafc",
      }}
    >
      <section
        aria-labelledby="signing-complete-title"
        style={{
          width: "100%",
          maxWidth: 520,
          display: "grid",
          gap: 16,
          padding: 24,
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          background: "#fff",
          color: "#0f172a",
        }}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <p style={{ margin: 0, color: "#166534", fontSize: 13, fontWeight: 800, textTransform: "uppercase" }}>
            Signing complete
          </p>
          <h1 id="signing-complete-title" style={{ margin: 0, fontSize: 28, lineHeight: 1.15 }}>
            Lease signing completed
          </h1>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.55 }}>
            You may close this page or return to RentChain.
          </p>
        </div>

        {!ready || isLoading ? (
          <p style={{ margin: 0, color: "#64748b" }}>Checking session...</p>
        ) : destination ? (
          <Link
            to={destination.to}
            style={{
              justifySelf: "start",
              padding: "10px 14px",
              borderRadius: 8,
              background: "#0f172a",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            {destination.label}
          </Link>
        ) : (
          <Link
            to="/login"
            style={{
              justifySelf: "start",
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              color: "#0f172a",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Sign in
          </Link>
        )}
      </section>
    </main>
  );
}
