import crypto from "crypto";
import { db } from "../config/firebase";
import { setMicroLiveForLandlord } from "./microLive";

function normEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function maybeGrantMicroLiveFromLead(emailRaw: string, landlordId: string) {
  const email = normEmail(emailRaw);
  if (!email || !email.includes("@") || !landlordId) return { granted: false, reason: "missing email/landlordId" };

  const waitlistId = sha256(email);
  const leadRef = db.collection("landlord_leads").doc(waitlistId);
  const leadSnap = await leadRef.get();
  const now = Date.now();

  if (leadSnap.exists) {
    const lead = leadSnap.data() as any;
    const status = String(lead?.status || "");
    if (status === "invite-accepted" || status === "account-created") {
      await db.runTransaction(async (tx: any) => {
        const leadFresh = await tx.get(leadRef);
        const leadData = leadFresh.data() as any;

        const wlRef = db.collection("waitlist").doc(waitlistId);
        const wlSnap = await tx.get(wlRef);
        const wlStatus = String((wlSnap.data() as any)?.status || "");
        if (wlStatus === "unsubscribed") return;

        tx.set(
          leadRef,
          {
            landlordId,
            status: "account-created",
            accountCreatedAt: leadData?.accountCreatedAt || now,
            updatedAt: now,
          },
          { merge: true }
        );
      });

      await setMicroLiveForLandlord(landlordId, true, { source: "lead", waitlistId, email });
      return { granted: true, waitlistId };
    }
    return { granted: false, reason: `lead status=${status}` };
  }

  const qs = await db.collection("landlord_leads").where("email", "==", email).limit(1).get();
  if (!qs.empty) {
    const doc = qs.docs[0];
    const lead = doc.data() as any;
    const status = String(lead?.status || "");
    if (status === "invite-accepted" || status === "account-created") {
      await db.runTransaction(async (tx: any) => {
        const leadRef2 = db.collection("landlord_leads").doc(doc.id);
        const leadFresh = await tx.get(leadRef2);
        const leadData = leadFresh.data() as any;

        const wlId = String(leadData?.waitlistId || "");
        if (wlId) {
          const wlRef = db.collection("waitlist").doc(wlId);
          const wlSnap = await tx.get(wlRef);
          const wlStatus = String((wlSnap.data() as any)?.status || "");
          if (wlStatus === "unsubscribed") return;
        }

        tx.set(
          leadRef2,
          {
            landlordId,
            status: "account-created",
            accountCreatedAt: leadData?.accountCreatedAt || now,
            updatedAt: now,
          },
          { merge: true }
        );
      });

      await setMicroLiveForLandlord(landlordId, true, { source: "lead-query", leadId: doc.id, email });
      return { granted: true, leadId: doc.id };
    }
    return { granted: false, reason: `lead status=${status}` };
  }

  return { granted: false, reason: "no matching lead" };
}
