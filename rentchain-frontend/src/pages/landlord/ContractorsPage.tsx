import React from "react";
import { Button, Card, Input } from "../../components/ui/Ui";
import {
  createContractorInvite,
  listContractorInvites,
  resendContractorInvite,
  type ContractorInvite,
} from "../../api/workOrdersApi";

function formatDate(ms?: number | null) {
  if (!ms) return "-";
  return new Date(ms).toLocaleString();
}

export default function ContractorsPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [invites, setInvites] = React.useState<ContractorInvite[]>([]);
  const [email, setEmail] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInvites(await listContractorInvites());
    } catch (err: any) {
      setError(String(err?.message || "Failed to load contractor invites"));
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card>
        <div style={{ fontWeight: 700, fontSize: "1.06rem" }}>Contractors</div>
        <div style={{ color: "#64748b", marginTop: 4 }}>
          Manage your private contractor network and invite links.
        </div>
      </Card>

      <Card style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 600 }}>Invite Contractor</div>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contractor@email.com"
          />
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Optional message"
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            disabled={saving || !email.trim()}
            onClick={async () => {
              setSaving(true);
              setError(null);
              try {
                await createContractorInvite({ email: email.trim(), message: message.trim() });
                setEmail("");
                setMessage("");
                await load();
              } catch (err: any) {
                setError(String(err?.message || "Failed to create invite"));
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Sending..." : "Send Invite"}
          </Button>
          <Button variant="secondary" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
      </Card>

      {error ? <Card style={{ borderColor: "#ef4444", color: "#991b1b" }}>{error}</Card> : null}

      <Card>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Invite History</div>
        {loading ? (
          <div>Loading invites...</div>
        ) : invites.length === 0 ? (
          <div style={{ color: "#64748b" }}>No invites yet.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: 8 }}>Email</th>
                <th style={{ padding: 8 }}>Status</th>
                <th style={{ padding: 8 }}>Created</th>
                <th style={{ padding: 8 }}>Expires</th>
                <th style={{ padding: 8 }}>Accepted</th>
                <th style={{ padding: 8 }}>Invite Link</th>
                <th style={{ padding: 8 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <tr key={invite.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: 8 }}>{invite.email}</td>
                  <td style={{ padding: 8 }}>{invite.status}</td>
                  <td style={{ padding: 8 }}>{formatDate(invite.createdAtMs)}</td>
                  <td style={{ padding: 8 }}>{formatDate(invite.expiresAtMs || null)}</td>
                  <td style={{ padding: 8 }}>{formatDate(invite.acceptedAtMs)}</td>
                  <td style={{ padding: 8 }}>
                    {invite.inviteLink ? (
                      <a href={invite.inviteLink} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td style={{ padding: 8 }}>
                    {invite.status !== "accepted" ? (
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await resendContractorInvite(invite.id);
                            await load();
                          } catch (err: any) {
                            setError(String(err?.message || "Failed to resend invite"));
                          }
                        }}
                      >
                        Resend
                      </Button>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
