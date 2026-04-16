import React from "react";
import { Button, Card, Input } from "../ui/Ui";
import type { ContractorProfileV1 } from "../../api/marketplaceContractorApi";

export default function ContractorProfileForm({
  initialValue,
  onSubmit,
  submitting,
}: {
  initialValue?: Partial<ContractorProfileV1> | null;
  onSubmit: (payload: Partial<ContractorProfileV1>) => Promise<void> | void;
  submitting?: boolean;
}) {
  const [displayName, setDisplayName] = React.useState(initialValue?.displayName || "");
  const [businessName, setBusinessName] = React.useState(initialValue?.businessName || "");
  const [serviceCategories, setServiceCategories] = React.useState((initialValue?.serviceCategories || []).join(", "));
  const [serviceAreas, setServiceAreas] = React.useState((initialValue?.serviceAreas || []).join(", "));
  const [availabilityStatus, setAvailabilityStatus] = React.useState(initialValue?.availabilityStatus || "active");
  const [email, setEmail] = React.useState(initialValue?.contact?.email || "");
  const [phone, setPhone] = React.useState(initialValue?.contact?.phone || "");
  const [summary, setSummary] = React.useState(initialValue?.summary || "");

  return (
    <Card style={{ display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 600 }}>{initialValue?.id ? "Edit contractor profile" : "Create contractor profile"}</div>
      <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" />
      <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business name" />
      <Input value={serviceCategories} onChange={(e) => setServiceCategories(e.target.value)} placeholder="plumbing, hvac" />
      <Input value={serviceAreas} onChange={(e) => setServiceAreas(e.target.value)} placeholder="Halifax, Dartmouth" />
      <select value={availabilityStatus} onChange={(e) => setAvailabilityStatus(e.target.value)}>
        <option value="active">Active</option>
        <option value="limited">Limited</option>
        <option value="inactive">Inactive</option>
      </select>
      <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
      <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
      <textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Short service summary" rows={4} />
      <div>
        <Button
          type="button"
          disabled={submitting || !displayName.trim()}
          onClick={() =>
            void onSubmit({
              displayName: displayName.trim(),
              businessName: businessName.trim() || null,
              serviceCategories: serviceCategories.split(",").map((value) => value.trim()).filter(Boolean) as any,
              serviceAreas: serviceAreas.split(",").map((value) => value.trim()).filter(Boolean),
              availabilityStatus: availabilityStatus as any,
              contact: {
                email: email.trim() || null,
                phone: phone.trim() || null,
              },
              summary: summary.trim() || null,
            })
          }
        >
          {submitting ? "Saving..." : initialValue?.id ? "Save profile" : "Create profile"}
        </Button>
      </div>
    </Card>
  );
}
