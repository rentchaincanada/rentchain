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
  const [redeemState, setRedeemState] = React.useState<"idle" | "saving" | "done">("idle");
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

  React.useEffect(() => {
    let cancelled = false;
    async function redeem() {
      if (!token || !user) return;
      if (inviteStatus !== "valid") return;
      if (redeemState === "saving" || redeemState === "done") return;
      if (blockedRole) return;
      setRedeemState("saving");
      setError(null);
      try {
        await acceptContractorInvite(token);
        if (cancelled) return;
        setRedeemState("done");
        navigate("/contractor/jobs", { replace: true });
      } catch (err: any) {
        if (cancelled) return;
        setRedeemState("idle");
        setError(String(err?.message || "Failed to redeem invite"));
      }
    }
    redeem();
    return () => {
      cancelled = true;
    };
  }, [token, user, inviteStatus, redeemState, blockedRole, navigate]);

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
        {!token ? <div style={{ color: "#991b1b" }}>Invite token missing.</div> : null}
        {inviteStatus === "not_found" ? <div style={{ color: "#991b1b" }}>Invite not found.</div> : null}
        {inviteStatus === "expired" ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ color: "#991b1b" }}>This invite has expired.</div>
            <div style={{ color: "#64748b" }}>Ask landlord to resend invite.</div>
          </div>
        ) : null}
        {inviteStatus === "accepted" ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div>This invite has already been accepted.</div>
            {!user ? (
              <Link to={`/login?next=${encodeURIComponent("/contractor/jobs")}`}>
                <Button>Log in</Button>
              </Link>
            ) : (
              <Link to="/contractor/jobs">
                <Button>Open Contractor Jobs</Button>
              </Link>
            )}
          </div>
        ) : null}

        {inviteStatus === "valid" && !user ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ color: "#64748b" }}>
              Create a contractor account or log in to accept this invite.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Link to={`/login?next=${encodeURIComponent(nextPath)}`}>
                <Button>Log In</Button>
              </Link>
              <Link to={`/signup?next=${encodeURIComponent(nextPath)}`}>
                <Button variant="secondary">Create Contractor Account</Button>
              </Link>
            </div>
          </div>
        ) : null}

        {inviteStatus === "valid" && !!user && blockedRole ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ color: "#991b1b" }}>
              Please sign in with a contractor account or sign out and create one.
            </div>
            <div style={{ color: "#64748b" }}>
              Use a separate contractor account to accept this invite.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                variant="secondary"
                onClick={async () => {
                  await logout();
                  navigate(nextPath, { replace: true });
                }}
              >
                Sign Out
              </Button>
              <Link to={`/signup?next=${encodeURIComponent(nextPath)}`}>
                <Button>Create Contractor Account</Button>
              </Link>
            </div>
          </div>
        ) : null}

        {inviteStatus === "valid" && !!user && !blockedRole ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ color: "#64748b" }}>
              Redeeming your contractor invite and linking your account.
            </div>
            {error ? <div style={{ color: "#991b1b" }}>{error}</div> : null}
            <Button
              disabled={redeemState === "saving"}
              onClick={async () => {
                if (!token) return;
                setRedeemState("saving");
                setError(null);
                try {
                  await acceptContractorInvite(token);
                  setRedeemState("done");
                  navigate("/contractor/jobs", { replace: true });
                } catch (err: any) {
                  setError(String(err?.message || "Failed to redeem invite"));
                  setRedeemState("idle");
                }
              }}
            >
              {redeemState === "saving" ? "Redeeming..." : "Continue to Contractor Jobs"}
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
