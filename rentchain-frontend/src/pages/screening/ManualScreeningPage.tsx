import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, Section, Button, Input } from "../../components/ui/Ui";
import { spacing, text, colors, radius } from "../../styles/tokens";
import { fetchProperties } from "../../api/propertiesApi";
import { fetchUnitsForProperty } from "../../api/unitsApi";
import { createScreeningOrder } from "../../api/rentalApplicationsApi";

type PropertyOption = { id: string; name: string };
type UnitOption = { id: string; label: string };

const ManualScreeningPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [properties, setProperties] = React.useState<PropertyOption[]>([]);
  const [units, setUnits] = React.useState<UnitOption[]>([]);
  const [loadingUnits, setLoadingUnits] = React.useState(false);

  const [propertyId, setPropertyId] = React.useState("");
  const [unitId, setUnitId] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [addressLine1, setAddressLine1] = React.useState("");
  const [city, setCity] = React.useState("");
  const [province, setProvince] = React.useState("");
  const [postal, setPostal] = React.useState("");
  const [dob, setDob] = React.useState("");
  const [sin, setSin] = React.useState("");
  const [consentGiven, setConsentGiven] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res: any = await fetchProperties();
        if (!active) return;
        const list = Array.isArray(res?.properties)
          ? res.properties
          : Array.isArray(res?.items)
          ? res.items
          : Array.isArray(res)
          ? res
          : [];
        const mapped = list
          .map((p: any) => ({
            id: String(p?.id || p?.propertyId || "").trim(),
            name: String(p?.name || p?.addressLine1 || p?.id || "Property"),
          }))
          .filter((p: PropertyOption) => Boolean(p.id));
        setProperties(mapped);
        if (mapped.length > 0) setPropertyId(mapped[0].id);
      } catch {
        setProperties([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    if (!propertyId) {
      setUnits([]);
      setUnitId("");
      return;
    }
    let active = true;
    (async () => {
      setLoadingUnits(true);
      try {
        const res = await fetchUnitsForProperty(propertyId);
        if (!active) return;
        const mapped = (res || [])
          .map((u: any) => ({
            id: String(u?.id || u?.unitId || "").trim(),
            label: String(u?.unitNumber || u?.label || "Unit"),
          }))
          .filter((u: UnitOption) => Boolean(u.id));
        setUnits(mapped);
        setUnitId((prev) => (mapped.some((u) => u.id === prev) ? prev : ""));
      } catch {
        if (!active) return;
        setUnits([]);
        setUnitId("");
      } finally {
        if (active) setLoadingUnits(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [propertyId]);

  const canSubmit =
    !!propertyId &&
    !!email.trim() &&
    !!firstName.trim() &&
    !!lastName.trim() &&
    !!addressLine1.trim() &&
    !!city.trim() &&
    !!province.trim() &&
    !!postal.trim() &&
    (!!dob.trim() || !!sin.trim()) &&
    consentGiven &&
    !loading;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const result = await createScreeningOrder({
        propertyId,
        unitId: unitId || null,
        tenantEmail: email.trim(),
        tenantName: `${firstName.trim()} ${lastName.trim()}`.trim(),
        screeningTier: "basic",
        addons: [],
        totalAmount: 19.99,
        scoreAddOn: false,
        serviceLevel: "SELF_SERVE",
        returnTo: "/dashboard",
        successPath: "/screening/success",
        cancelPath: "/screening/cancel",
        manualApplicant: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          dob: dob.trim() || undefined,
          sin: sin.trim() || undefined,
          currentAddress: {
            line1: addressLine1.trim(),
            city: city.trim(),
            province: province.trim(),
            postal: postal.trim(),
          },
          consentGiven: true,
        } as any,
      } as any);
      if (!result?.ok || !result?.checkoutUrl) {
        setError(result?.error || "Unable to start checkout.");
        return;
      }
      window.location.assign(result.checkoutUrl);
    } catch (err: any) {
      setError(String(err?.message || "Unable to start checkout."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section style={{ maxWidth: 760, margin: "0 auto" }}>
      <Card elevated style={{ display: "grid", gap: spacing.md }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700 }}>Run Manual Screening</h1>
          <div style={{ marginTop: 6, color: text.muted }}>
            Start a pay-per-use screening from the dashboard.
          </div>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: spacing.sm }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Property</span>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              style={{ borderRadius: radius.md, border: "1px solid #d1d5db", padding: "10px 12px" }}
            >
              <option value="">Select property</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Unit (optional)</span>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              disabled={!propertyId || loadingUnits}
              style={{ borderRadius: radius.md, border: "1px solid #d1d5db", padding: "10px 12px" }}
            >
              <option value="">{loadingUnits ? "Loading units..." : "Select unit"}</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.label}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "grid", gap: spacing.sm, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>First name</span>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Last name</span>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </label>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Email</span>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Current address</span>
            <Input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} required />
          </label>

          <div style={{ display: "grid", gap: spacing.sm, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>City</span>
              <Input value={city} onChange={(e) => setCity(e.target.value)} required />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Province</span>
              <Input value={province} onChange={(e) => setProvince(e.target.value)} required />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Postal code</span>
              <Input value={postal} onChange={(e) => setPostal(e.target.value)} required />
            </label>
          </div>

          <div style={{ display: "grid", gap: spacing.sm, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Date of birth (or provide SIN)</span>
              <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>SIN (optional; last 4 stored)</span>
              <Input value={sin} onChange={(e) => setSin(e.target.value)} />
            </label>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
            />
            <span>I confirm consent to run this screening.</span>
          </label>

          {error ? (
            <div
              style={{
                border: "1px solid #fecdd3",
                background: "#fef2f2",
                color: colors.danger,
                borderRadius: radius.md,
                padding: spacing.sm,
              }}
            >
              {error}
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: spacing.sm }}>
            <Button type="button" variant="secondary" onClick={() => navigate("/dashboard")}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {loading ? "Starting..." : "Continue to checkout"}
            </Button>
          </div>
        </form>
      </Card>
    </Section>
  );
};

export default ManualScreeningPage;
