import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button, Card } from "../../components/ui/Ui";
import { acceptContractorInvite } from "../../api/workOrdersApi";
import { useAuth } from "../../context/useAuth";

export default function ContractorInviteAcceptPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const token = String(params.get("invite") || "").trim();
  const [state, setState] = React.useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: 16 }}>
      <Card style={{ width: "min(560px, 100%)", display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 700, fontSize: "1.08rem" }}>Contractor Invite</div>
        {!token ? <div style={{ color: "#991b1b" }}>Invite token missing.</div> : null}
        {!user ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ color: "#64748b" }}>
              Sign in first, then return to accept your contractor invite.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Link to={`/login?next=${encodeURIComponent(`/contractor/signup?invite=${token}`)}`}>
                <Button>Login</Button>
              </Link>
              <Link to={`/signup?next=${encodeURIComponent(`/contractor/signup?invite=${token}`)}`}>
                <Button variant="secondary">Sign Up</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ color: "#64748b" }}>
              Accept invitation to join a landlord private contractor network.
            </div>
            {error ? <div style={{ color: "#991b1b" }}>{error}</div> : null}
            {state === "done" ? (
              <div>
                Invite accepted. Open your <Link to="/contractor/profile">Contractor Profile</Link>.
              </div>
            ) : (
              <Button
                disabled={!token || state === "saving"}
                onClick={async () => {
                  if (!token) return;
                  setState("saving");
                  setError(null);
                  try {
                    await acceptContractorInvite(token);
                    setState("done");
                  } catch (err: any) {
                    setError(String(err?.message || "Failed to accept invite"));
                    setState("idle");
                  }
                }}
              >
                {state === "saving" ? "Accepting..." : "Accept Invite"}
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
