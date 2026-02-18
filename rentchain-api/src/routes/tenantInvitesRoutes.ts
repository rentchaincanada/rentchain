import { Router } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { db } from "../config/firebase";
import { requireLandlordOrAdmin } from "../middleware/requireLandlordOrAdmin";
import { requireAuth } from "../middleware/requireAuth";
import { rateLimitTenantInvitesUser } from "../middleware/rateLimit";
import { sendEmail } from "../services/emailService";
import { buildEmailHtml, buildEmailText } from "../email/templates/baseEmailTemplate";
import { createTenancyIfMissing } from "../services/tenanciesService";
import { requireCapability } from "../services/capabilityGuard";

const router = Router();

function normalizeStatus(value: any): string {
  return String(value || "").trim().toLowerCase();
}

function leaseIndicatesSigned(status: any): boolean {
  const normalized = normalizeStatus(status);
  return normalized === "signed" || normalized === "active" || normalized === "current";
}

async function loadEligibleUnit(opts: {
  landlordId: string;
  propertyId: string;
  unitId: string;
}): Promise<{ found: boolean; eligible: boolean }> {
  const unitSnap = await db.collection("units").doc(opts.unitId).get();
  if (!unitSnap.exists) return { found: false, eligible: false };

  const unit = unitSnap.data() as any;
  if (
    String(unit?.landlordId || "") !== opts.landlordId ||
    String(unit?.propertyId || "") !== opts.propertyId
  ) {
    return { found: false, eligible: false };
  }

  const occupancyStatus = normalizeStatus(unit?.occupancyStatus || unit?.status);
  if (occupancyStatus === "occupied") {
    return { found: true, eligible: true };
  }

  const leasesSnap = await db
    .collection("leases")
    .where("landlordId", "==", opts.landlordId)
    .limit(400)
    .get();

  const unitNumber = String(unit?.unitNumber || unit?.label || "").trim();
  const hasSignedLease = leasesSnap.docs.some((doc) => {
    const lease = doc.data() as any;
    const leaseUnitId = String(lease?.unitId || "").trim();
    const leaseUnitNumber = String(lease?.unitNumber || lease?.unit || "").trim();
    const leasePropertyId = String(lease?.propertyId || "").trim();
    return (
      leasePropertyId === opts.propertyId &&
      leaseIndicatesSigned(lease?.status) &&
      (leaseUnitId === opts.unitId || (unitNumber && leaseUnitNumber === unitNumber))
    );
  });

  return { found: true, eligible: hasSignedLease };
}

function signTenantJwt(payload: any) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET missing");
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

