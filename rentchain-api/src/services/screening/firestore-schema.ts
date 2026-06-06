export const providerNeutralScreeningCollections = {
  requests: "screeningRequests",
  results: "screeningResults",
  consents: "screeningConsents",
  webhookLogs: "screeningWebhookLogs",
} as const;

export const providerNeutralScreeningIndexes = [
  { collection: "screeningConsents", fields: ["tenantId", "status"] },
  { collection: "screeningRequests", fields: ["landlordId", "unitId", "status"] },
  { collection: "screeningResults", fields: ["requestId", "landlordId"] },
  { collection: "screeningWebhookLogs", fields: ["providerId", "timestamp"] },
] as const;
