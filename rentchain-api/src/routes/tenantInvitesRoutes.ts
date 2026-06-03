import { Router } from "express";
import { db } from "../firebase";
import { requireLandlordOrAdmin } from "../middleware/requireLandlordOrAdmin";
import { requireAuth } from "../middleware/requireAuth";
import { rateLimitTenantInvitesUser } from "../middleware/rateLimit";
import { sendEmail } from "../services/emailService";
import { buildEmailHtml, buildEmailText } from "../email/templates/baseEmailTemplate";
import { requireCapability } from "../services/capabilityGuard";
import {
  createReplacementTenancyInvite,
  listTenancyInvitesForLandlord,
  redeemTenancyInvite,
} from "../services/tenantPortal/tenantInviteService";

const router = Router();

async function loadEligibleUnit(opts: {
  landlordId: string;
  propertyId: string;
  unitId: string;
}): Promise<{ found: boolean }> {
  const unitSnap = await db.collection("units").doc(opts.unitId).get();
  if (!unitSnap.exists) return { found: false };

  const unit = unitSnap.data() as any;
  if (
    String(unit?.landlordId || "") !== opts.landlordId ||
    String(unit?.propertyId || "") !== opts.propertyId
  ) {
    return { found: false };
  }

  return { found: true };
}

router.post("/", requireAuth, requireLandlordOrAdmin, rateLimitTenantInvitesUser, async (req: any, res) => {
  try {
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const { tenantEmail, tenantName, propertyId, unitId, leaseId, applicationId } = req.body || {};
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
      landlordId,
      propertyId: String(propertyId),
      unitId: String(unitId),
    });
    if (!unitEligibility.found) {
      return res.status(400).json({ ok: false, error: "unit_required" });
    }

    let rcPropId: string | null = null;
    try {
      const propertySnap = await db.collection("properties").doc(String(propertyId)).get();
      if (propertySnap.exists) {
        const property = propertySnap.data() as any;
        rcPropId = String(property?.rc_prop_id || "").trim() || null;
      }
    } catch {
      rcPropId = null;
    }

    const created = await createReplacementTenancyInvite({
      landlordId,
      rcPropId,
      propertyId: String(propertyId),
      applicationId: String(applicationId || "").trim() || null,
      invitedEmail: String(tenantEmail),
      invitedName: String(tenantName || "").trim() || null,
      unitId: String(unitId || "").trim() || null,
      leaseId: String(leaseId || "").trim() || null,
      createdBy: String(req.user?.id || landlordId),
    });

    const baseUrl = String(process.env.PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
    const inviteUrl = `${baseUrl}/tenant/invite/${created.token}`;

    const from = process.env.EMAIL_FROM || process.env.FROM_EMAIL;
    if (!from) {
      return res.json({
        ok: true,
        inviteUrl,
        expiresAt: created.invite.expiresAt,
        invite: created.invite,
        replacedInviteId: created.replacedInviteId,
        emailed: false,
        emailError: "EMAIL_NOT_CONFIGURED",
      });
    }

    let emailed = false;
    let emailError: string | null = null;
    try {
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

      await sendEmail({
        to: String(tenantEmail).trim().toLowerCase(),
        from: from as string,
        subject: "You're invited to RentChain",
        text,
        html,
      });
      emailed = true;
    } catch (error: any) {
      emailError = String(error?.message || error);
    }

    return res.json({
      ok: true,
      inviteUrl,
      expiresAt: created.invite.expiresAt,
      invite: created.invite,
      replacedInviteId: created.replacedInviteId,
      emailed,
      emailError,
    });
  } catch (error: any) {
    return res.status(502).json({
      ok: false,
      error: "INVITE_CREATE_FAILED",
      detail: String(error?.message || error),
    });
  }
});

router.get("/", requireAuth, requireLandlordOrAdmin, async (req: any, res) => {
  try {
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
    const invites = await listTenancyInvitesForLandlord(landlordId);
    return res.json({ ok: true, invites });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: "Failed to load invites" });
  }
});

router.post("/redeem", requireAuth, async (req: any, res) => {
  const token = String(req.body?.token || req.body?.inviteId || "").trim();
  if (!token) return res.status(400).json({ ok: false, error: "token_required" });

  const redeemed = await redeemTenancyInvite({
    token,
    redeemedByUid: String(req.user?.id || "").trim(),
    redeemedByEmail: String(req.user?.email || "").trim() || null,
  });

  if (!redeemed.ok) {
    const status =
      redeemed.error === "invite_not_found"
        ? 404
        : redeemed.error === "invite_used"
        ? 409
        : redeemed.error === "invite_email_mismatch"
        ? 403
        : 400;
    return res.status(status).json({ ok: false, error: redeemed.error });
  }

  return res.json({
    ok: true,
    invite: redeemed.invite,
    linked: {
      propertyId: redeemed.invite?.propertyId || null,
      tenantId: redeemed.invite?.tenantId || null,
      applicationId: redeemed.invite?.applicationId || null,
      leaseId: redeemed.invite?.leaseId || null,
      rc_prop_id: redeemed.invite?.rc_prop_id || null,
    },
  });
});

export default router;
