import { db, FieldValue } from "../firebase";
import {
  buildCanonicalLeaseOccupancyProjection,
  resolveCanonicalUnitProjectionInputs,
  toCanonicalLeaseStateInput,
} from "../lib/leases/canonicalLeaseOccupancyProjection";
import { deriveTenantWorkspaceLifecycle } from "../lib/tenants/deriveTenantWorkspaceLifecycle";

export type TenantArchiveCommand = "archive" | "restore";

export class TenantArchiveCommandError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
  }
}

function participantIds(lease: Record<string, any>): string[] {
  return [lease.tenantId, lease.primaryTenantId, ...(Array.isArray(lease.tenantIds) ? lease.tenantIds : [])]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

export async function mutateTenantArchiveState(input: {
  tenantId: string;
  landlordId?: string | null;
  actorUserId?: string | null;
  actorRole: "landlord" | "admin";
  command: TenantArchiveCommand;
}) {
  const tenantId = String(input.tenantId || "").trim();
  if (!tenantId) throw new TenantArchiveCommandError("tenant_id_required", 400);
  if (typeof (db as any).runTransaction !== "function") {
    throw new TenantArchiveCommandError("tenant_archive_transaction_unavailable", 503);
  }

  const eventRef = db.collection("canonicalEvents").doc();
  return (db as any).runTransaction(async (transaction: any) => {
    const tenantRef = db.collection("tenants").doc(tenantId);
    const tenantSnap = await transaction.get(tenantRef);
    if (!tenantSnap.exists) throw new TenantArchiveCommandError("tenant_not_found", 404);
    const tenant = (tenantSnap.data() || {}) as Record<string, any>;
    const authoritativeLandlordId = String(tenant.landlordId || "").trim();
    const requestedLandlordId = String(input.landlordId || "").trim();
    if (!authoritativeLandlordId || (input.actorRole !== "admin" && authoritativeLandlordId !== requestedLandlordId)) {
      throw new TenantArchiveCommandError("tenant_forbidden", 403);
    }

    const [landlordLeases, landlordUnits, landlordProperties] = await Promise.all([
      transaction.get(db.collection("leases").where("landlordId", "==", authoritativeLandlordId)),
      transaction.get(db.collection("units").where("landlordId", "==", authoritativeLandlordId)),
      transaction.get(db.collection("properties").where("landlordId", "==", authoritativeLandlordId)),
    ]);
    const leases = (landlordLeases.docs || [])
      .map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((lease: any) => participantIds(lease).includes(tenantId));
    const standaloneUnits = (landlordUnits.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
    const embeddedUnits = (landlordProperties.docs || []).flatMap((doc: any) => {
      const property = doc.data() || {};
      return (Array.isArray(property.units) ? property.units : []).map((unit: any, index: number) => ({
        ...unit,
        id: String(unit.id || unit.unitId || `${doc.id}:${index}`),
        propertyId: unit.propertyId || doc.id,
      }));
    });
    const unitMatches = [...standaloneUnits, ...embeddedUnits].filter((unit: any) =>
      [unit.tenantId, unit.currentTenantId].some((value) => String(value || "").trim() === tenantId) ||
      (tenant.currentLeaseId && [unit.leaseId, unit.currentLeaseId].some((value) => String(value || "").trim() === String(tenant.currentLeaseId)))
    );
    const uniqueUnitMatches = Array.from(new Map(unitMatches.map((unit: any) => [`${unit.propertyId || ""}:${unit.id}`, unit])).values());
    const unitInputs = uniqueUnitMatches.length === 1 ? resolveCanonicalUnitProjectionInputs(uniqueUnitMatches[0] as any) : {};
    let canonicalState = buildCanonicalLeaseOccupancyProjection({
      leases,
      context: { landlordId: authoritativeLandlordId, tenantId },
      ...unitInputs,
      persistedTenantStatus: tenant.status ?? tenant.relationshipStatus,
      currentLeasePointerId: tenant.currentLeaseId,
      tenantId,
    });
    if (uniqueUnitMatches.length > 1) {
      canonicalState = {
        ...canonicalState,
        occupancyState: "review_needed",
        tenantRelationshipState: "occupancy_unresolved",
        reasons: Array.from(new Set([...canonicalState.reasons, "CURRENT_LEASE_CONTEXT_MISMATCH" as const])),
      };
    }
    const workspaceLifecycle = deriveTenantWorkspaceLifecycle({
      canonicalState,
      leases: leases.map(toCanonicalLeaseStateInput),
      archivedAt: tenant.archivedAt,
    });

    if (input.command === "archive") {
      if (workspaceLifecycle.isArchived) throw new TenantArchiveCommandError("tenant_already_archived", 409);
      if (!workspaceLifecycle.archiveEligibility.allowed) {
        throw new TenantArchiveCommandError(
          `tenant_archive_${workspaceLifecycle.archiveEligibility.reason || "ineligible"}`,
          409
        );
      }
    } else if (!workspaceLifecycle.isArchived) {
      throw new TenantArchiveCommandError("tenant_not_archived", 409);
    }

    const nowIso = new Date().toISOString();
    const actorUserId = String(input.actorUserId || "").trim() || null;
    const updates = input.command === "archive"
      ? {
          archivedAt: nowIso,
          archivedByUserId: actorUserId,
          restoredAt: null,
          restoredByUserId: null,
          updatedAt: nowIso,
          updatedAtServer: FieldValue.serverTimestamp(),
        }
      : {
          archivedAt: null,
          archivedByUserId: null,
          restoredAt: nowIso,
          restoredByUserId: actorUserId,
          updatedAt: nowIso,
          updatedAtServer: FieldValue.serverTimestamp(),
        };
    const event = {
      id: eventRef.id,
      type: `tenant.lifecycle_${input.command}d`,
      eventType: `tenant_lifecycle_${input.command}d`,
      action: `tenant_${input.command}d`,
      tenantId,
      landlordId: authoritativeLandlordId,
      actorUserId,
      actorRole: input.actorRole,
      occurredAt: nowIso,
      recordedAt: nowIso,
      metadataOnly: true,
      appendOnly: true,
      immutable: true,
      historyDeleted: false,
    };

    transaction.set(tenantRef, updates, { merge: true });
    if (typeof transaction.create === "function") transaction.create(eventRef, event);
    else transaction.set(eventRef, event, { merge: false });

    return {
      tenantId,
      command: input.command,
      eventId: eventRef.id,
      archivedAt: input.command === "archive" ? nowIso : null,
      restoredAt: input.command === "restore" ? nowIso : null,
    };
  });
}
