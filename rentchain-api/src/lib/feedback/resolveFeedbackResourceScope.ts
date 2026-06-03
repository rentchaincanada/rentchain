import { db } from "../../firebase";

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

export async function resolveFeedbackResourceScope(input: {
  tenantId: string;
  email?: string | null;
  resourceType: string;
  resourceId: string;
}) {
  const tenantId = asString(input.tenantId, 240);
  const email = asString(input.email, 240).toLowerCase();
  const resourceType = asString(input.resourceType, 80).toLowerCase();
  const resourceId = asString(input.resourceId, 240);

  if (!tenantId || !resourceType || !resourceId) return null;

  if (resourceType === "maintenance" || resourceType === "maintenance_request") {
    const snap = await db.collection("maintenanceRequests").doc(resourceId).get();
    const data = snap.data() as any;
    if (!snap.exists || asString(data?.tenantId, 240) !== tenantId) return null;
    return {
      resourceType: "maintenance",
      resourceId,
      portfolioId: asString(data?.landlordId, 240) || null,
    };
  }

  if (resourceType === "application") {
    const snap = await db.collection("applications").doc(resourceId).get();
    const data = snap.data() as any;
    const applicantEmail = asString(data?.applicantEmail, 240).toLowerCase();
    const matchesTenant =
      asString(data?.tenantId, 240) === tenantId ||
      (email && applicantEmail && applicantEmail === email);
    if (!snap.exists || !matchesTenant) return null;
    return {
      resourceType: "application",
      resourceId,
      portfolioId: asString(data?.landlordId, 240) || null,
    };
  }

  if (resourceType === "lease") {
    const snap = await db.collection("leases").doc(resourceId).get();
    const data = snap.data() as any;
    const tenantIds = Array.isArray(data?.tenantIds) ? data.tenantIds.map((item: any) => asString(item, 240)) : [];
    const matchesTenant =
      asString(data?.tenantId, 240) === tenantId ||
      tenantIds.includes(tenantId);
    if (!snap.exists || !matchesTenant) return null;
    return {
      resourceType: "lease",
      resourceId,
      portfolioId: asString(data?.landlordId, 240) || null,
    };
  }

  if (resourceType === "screening_order" || resourceType === "screening") {
    const screeningSnap = await db.collection("screeningOrders").doc(resourceId).get();
    const screening = screeningSnap.data() as any;
    if (!screeningSnap.exists) return null;

    const applicationId = asString(screening?.applicationId, 240);
    if (!applicationId) {
      const applicantEmail = asString(screening?.applicantEmail || screening?.email, 240).toLowerCase();
      if (!email || !applicantEmail || applicantEmail !== email) return null;
      return {
        resourceType: "screening_order",
        resourceId,
        portfolioId: asString(screening?.landlordId, 240) || null,
      };
    }

    const applicationSnap = await db.collection("applications").doc(applicationId).get();
    const application = applicationSnap.data() as any;
    const applicantEmail = asString(application?.applicantEmail, 240).toLowerCase();
    const matchesTenant =
      applicationSnap.exists &&
      (asString(application?.tenantId, 240) === tenantId || (email && applicantEmail === email));
    if (!matchesTenant) return null;

    return {
      resourceType: "screening_order",
      resourceId,
      portfolioId: asString(screening?.landlordId || application?.landlordId, 240) || null,
    };
  }

  return null;
}
