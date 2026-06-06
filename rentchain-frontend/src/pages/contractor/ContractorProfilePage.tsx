import React from "react";
import { Button, Card, Input } from "../../components/ui/Ui";
import { createContractorProfile, getContractorProfile, patchContractorProfile } from "../../api/workOrdersApi";
import { getContractorPortalProfile, updateContractorPortalProfile } from "../../api/contractorPortalApi";
import { useAuth } from "../../context/useAuth";

export default function ContractorProfilePage() {
  const { user } = useAuth();
  const contractorId = String((user as any)?.contractorId || user?.id || "").trim();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [businessName, setBusinessName] = React.useState("");
  const [contactName, setContactName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [serviceCategories, setServiceCategories] = React.useState("");
  const [serviceAreas, setServiceAreas] = React.useState("");
  const [bio, setBio] = React.useState("");

  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const profile = contractorId ? await getContractorPortalProfile(contractorId) : await getContractorProfile();
        if (profile) {
          setBusinessName(profile.businessName || "");
          setContactName((profile as any).contactName || profile.name || "");
          setPhone(profile.phone || "");
          setServiceCategories(((profile as any).serviceCategories || profile.specialties || []).join(", "));
          setServiceAreas((profile.serviceAreas || []).join(", "));
          setBio(profile.bio || "");
        }
      } catch (err: any) {
        setError(String(err?.message || "Failed to load profile"));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [contractorId]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card>
        <div style={{ fontWeight: 700, fontSize: "1.06rem" }}>Contractor Profile</div>
        <div style={{ color: "#64748b", marginTop: 4 }}>
          Complete your profile so landlords can assign jobs faster.
        </div>
      </Card>

      <Card style={{ display: "grid", gap: 10 }}>
        {error ? <div style={{ color: "#991b1b" }}>{error}</div> : null}
        {loading ? <div>Loading profile...</div> : null}
        <label style={{ display: "grid", gap: 6 }}>
          Business Name
          <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          Contact Name
          <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          Phone
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          Service Categories (comma-separated)
          <Input value={serviceCategories} onChange={(e) => setServiceCategories(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          Service Areas (comma-separated)
          <Input value={serviceAreas} onChange={(e) => setServiceAreas(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          Bio
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", padding: 10, resize: "vertical" }}
          />
        </label>

        <div style={{ display: "flex", gap: 8 }}>
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setError(null);
              try {
                const payload = {
                  businessName: businessName.trim(),
                  contactName: contactName.trim(),
                  name: contactName.trim(),
                  phone: phone.trim(),
                  serviceCategories: serviceCategories
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
                  specialties: serviceCategories
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
                  serviceAreas: serviceAreas
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
                  bio: bio.trim(),
                };
                if (contractorId) {
                  await updateContractorPortalProfile(contractorId, payload);
                } else {
                  try {
                    await patchContractorProfile(payload);
                  } catch {
                    await createContractorProfile(payload);
                  }
                }
              } catch (err: any) {
                setError(String(err?.message || "Failed to save profile"));
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
