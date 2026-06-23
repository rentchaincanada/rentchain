import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { acceptDelegatedAccessInvitation } from "../api/delegatedAccessApi";
import { Button, Card } from "../components/ui/Ui";
import { useAuth } from "../context/useAuth";

type AcceptState = "idle" | "accepting" | "accepted" | "failed";

function pageShell(children: React.ReactNode) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "32px 16px",
        background:
          "radial-gradient(circle at top left, rgba(37,99,235,0.08) 0, rgba(14,165,233,0.06) 45%, rgba(255,255,255,0.95) 100%)",
      }}
    >
      <div style={{ width: "min(560px, 100%)" }}>{children}</div>
    </main>
  );
}

function safeFailureMessage(error: unknown): string {
  const code = String(error instanceof Error ? error.message : error || "").toUpperCase();
  if (code.includes("EXPIRED")) return "This invitation has expired. Ask the landlord owner to send a new invitation.";
  if (code.includes("NOT_PENDING")) return "This invitation is no longer pending. It may have been cancelled or already accepted.";
  if (code.includes("NOT_FOUND") || code.includes("INVALID")) return "This invitation link is invalid or no longer available.";
  return "We could not accept this invitation. Ask the landlord owner to verify the invitation status.";
}

export default function DelegatedAccessAcceptPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading, ready, authStatus } = useAuth();
  const token = React.useMemo(() => new URLSearchParams(location.search).get("token")?.trim() || "", [location.search]);
  const [state, setState] = React.useState<AcceptState>("idle");
  const [message, setMessage] = React.useState("");

  const currentPath = `${location.pathname}${location.search || ""}`;
  const authSearch = new URLSearchParams({ next: currentPath, reason: "missing" }).toString();
  const loginUrl = `/login?${authSearch}`;
  const signupUrl = `/signup?${authSearch}`;
  const authLoading = authStatus === "restoring" || isLoading || !ready;
  const signedIn = Boolean(user);

  const handleAccept = async () => {
    if (!token || !signedIn || state === "accepting") return;
    setState("accepting");
    setMessage("");
    try {
      await acceptDelegatedAccessInvitation(token);
      setState("accepted");
      setMessage("Delegated access is now active for your account.");
    } catch (error) {
      setState("failed");
      setMessage(safeFailureMessage(error));
    }
  };

  if (!token) {
    return pageShell(
      <Card>
        <h1 style={{ margin: 0, fontSize: 28 }}>Invalid invitation link</h1>
        <p style={{ color: "#475569", lineHeight: 1.6 }}>
          This delegated access invitation link is missing required information. Ask the landlord owner to resend the invitation.
        </p>
        <Button type="button" onClick={() => navigate("/login")} variant="secondary">
          Go to sign in
        </Button>
      </Card>
    );
  }

  return pageShell(
    <Card>
      <div style={{ display: "grid", gap: 18 }}>
        <div>
          <div style={{ color: "#2563eb", fontWeight: 800, fontSize: 13, textTransform: "uppercase" }}>
            Delegated Access
          </div>
          <h1 style={{ margin: "6px 0 0", fontSize: 30 }}>Accept delegated access invitation</h1>
        </div>

        {state === "accepted" ? (
          <div style={{ display: "grid", gap: 14 }}>
            <p style={{ color: "#166534", fontWeight: 700, margin: 0 }}>{message}</p>
            <p style={{ color: "#475569", lineHeight: 1.6, margin: 0 }}>
              You can now open RentChain and use the delegated workspaces assigned by the landlord owner.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button type="button" onClick={() => navigate("/dashboard")}>
                Go to Dashboard
              </Button>
              <Button type="button" onClick={() => navigate("/account")} variant="secondary">
                Go to Account
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            <p style={{ color: "#334155", lineHeight: 1.6, margin: 0 }}>
              Sign in with your own RentChain account before accepting. Do not use or share the landlord owner&apos;s login credentials.
            </p>

            {!authLoading && !signedIn ? (
              <div
                style={{
                  border: "1px solid #bfdbfe",
                  background: "#eff6ff",
                  color: "#1e3a8a",
                  borderRadius: 12,
                  padding: 14,
                  lineHeight: 1.5,
                }}
              >
                Sign in to accept this invitation.
              </div>
            ) : null}

            {state === "failed" ? (
              <div
                role="alert"
                style={{
                  border: "1px solid #fecdd3",
                  background: "#fff1f2",
                  color: "#9f1239",
                  borderRadius: 12,
                  padding: 14,
                  lineHeight: 1.5,
                }}
              >
                {message}
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {signedIn ? (
                <Button type="button" onClick={handleAccept} disabled={state === "accepting" || authLoading}>
                  {state === "accepting" ? "Accepting..." : "Accept invitation"}
                </Button>
              ) : (
                <>
                  <Button type="button" onClick={() => navigate(signupUrl)}>
                    Create account to accept
                  </Button>
                  <Button type="button" onClick={() => navigate(loginUrl)} variant="secondary">
                    Sign in to accept
                  </Button>
                </>
              )}
              {signedIn ? (
                <Button type="button" onClick={() => navigate(loginUrl)} variant="secondary">
                  Use another account
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