router.post(
  "/",
  requireAuth,
  requireLandlordOrAdmin,
  rateLimitTenantInvitesUser,
  async (req: any, res) => {
    try {
      res.setHeader("x-route-source", "tenantInvitesRoutes");
      let body: any = req.body;
      if (typeof req.body === "string") {
        try {
          body = JSON.parse(req.body);
        } catch {
          body = {};
        }
      }
      const landlordId = req.user?.landlordId || req.user?.id;
      if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
      const { tenantEmail, tenantName, propertyId, unitId, leaseId } = body || {};
      const cap = await requireCapability(landlordId, "tenant_invites", req.user);
      if (!cap.ok) {
        return res
          .status(403)
          .json({ ok: false, error: "upgrade_required", capability: "tenant_invites", plan: cap.plan });
      }

      if (!tenantEmail || !String(tenantEmail).includes("@")) {
        return res.status(400).json({ ok: false, error: "tenantEmail_required" });
      }
      if (!propertyId || !unitId) {
        return res.status(400).json({ ok: false, error: "unit_required" });
      }
      const unitEligibility = await loadEligibleUnit({
        landlordId: String(landlordId),
        propertyId: String(propertyId),
        unitId: String(unitId),
      });
      if (!unitEligibility.found) {
        return res.status(400).json({ ok: false, error: "unit_required" });
      }
      if (!unitEligibility.eligible) {
        return res.status(400).json({ ok: false, error: "lease_required" });
      }
      try {
        await db.collection("units").doc(String(unitId)).set(
          {
            status: "occupied",
            occupancyStatus: "occupied",
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      } catch (err) {
        console.warn("[tenant-invites] failed to promote unit occupancy", err);
      }
      const toEmail = String(tenantEmail || "").trim().toLowerCase();

      const token = crypto.randomBytes(24).toString("hex");
      const now = Date.now();
      const expiresAt = now + 1000 * 60 * 60 * 24 * 7;

      await db.collection("tenantInvites").doc(token).set({
        token,
        landlordId,
        tenantEmail,
        tenantName: tenantName || null,
        propertyId,
        unitId,
        leaseId: leaseId || null,
        status: "pending",
        createdAt: now,
        expiresAt,
      });

      const baseUrl = (process.env.PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
      const inviteUrl = `${baseUrl}/tenant/invite/${token}`;

      const apiKey = process.env.SENDGRID_API_KEY;
      const from =
        process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM || process.env.FROM_EMAIL;
      if (!apiKey || !from) {
        return res.json({
          ok: true,
          token,
          inviteUrl,
          expiresAt,
          invite: {
            token,
            inviteUrl,
            status: "pending",
            propertyId,
            unitId,
            tenantEmail,
            tenantName: tenantName || null,
            createdAt: now,
          },
          emailed: false,
          emailError: "SendGrid not configured",
        });
      }

      const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
        Promise.race([
          p,
          new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`SEND_TIMEOUT_${ms}MS`)), ms)),
        ]);

      let emailed = false;
      let emailError: string | null = null;
      try {
        const subject = "You're invited to RentChain";
        const landlordEmail = req.user?.email ? String(req.user.email) : "A landlord";
        const greet = tenantName ? `Hi ${tenantName},` : "Hi,";
        const text = buildEmailText({
          intro: `${greet}\n\n${landlordEmail} has invited you to join RentChain as a tenant. This link may expire.`,
          ctaText: "View invitation",
          ctaUrl: inviteUrl,
          footerNote: "If you weren't expecting this, you can ignore this email.",
        });
        const html = buildEmailHtml({
          title: "You're invited to RentChain",
          intro: `${greet} ${landlordEmail} has invited you to join RentChain as a tenant. This link may expire.`,
          ctaText: "View invitation",
          ctaUrl: inviteUrl,
          footerNote: "If you weren't expecting this, you can ignore this email.",
        });

        await withTimeout(
          sendEmail({
            to: toEmail,
            from: from as string,
            subject,
            text,
            html,
          }),
          8000
        );
        emailed = true;
      } catch (e: any) {
        emailed = false;
        emailError = String(e?.message || e);
        console.error("[tenant-invites] email send failed", {
          token,
          tenantEmail: toEmail,
          message: e?.message,
          stack: e?.stack,
        });
      }

      return res.json({
        ok: true,
        token,
        inviteUrl,
        expiresAt,
        invite: {
          token,
          inviteUrl,
          status: "pending",
          propertyId,
          unitId,
          tenantEmail,
          tenantName: tenantName || null,
          createdAt: now,
        },
        emailed,
        emailError,
      });
    } catch (err: any) {
      console.error("[tenant-invites] POST crashed", { message: err?.message, stack: err?.stack });
      return res
        .status(502)
        .json({ ok: false, error: "INVITE_CREATE_FAILED", detail: String(err?.message || err) });
    }
  }
);

router.get(
  "/",
  requireLandlordOrAdmin,
  async (req: any, res) => {
    res.setHeader("x-route-source", "tenantInvitesRoutes:getList");

    try {
      const landlordId = req.user?.landlordId || req.user?.id;
      if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

      const limitRaw = Number(req.query?.limit ?? 50);
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;

      const snap = await db
        .collection("tenantInvites")
        .where("landlordId", "==", landlordId)
        .limit(limit)
        .get();

      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

      const toMillis = (v: any) =>
        v?.toMillis?.() ?? (typeof v === "number" ? v : Date.parse(v ?? "")) ?? 0;

      items.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

      return res.json({ ok: true, invites: items });
    } catch (err: any) {
      console.error("[tenantInvitesRoutes:getList] error", err?.message || err, err);
      return res.status(500).json({ ok: false, error: "Failed to load invites" });
    }
  }
);

