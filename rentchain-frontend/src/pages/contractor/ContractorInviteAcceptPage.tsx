import React from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button, Card } from "../../components/ui/Ui";
import { acceptContractorInvite, getPublicContractorInvite, type PublicContractorInviteStatus } from "../../api/workOrdersApi";
import { useAuth } from "../../context/useAuth";

export default function ContractorInviteAcceptPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { token: tokenParam } = useParams();
  const [params] = useSearchParams();
  const token = String(tokenParam || params.get("invite") || "").trim();
  const nextPath = token ? `/contractor/invite/${encodeURIComponent(token)}` : "/contractor/invite";

  const [inviteStatus, setInviteStatus] = React.useState<PublicContractorInviteStatus | "loading">("loading");
  const [inviteMeta, setInviteMeta] = React.useState<{
    landlordName: string | null;
    emailMasked: string | null;
  } | null>(null);
  const [redeemState, setRedeemState] = React.useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);

  const role = String(user?.actorRole || user?.role || "").toLowerCase();
  const blockedRole = role === "admin" || role === "landlord";

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!token) {
        setInviteStatus("not_found");
        return;
      }
      setInviteStatus("loading");
      setError(null);
      try {
        const result = await getPublicContractorInvite(token);
        if (cancelled) return;
        setInviteStatus(result.status || "not_found");
        setInviteMeta({
          landlordName: result.invite?.landlordName || null,
          emailMasked: result.invite?.emailMasked || null,
        });
      } catch (err: any) {
        if (cancelled) return;
        setInviteStatus("not_found");
        setError(String(err?.message || "Failed to load invite"));
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: 16 }}>
      <Card style={{ width: "min(620px, 100%)", display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 700, fontSize: "1.08rem" }}>Contractor Invite</div>
        {inviteMeta?.landlordName ? (
          <div style={{ color: "#334155" }}>
            Invite from: <strong>{inviteMeta.landlordName}</strong>
          </div>
        ) : null}
        {inviteMeta?.emailMasked ? (
          <div style={{ color: "#64748b" }}>Invited email: {inviteMeta.emailMasked}</div>
        ) : null}
        {inviteStatus === "loading" ? <div style={{ color: "#64748b" }}>Checking invite...</div> : null}
        {!token ? <div style={{ color: "#991b1b" }}>Invitation not found</div> : null}
        {inviteStatus === "expired" ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>This invitation has expired</div>
            <div>This contractor invitation is no longer active.</div>
            <div>Please contact the landlord who invited you and ask them to resend the invitation.</div>
            <Link to="/login">
              <Button>Back to sign in</Button>
            </Link>
            <div style={{ color: "#64748b", fontSize: "0.95rem" }}>
              If you already have a contractor account, you can still sign in to RentChain.
            </div>
          </div>
        ) : null}
        {inviteStatus === "accepted" ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>This invitation has already been accepted</div>
            <div>This contractor invitation is no longer available.</div>
            <div>If this is your account, sign in to continue to your contractor dashboard.</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link to={`/login?next=${encodeURIComponent("/contractor")}`}>
                <Button>Sign in</Button>
              </Link>
              <Link to="/contractor">
                <Button variant="secondary">Go to Contractor Dashboard</Button>
              </Link>
            </div>
          </div>
        ) : null}

        {inviteStatus === "not_found" ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>Invitation not found</div>
            <div>This contractor invitation link is invalid or no longer available.</div>
            <div>Please check the link in your email or contact the landlord who invited you.</div>
            <Link to="/login">
              <Button>Back to sign in</Button>
            </Link>
          </div>
        ) : null}

        {inviteStatus === "valid" && !user && redeemState !== "done" ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>You’ve been invited to join RentChain as a contractor</div>
            <div>A landlord has invited you to join RentChain to view and manage assigned work orders.</div>
            <div>Create a contractor account or sign in to accept this invitation.</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link to={`/signup?next=${encodeURIComponent(nextPath)}`}>
                <Button>Create contractor account</Button>
              </Link>
              <Link to={`/login?next=${encodeURIComponent(nextPath)}`}>
                <Button variant="secondary">Sign in</Button>
              </Link>
            </div>
            <div style={{ color: "#64748b", fontSize: "0.95rem" }}>
              By continuing, you’ll be able to view assigned jobs, update work progress, and manage your contractor profile in RentChain.
            </div>
          </div>
        ) : null}

        {inviteStatus === "valid" && !!user && blockedRole && redeemState !== "done" ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>This invitation needs a contractor account</div>
            <div>You’re currently signed in with an account that cannot accept this contractor invitation.</div>
            <div>To continue, sign out and create a contractor account, or sign in with an existing contractor account.</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button
                onClick={async () => {
                  await logout();
                  navigate(nextPath, { replace: true });
                }}
              >
                Sign out and continue
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  await logout();
                  navigate(`/login?next=${encodeURIComponent(nextPath)}`, { replace: true });
                }}
              >
                Use another account
              </Button>
            </div>
            <div style={{ color: "#64748b", fontSize: "0.95rem" }}>
              This helps keep landlord and contractor access separate and secure.
            </div>
          </div>
        ) : null}

        {inviteStatus === "valid" && !!user && !blockedRole && redeemState !== "done" && redeemState !== "error" ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>Accept contractor invitation</div>
            <div>You’re signed in and ready to accept this invitation.</div>
            <div>Once accepted, you’ll be able to view assigned work orders and manage your contractor profile in RentChain.</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button
                disabled={redeemState === "saving"}
                onClick={async () => {
                  if (!token) return;
                  setRedeemState("saving");
                  setError(null);
                  try {
                    await acceptContractorInvite(token);
                    setRedeemState("done");
                  } catch (err: any) {
                    setError(String(err?.message || "Failed to redeem invite"));
                    setRedeemState("error");
                  }
                }}
              >
                {redeemState === "saving" ? "Accepting..." : "Accept invitation"}
              </Button>
              <Button variant="secondary" onClick={() => navigate("/", { replace: true })}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {redeemState === "done" ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>Invitation accepted</div>
            <div>Your contractor account is now connected to RentChain.</div>
            <div>You can now view assigned jobs, track progress, and manage your contractor profile.</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link to="/contractor">
                <Button>Go to Contractor Dashboard</Button>
              </Link>
              <Link to="/contractor/jobs">
                <Button variant="secondary">View Jobs</Button>
              </Link>
            </div>
          </div>
        ) : null}

        {redeemState === "error" ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>We couldn’t complete your invitation</div>
            <div>Something went wrong while accepting your contractor invitation.</div>
            <div>Please try again. If the issue continues, contact support or ask the landlord to resend the invitation.</div>
            {error ? <div style={{ color: "#991b1b" }}>{error}</div> : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button onClick={() => setRedeemState("idle")}>Try again</Button>
              <Link to={`/login?next=${encodeURIComponent(nextPath)}`}>
                <Button variant="secondary">Sign in</Button>
              </Link>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
