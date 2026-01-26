export function buildScreeningStatusPayload(data: any) {
  return {
    status: data?.screeningStatus || null,
    paidAt: data?.screeningPaidAt ?? null,
    startedAt: data?.screeningStartedAt ?? null,
    completedAt: data?.screeningCompletedAt ?? null,
    lastUpdatedAt: data?.screeningLastUpdatedAt ?? null,
    provider: data?.screeningProvider ?? null,
    summary: data?.screeningResultSummary ?? null,
    resultId: data?.screeningResultId ?? null,
  };
}
