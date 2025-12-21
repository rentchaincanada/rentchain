import {
  createScreeningRequestForApplication,
  markScreeningPaid,
  completeScreening,
  sanitizeScreeningResponse,
} from "./screeningRequestService";
import { getApplicationById, saveApplication } from "./applicationsService";
import {
  decrementScreeningCredit,
  ensureLandlordProfile,
} from "./landlordProfileService";
import { recordScreeningCreditUsed } from "./screeningCreditEventsService";
import { recordApplicationEvent } from "./applicationEventsService";
import { getFlags } from "./featureFlagService";

export async function runScreeningWithCredits(options: {
  landlordId: string;
  landlordEmail?: string;
  applicationId: string;
}): Promise<{
  screeningRequest?: any;
  screeningId?: string;
  status: string;
  message?: string;
}> {
  const application = getApplicationById(options.applicationId);
  if (!application) {
    return { status: "error", message: "Application not found" };
  }

  const existingProfile = ensureLandlordProfile(options.landlordId, options.landlordEmail);
  if (!existingProfile || existingProfile.screeningCredits <= 0) {
    return { status: "blocked_no_credits" };
  }

  const debit = decrementScreeningCredit({
    landlordId: options.landlordId,
    email: options.landlordEmail,
  });
  if (!debit.ok) {
    return { status: "blocked_no_credits" };
  }

  const screeningRequest = createScreeningRequestForApplication({
    applicationId: application.id,
    landlordId: options.landlordId,
    landlordEmail: options.landlordEmail,
    providerOverride: getFlags().useSingleKeyForNewScreenings ? "singlekey" : undefined,
  });

  screeningRequest.status = "paid";
  screeningRequest.paidAt = new Date().toISOString();
  markScreeningPaid(screeningRequest.id);
  completeScreening(screeningRequest.id);

  recordScreeningCreditUsed({
    landlordId: options.landlordId,
    referenceId: screeningRequest.id,
  });

  recordApplicationEvent({
    applicationId: application.id,
    type: "screening_paid",
    message: "Screening credit used",
    actor: "landlord",
    metadata: { screeningRequestId: screeningRequest.id },
  });

  saveApplication({
    ...application,
    screeningStatus: "completed",
    screeningRequestId: screeningRequest.id,
  });

  return {
    screeningRequest: sanitizeScreeningResponse(screeningRequest),
    screeningId: screeningRequest.id,
    status: "completed",
  };
}