router.post("/redeem", async (req: any, res) => {
  res.setHeader("x-route-source", "tenantInvitesRoutes");
  const token = String(req.body?.token || req.body?.inviteId || "").trim();
  if (!token) return res.status(400).json({ ok: false, error: "token_required" });

  const ref = db.collection("tenantInvites").doc(token);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ ok: false, error: "invite_not_found" });

  const invite = snap.data() as any;
  if (Date.now() > invite.expiresAt) {
    return res.status(400).json({ ok: false, error: "invite_expired" });
  }

  const alreadyRedeemed = invite.status === "redeemed";

  const tenantId =
    invite.tenantId ||
    crypto
      .createHash("sha256")
      .update(`${invite.landlordId}:${invite.tenantEmail}`.toLowerCase())
      .digest("hex")
      .slice(0, 24);

  // Resolve property/unit/lease from existing tenant record if invite lacks them
  let resolvedPropertyId = invite.propertyId || null;
  let resolvedUnitId = invite.unitId || null;
  let resolvedLeaseId = invite.leaseId || null;
  try {
    const tenantSnap = await db.collection("tenants").doc(tenantId).get();
    if (tenantSnap.exists) {
      const t = tenantSnap.data() as any;
      resolvedPropertyId = resolvedPropertyId || t?.propertyId || null;
      resolvedUnitId = resolvedUnitId || t?.unitId || t?.unit || null;
      resolvedLeaseId = resolvedLeaseId || t?.leaseId || null;
    }
  } catch (err) {
    console.warn("[tenant-invites] resolve tenant doc failed", err);
  }

  const now = Date.now();
  await db
    .collection("tenants")
    .doc(tenantId)
    .set(
      {
        id: tenantId,
        landlordId: invite.landlordId,
        email: invite.tenantEmail,
        fullName: invite.tenantName || null,
        propertyId: resolvedPropertyId || null,
        unitId: resolvedUnitId || null,
        leaseId: resolvedLeaseId || null,
        status: "active",
        createdAt: invite.tenantId ? invite.createdAt || now : now,
        updatedAt: now,
        source: "invite",
      },
      { merge: true }
    );

  try {
    await createTenancyIfMissing({
      tenantId,
      landlordId: invite.landlordId,
      propertyId: resolvedPropertyId || null,
      unitId: resolvedUnitId || null,
      unitLabel: resolvedUnitId || null,
      moveInAt: null,
    });
  } catch (err) {
    console.warn("[tenant-invites] tenancy backfill failed", err);
  }

  if (resolvedUnitId) {
    try {
      const unitRef = db.collection("units").doc(String(resolvedUnitId));
      const unitSnap = await unitRef.get();
      if (unitSnap.exists) {
        const unit = unitSnap.data() as any;
        const matchesLandlord =
          !unit?.landlordId || String(unit.landlordId) === String(invite.landlordId);
        if (matchesLandlord) {
          await unitRef.set(
            {
              status: "occupied",
              occupancyStatus: "occupied",
              currentTenantId: tenantId,
              updatedAt: now,
            },
            { merge: true }
          );
        }
      }
    } catch (err) {
      console.warn("[tenant-invites] failed to update unit occupancy", err);
    }
  }

  await ref.set(
    {
      status: "redeemed",
      redeemedAt: invite.redeemedAt || Date.now(),
      tenantId,
    },
    { merge: true }
  );

  const tenantJwt = signTenantJwt({
    sub: tenantId,
    role: "tenant",
    tenantId,
    landlordId: invite.landlordId,
    email: invite.tenantEmail,
    propertyId: resolvedPropertyId,
    unitId: resolvedUnitId,
    leaseId: resolvedLeaseId,
  });

  return res.json({
    ok: true,
    tenantToken: tenantJwt,
    tenantId,
    landlordId: invite.landlordId,
    propertyId: resolvedPropertyId,
    unitId: resolvedUnitId,
    leaseId: resolvedLeaseId,
    tenant: {
      id: tenantId,
      email: invite.tenantEmail,
      propertyId: resolvedPropertyId,
      unitId: resolvedUnitId,
      leaseId: resolvedLeaseId,
      landlordId: invite.landlordId,
    },
    alreadyRedeemed,
  });
});

export default router;
