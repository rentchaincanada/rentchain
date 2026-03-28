import { db } from "../../config/firebase";
import { getTransUnionIntegrationPublic } from "../integrations/transunion/transunionService";
import type {
  LandlordActivationSnapshot,
  LandlordActivationStep,
  LandlordActivationStepKey,
  LandlordActivationSummary,
} from "./landlordActivationTypes";

type StepConfig = {
  key: LandlordActivationStepKey;
  title: string;
  description: string;
  resolve: (snapshot: LandlordActivationSnapshot) => {
    completed: boolean;
    actionLabel: string;
    actionPath: string;
    blockedDescription?: string;
    blockedActionLabel?: string;
    blockedActionPath?: string;
  };
};

function withQuery(path: string, params: Record<string, string | null | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

const STEP_CONFIG: StepConfig[] = [
  {
    key: "property",
    title: "Add Property",
    description: "Add your first rental property to begin onboarding applicants.",
    resolve: (snapshot) => ({
      completed: snapshot.propertyCount > 0,
      actionLabel: "Add Property",
      actionPath: "/properties",
    }),
  },
  {
    key: "unit",
    title: "Add Unit",
    description: "Add at least one unit so applicants can be linked to a rentable space.",
    resolve: (snapshot) => ({
      completed: snapshot.unitCount > 0,
      actionLabel: "Add Unit",
      actionPath: "/properties",
      blockedDescription: "Add a property before adding a unit.",
      blockedActionLabel: "Add Property",
      blockedActionPath: "/properties",
    }),
  },
  {
    key: "applicant",
    title: "Add or Invite Applicant",
    description: "Create or invite your first applicant to begin the tenant workflow.",
    resolve: (snapshot) => ({
      completed: snapshot.applicationCount > 0,
      actionLabel: "Add Applicant",
      actionPath: "/applications?openSendApplication=1&autoSelectProperty=1",
      blockedDescription: "Add a unit before creating or inviting your first applicant.",
      blockedActionLabel: "Add Unit",
      blockedActionPath: "/properties",
    }),
  },
  {
    key: "viewing",
    title: "Request Viewing",
    description: "Schedule or request a viewing before moving to screening.",
    resolve: (snapshot) => ({
      completed: snapshot.viewingCount > 0,
      actionLabel: "Request Viewing",
      actionPath: snapshot.primaryApplicationId
        ? withQuery("/applications", { applicationId: snapshot.primaryApplicationId })
        : "/applications",
      blockedDescription: "Add or invite an applicant before requesting a viewing.",
      blockedActionLabel: "Add Applicant",
      blockedActionPath: "/applications?openSendApplication=1&autoSelectProperty=1",
    }),
  },
  {
    key: "transunion",
    title: "Connect TransUnion",
    description: "Connect your TransUnion credentials to enable screening.",
    resolve: (snapshot) => ({
      completed: snapshot.transunionStatus === "connected",
      actionLabel: "Connect TransUnion",
      actionPath: withQuery("/applications", {
        applicationId: snapshot.primaryApplicationId,
        openTransUnionConnect: "1",
      }),
      blockedDescription: "Request a viewing before connecting TransUnion for screening.",
      blockedActionLabel: "Request Viewing",
      blockedActionPath: snapshot.primaryApplicationId
        ? withQuery("/applications", { applicationId: snapshot.primaryApplicationId })
        : "/applications",
    }),
  },
  {
    key: "screening",
    title: "Start Screening",
    description: "Begin the screening process for your first applicant.",
    resolve: (snapshot) => ({
      completed: snapshot.hasScreening,
      actionLabel: "Start Screening",
      actionPath: snapshot.primaryApplicationId
        ? withQuery("/applications", { applicationId: snapshot.primaryApplicationId })
        : "/applications",
      blockedDescription:
        snapshot.transunionStatus === "connected"
          ? "Add or select an applicant before starting screening."
          : "Connect TransUnion before starting screening.",
      blockedActionLabel:
        snapshot.transunionStatus === "connected" ? "Add Applicant" : "Connect TransUnion",
      blockedActionPath:
        snapshot.transunionStatus === "connected"
          ? "/applications?openSendApplication=1&autoSelectProperty=1"
          : withQuery("/applications", {
              applicationId: snapshot.primaryApplicationId,
              openTransUnionConnect: "1",
            }),
    }),
  },
  {
    key: "decision",
    title: "Review Decision",
    description: "Review risk insights and decision support for your applicant.",
    resolve: (snapshot) => ({
      completed: snapshot.hasDecisionReview,
      actionLabel: "Review Decision",
      actionPath: snapshot.reviewApplicationId
        ? `/applications/${encodeURIComponent(snapshot.reviewApplicationId)}/review-summary`
        : "/applications",
      blockedDescription: "Start screening before reviewing a decision summary.",
      blockedActionLabel: snapshot.transunionStatus === "connected" ? "Start Screening" : "Connect TransUnion",
      blockedActionPath:
        snapshot.transunionStatus === "connected"
          ? snapshot.primaryApplicationId
            ? withQuery("/applications", { applicationId: snapshot.primaryApplicationId })
            : "/applications"
          : withQuery("/applications", {
              applicationId: snapshot.primaryApplicationId,
              openTransUnionConnect: "1",
            }),
    }),
  },
];

function getStatusOrder(snapshot: LandlordActivationSnapshot) {
  const definitions = STEP_CONFIG.map((config) => ({
    config,
    derived: config.resolve(snapshot),
  }));

  let nextStepKey: LandlordActivationStepKey | null = null;
  let priorIncomplete = false;

  const steps: LandlordActivationStep[] = definitions.map(({ config, derived }) => {
    if (derived.completed) {
      return {
        key: config.key,
        title: config.title,
        status: "completed",
        description: config.description,
        actionLabel: derived.actionLabel,
        actionPath: derived.actionPath,
      };
    }

    if (!priorIncomplete) {
      priorIncomplete = true;
      nextStepKey = config.key;
      return {
        key: config.key,
        title: config.title,
        status: "in_progress",
        description: config.description,
        actionLabel: derived.actionLabel,
        actionPath: derived.actionPath,
      };
    }

    return {
      key: config.key,
      title: config.title,
      status: "blocked",
      description: derived.blockedDescription || config.description,
      actionLabel: derived.blockedActionLabel || derived.actionLabel,
      actionPath: derived.blockedActionPath || derived.actionPath,
    };
  });

  return { steps, nextStepKey };
}

function hasDecisionReady(application: any): boolean {
  const status = String(application?.status || "").trim().toUpperCase();
  const screeningStatus = String(application?.screeningStatus || "").trim().toLowerCase();
  return (
    Boolean(application?.screeningResultSummary) ||
    screeningStatus === "complete" ||
    status === "IN_REVIEW" ||
    status === "APPROVED" ||
    status === "DECLINED" ||
    status === "CONDITIONAL_COSIGNER" ||
    status === "CONDITIONAL_DEPOSIT"
  );
}

function hasScreeningStarted(application: any): boolean {
  const status = String(application?.screeningStatus || "").trim().toLowerCase();
  return (
    status === "paid" ||
    status === "processing" ||
    status === "complete" ||
    status === "failed" ||
    status === "external_pending" ||
    Boolean(application?.screeningResultSummary) ||
    Boolean(application?.screeningResultId) ||
    Boolean(application?.screeningId)
  );
}

export function deriveLandlordActivationSummary(
  snapshot: LandlordActivationSnapshot
): LandlordActivationSummary {
  const { steps, nextStepKey } = getStatusOrder(snapshot);
  const completedCount = steps.filter((step) => step.status === "completed").length;
  return {
    steps,
    completedCount,
    totalCount: steps.length,
    nextStepKey,
  };
}

export async function getLandlordActivationSummary(
  landlordId: string
): Promise<LandlordActivationSummary> {
  const [
    propertiesSnap,
    unitsSnap,
    applicationsSnap,
    viewingSnap,
    screeningOrdersSnap,
    screeningOperationsSnap,
    transunionIntegration,
  ] = await Promise.all([
    db.collection("properties").where("landlordId", "==", landlordId).limit(3).get(),
    db.collection("units").where("landlordId", "==", landlordId).limit(3).get(),
    db.collection("rentalApplications").where("landlordId", "==", landlordId).limit(12).get(),
    db.collection("viewingRequests").where("landlordId", "==", landlordId).limit(12).get(),
    db.collection("screeningOrders").where("landlordId", "==", landlordId).limit(5).get(),
    db.collection("screeningOperations").where("landlordId", "==", landlordId).limit(5).get(),
    getTransUnionIntegrationPublic(landlordId).catch(() => ({
      provider: "transunion" as const,
      status: "not_connected",
      version: 1,
    })),
  ]);

  const applications = applicationsSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
  const primaryApplication = applications[0] || null;
  const reviewApplication =
    applications.find((application) => hasDecisionReady(application)) || primaryApplication;

  const snapshot: LandlordActivationSnapshot = {
    propertyCount: propertiesSnap.size,
    unitCount: unitsSnap.size,
    applicationCount: applicationsSnap.size,
    viewingCount: viewingSnap.size,
    transunionStatus: String(transunionIntegration?.status || "").trim().toLowerCase() || null,
    hasScreening:
      screeningOrdersSnap.size > 0 ||
      screeningOperationsSnap.size > 0 ||
      applications.some((application) => hasScreeningStarted(application)),
    hasDecisionReview: applications.some((application) => hasDecisionReady(application)),
    primaryApplicationId: primaryApplication?.id || null,
    reviewApplicationId: reviewApplication?.id || null,
  };

  return deriveLandlordActivationSummary(snapshot);
}
