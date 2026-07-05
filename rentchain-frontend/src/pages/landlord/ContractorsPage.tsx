import React from "react";
import { Button, Card, Input } from "../../components/ui/Ui";
import { useEntitlements } from "@/hooks/useEntitlements";
import { FeatureTeaser } from "@/components/billing/FeatureTeaser";
import { resolveRequiredPlanLabel } from "@/lib/upgradePrompt";
import {
  createContractorInvite,
  listContractorInvites,
  resendContractorInvite,
  type ContractorInvite,
} from "../../api/workOrdersApi";
import {
  createContractorProfile,
  fetchContractors,
  updateContractorProfile,
  type ContractorProfileV1,
} from "../../api/marketplaceContractorApi";
import ContractorCard from "../../components/marketplace/ContractorCard";
import ContractorFilterBar from "../../components/marketplace/ContractorFilterBar";
import ContractorProfileForm from "../../components/marketplace/ContractorProfileForm";
import "./ContractorsPage.css";

function formatDate(ms?: number | null) {
  if (!ms) return "-";
  return new Date(ms).toLocaleString();
}

export default function ContractorsPage() {
  const { canViewMarketplaceDirectory, loading: entitlementsLoading } = useEntitlements();
  const [directoryView, setDirectoryView] = React.useState<"active" | "archived">("active");
  const [loading, setLoading] = React.useState(true);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [invites, setInvites] = React.useState<ContractorInvite[]>([]);
  const [contractors, setContractors] = React.useState<ContractorProfileV1[]>([]);
  const [serviceCategory, setServiceCategory] = React.useState("");
  const [serviceArea, setServiceArea] = React.useState("");
  const [availabilityStatus, setAvailabilityStatus] = React.useState("");
  const [editing, setEditing] = React.useState<ContractorProfileV1 | null>(null);
  const [email, setEmail] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [savingInvite, setSavingInvite] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [inviteItems, contractorRes] = await Promise.all([
        listContractorInvites(),
        fetchContractors({
          serviceCategory: serviceCategory || undefined,
          serviceArea: serviceArea || undefined,
          availabilityStatus:
            directoryView === "archived"
              ? "inactive"
              : availabilityStatus && availabilityStatus !== "inactive"
                ? availabilityStatus
                : undefined,
        }),
      ]);
      setInvites(inviteItems);
      setContractors(contractorRes.items);
    } catch (err: any) {
      setError(String(err?.message || "Failed to load contractor directory"));
      setInvites([]);
      setContractors([]);
    } finally {
      setLoading(false);
    }
  }, [availabilityStatus, directoryView, serviceArea, serviceCategory]);

  React.useEffect(() => {
    if (entitlementsLoading) return;
    void load();
  }, [entitlementsLoading, load]);

  const handleArchiveToggle = React.useCallback(
    async (contractor: ContractorProfileV1, nextAvailabilityStatus: ContractorProfileV1["availabilityStatus"]) => {
      setError(null);
      try {
        await updateContractorProfile(contractor.id, { availabilityStatus: nextAvailabilityStatus });
        if (editing?.id === contractor.id) setEditing(null);
        await load();
      } catch (err: any) {
        setError(
          String(
            err?.message ||
              (nextAvailabilityStatus === "inactive"
                ? "Failed to archive contractor"
                : "Failed to restore contractor")
          )
        );
      }
    },
    [editing?.id, load]
  );

  const marketplacePlanLabel = resolveRequiredPlanLabel("marketplace_directory") || "Pro";

  if (entitlementsLoading) {
    return <Card>Loading contractor directory...</Card>;
  }

  return (
    <div className="rc-contractors-page" style={{ display: "grid", gap: 14 }}>
      <Card>
        <div style={{ fontWeight: 700, fontSize: "1.06rem" }}>Contractor directory</div>
        <div style={{ color: "#64748b", marginTop: 4 }}>
          Manage your private contractor network, service coverage, and assignment-ready profiles.
        </div>
      </Card>

      {!canViewMarketplaceDirectory ? (
        <FeatureTeaser
          featureKey="marketplace_directory"
          eyebrow={`${marketplacePlanLabel} marketplace`}
          title={`Unlock the full contractor directory on ${marketplacePlanLabel}`}
          description="Preview your existing contractor network now, then upgrade to create profiles, manage invite flows, and use the full marketplace directory experience."
          ctaLabel={`Upgrade to ${marketplacePlanLabel}`}
        />
      ) : null}

      <ContractorFilterBar
        serviceCategory={serviceCategory}
        serviceArea={serviceArea}
        availabilityStatus={directoryView === "archived" ? "inactive" : availabilityStatus}
        onChange={(next) => {
          if (next.serviceCategory !== undefined) setServiceCategory(next.serviceCategory);
          if (next.serviceArea !== undefined) setServiceArea(next.serviceArea);
          if (next.availabilityStatus !== undefined) {
            if (next.availabilityStatus === "inactive") {
              setDirectoryView("archived");
              setAvailabilityStatus("");
            } else {
              setDirectoryView("active");
              setAvailabilityStatus(next.availabilityStatus);
            }
          }
        }}
        onRefresh={() => void load()}
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button
          type="button"
          variant={directoryView === "active" ? "primary" : "secondary"}
          onClick={() => {
            setDirectoryView("active");
            setAvailabilityStatus((current) => (current === "inactive" ? "" : current));
          }}
        >
          Active contractors
        </Button>
        <Button
          type="button"
          variant={directoryView === "archived" ? "primary" : "secondary"}
          onClick={() => {
            setDirectoryView("archived");
            setAvailabilityStatus("");
          }}
        >
          Archived contractors
        </Button>
      </div>

      {canViewMarketplaceDirectory ? (
        <div style={{ display: "grid", gap: 8 }}>
          {editing ? (
            <div style={{ color: "#475569", fontSize: "0.92rem", fontWeight: 600 }}>
              Editing {editing.displayName}
            </div>
          ) : null}
          <ContractorProfileForm
            initialValue={editing}
            submitting={savingProfile}
            onSubmit={async (payload) => {
              setSavingProfile(true);
              setError(null);
              try {
                if (editing?.id) {
                  await updateContractorProfile(editing.id, payload);
                } else {
                  await createContractorProfile(payload);
                }
                setEditing(null);
                await load();
              } catch (err: any) {
                setError(String(err?.message || "Failed to save contractor profile"));
              } finally {
                setSavingProfile(false);
              }
            }}
          />
        </div>
      ) : null}

      {loading ? (
        <Card>Loading contractor directory...</Card>
      ) : contractors.length === 0 ? (
        <Card style={{ color: "#64748b" }}>
          {directoryView === "archived"
            ? "No archived contractor profiles match the current filters."
            : "No contractor profiles match the current filters."}
        </Card>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {contractors.map((contractor) => (
            <ContractorCard
              key={contractor.id}
              contractor={contractor}
              actions={
                canViewMarketplaceDirectory
                  ? [
                      {
                        label: "Edit profile",
                        onClick: () => setEditing(contractor),
                      },
                      contractor.availabilityStatus === "inactive"
                        ? {
                            label: "Restore contractor",
                            onClick: () => void handleArchiveToggle(contractor, "active"),
                          }
                        : {
                            label: "Archive contractor",
                            onClick: () => void handleArchiveToggle(contractor, "inactive"),
                          },
                    ]
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {canViewMarketplaceDirectory ? (
        <Card style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 600 }}>Invite contractor</div>
          <div className="rc-contractors-invite-form-grid">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contractor@email.com" />
            <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Optional message" />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              disabled={savingInvite || !email.trim()}
              onClick={async () => {
                setSavingInvite(true);
                setError(null);
                try {
                  await createContractorInvite({ email: email.trim(), message: message.trim() });
                  setEmail("");
                  setMessage("");
                  await load();
                } catch (err: any) {
                  setError(String(err?.message || "Failed to create invite"));
                } finally {
                  setSavingInvite(false);
                }
              }}
            >
              {savingInvite ? "Sending..." : "Send Invite"}
            </Button>
          </div>
        </Card>
      ) : null}

      {error ? <Card style={{ borderColor: "#ef4444", color: "#991b1b" }}>{error}</Card> : null}

      {canViewMarketplaceDirectory ? (
        <Card>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Invite history</div>
          {loading ? (
            <div>Loading invites...</div>
          ) : invites.length === 0 ? (
            <div style={{ color: "#64748b" }}>No invites yet.</div>
          ) : (
            <>
              <div className="rc-contractors-invite-table-wrap" aria-label="Invite history table">
                <table className="rc-contractors-invite-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Expires</th>
                      <th>Accepted</th>
                      <th>Invite Link</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map((invite) => (
                      <tr key={invite.id}>
                        <td>{invite.email}</td>
                        <td>{invite.status}</td>
                        <td>{formatDate(invite.createdAtMs)}</td>
                        <td>{formatDate(invite.expiresAtMs || null)}</td>
                        <td>{formatDate(invite.acceptedAtMs)}</td>
                        <td>
                          {invite.inviteLink ? (
                            <a href={invite.inviteLink} target="_blank" rel="noreferrer">
                              Open
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>
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
              </div>
              <div className="rc-contractors-invite-cards" aria-label="Invite history cards">
                {invites.map((invite) => (
                  <div className="rc-contractors-invite-card" key={invite.id}>
                    <div>
                      <div className="rc-contractors-invite-card-label">Email</div>
                      <div className="rc-contractors-wrap-text">{invite.email}</div>
                    </div>
                    <div className="rc-contractors-invite-card-grid">
                      <div>
                        <div className="rc-contractors-invite-card-label">Status</div>
                        <div>{invite.status}</div>
                      </div>
                      <div>
                        <div className="rc-contractors-invite-card-label">Created</div>
                        <div>{formatDate(invite.createdAtMs)}</div>
                      </div>
                      <div>
                        <div className="rc-contractors-invite-card-label">Expires</div>
                        <div>{formatDate(invite.expiresAtMs || null)}</div>
                      </div>
                      <div>
                        <div className="rc-contractors-invite-card-label">Accepted</div>
                        <div>{formatDate(invite.acceptedAtMs)}</div>
                      </div>
                    </div>
                    <div className="rc-contractors-invite-card-actions">
                      {invite.inviteLink ? (
                        <a href={invite.inviteLink} target="_blank" rel="noreferrer">
                          Open invite link
                        </a>
                      ) : null}
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
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      ) : null}
    </div>
  );
}
