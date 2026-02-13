import { Router } from "express";
import { createHash, randomBytes } from "crypto";
import { authenticateJwt } from "../middleware/authMiddleware";
import { db } from "../config/firebase";
import { requireCapability } from "../services/capabilityGuard";
import { buildEmailHtml, buildEmailText } from "../email/templates/baseEmailTemplate";
import { sendEmail } from "../services/emailService";

const router = Router();

async function ensurePropertyOwned(propertyId: string, landlordId: string) {
  const snap = await db.collection("properties").doc(propertyId).get();
  if (!snap.exists) return { ok: false as const, code: "NOT_FOUND" as const };
  const data = snap.data() as any;
  if ((data?.landlordId || data?.ownerId || data?.owner) !== landlordId) {
    return { ok: false as const, code: "FORBIDDEN" as const };
  }
  return { ok: true as const, data };
}

router.post("/", authenticateJwt, async (req: any, res) => {
  res.setHeader("x-route-source", "landlordApplicationLinksRoutes");
  try {
    const role = String(req.user?.role || "");
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    const landlordId = req.user?.landlordId || req.user?.id;
    const propertyId = String(req.body?.propertyId || "").trim();
    const unitIdRaw = req.body?.unitId;
    const unitId = unitIdRaw === null || unitIdRaw === undefined ? "" : String(unitIdRaw).trim();
    const expiresInDaysRaw = Number(req.body?.expiresInDays ?? 14);
    const applicantEmailRaw = req.body?.applicantEmail;
    const applicantEmail = typeof applicantEmailRaw === "string" ? applicantEmailRaw.trim() : "";

    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const cap = await requireCapability(landlordId, "applications");
    if (!cap.ok) {
      return res.status(403).json({
        ok: false,
        error: "Upgrade required",
        capability: "applications",
        plan: cap.plan,
      });
    }
    if (!propertyId) {
      return res.status(400).json({ ok: false, error: "propertyId is required" });
    }

    const ownership = await ensurePropertyOwned(propertyId, landlordId);
    if (!ownership.ok) {
      if (ownership.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "Property not found" });
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    let unitData: any | null = null;
    if (unitId) {
      const unitSnap = await db.collection("units").doc(unitId).get();
      if (!unitSnap.exists) {
        return res.status(404).json({ ok: false, error: "Unit not found" });
      }
      const unit = unitSnap.data() as any;
      unitData = unit;
      if (unit?.landlordId !== landlordId) {
        return res.status(403).json({ ok: false, error: "Forbidden" });
      }
      if (unit?.propertyId && unit.propertyId !== propertyId) {
        return res.status(400).json({ ok: false, error: "Unit does not belong to property" });
      }
    }

    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const now = Date.now();
    const expiresInDays = Number.isFinite(expiresInDaysRaw)
      ? Math.min(Math.max(expiresInDaysRaw, 1), 60)
      : 14;
    const expiresAt = now + expiresInDays * 24 * 60 * 60 * 1000;

    const ref = await db.collection("applicationLinks").add({
      landlordId,
      propertyId,
      unitId: unitId || null,
      createdAt: now,
      expiresAt,
      status: "ACTIVE",
      tokenHash,
    });

    const baseUrl = (process.env.PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
    const applicationUrl = `${baseUrl}/apply/${encodeURIComponent(token)}`;

    let emailed = false;
    let emailError: string | undefined;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const hasValidEmail = !!(applicantEmail && emailRegex.test(applicantEmail));

    if (applicantEmail && !hasValidEmail) {
      emailError = "INVALID_APPLICANT_EMAIL";
    } else if (hasValidEmail) {
      const apiKey = process.env.SENDGRID_API_KEY;
      const from =
        process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM || process.env.FROM_EMAIL;
      const replyTo = process.env.SENDGRID_REPLY_TO || process.env.SENDGRID_REPLYTO_EMAIL;

      if (!apiKey || !from) {
        emailError = "EMAIL_NOT_CONFIGURED";
      } else {
        try {
          const prop = ownership.data || {};
          const addressLine1 = prop.addressLine1 || prop.name || "Property";
          const addressLine2 = prop.addressLine2 || "";
          const city = prop.city || "";
          const region = prop.province || prop.state || "";
          const postal = prop.postalCode || prop.postal || "";
          const propertyAddress = [addressLine1, addressLine2, city, region, postal]
            .filter((v) => String(v || "").trim())
            .join(", ");
          const unitLabel = unitData?.unitNumber || unitData?.name || unitData?.label || "";
          const rentValue =
            unitData?.rent ??
            unitData?.monthlyRent ??
            unitData?.marketRent ??
            prop?.rent ??
            prop?.monthlyRent ??
            null;
          const rentAmount =
            typeof rentValue === "number" && Number.isFinite(rentValue)
              ? `$${rentValue.toFixed(0)}`
              : null;
          const subjectUnit = unitLabel ? ` Unit ${unitLabel}` : "";
          const subject = `Rental Application — ${addressLine1}${subjectUnit}`;
          const expiresAtFormatted = new Date(expiresAt).toLocaleDateString();

          await sendEmail({
            to: applicantEmail,
            from,
            replyTo: replyTo || from,
            subject,
            text: buildEmailText({
              intro: `Hello,\n\nThank you for your interest in the property listed below.\nProperty: ${propertyAddress || addressLine1}${unitLabel ? `\nUnit: ${unitLabel}` : ""}${rentAmount ? `\nRent: ${rentAmount}` : ""}\n\nThis application link expires on ${expiresAtFormatted}.`,
              ctaText: "Complete application",
              ctaUrl: applicationUrl,
              footerNote: "If you weren't expecting this invite, you can ignore this email.",
            }),
            html: buildEmailHtml({
              title: "Complete your rental application",
              intro: `Thank you for your interest in ${propertyAddress || addressLine1}.${unitLabel ? ` Unit: ${unitLabel}.` : ""}${rentAmount ? ` Rent: ${rentAmount}.` : ""} This application link expires on ${expiresAtFormatted}.`,
              ctaText: "Complete Application",
              ctaUrl: applicationUrl,
              footerNote: "If you weren't expecting this invite, you can ignore this email.",
            }),
          });
          emailed = true;
        } catch (err: any) {
          emailed = false;
          emailError = err?.message || "SEND_FAILED";
          console.error("[application-links] email send failed", {
            applicantEmail,
            propertyId,
            unitId,
            errMessage: err?.message,
            errBody: err?.response?.body,
          });
        }
      }
    }

    return res.json({
      ok: true,
      data: {
        id: ref.id,
        url: applicationUrl,
        expiresAt,
      },
      emailed,
      emailError,
    });
  } catch (err: any) {
    console.error("[application-links] create failed", err?.message || err, err);
    return res.status(500).json({ ok: false, error: "Failed to create application link" });
  }
});

export default router;
