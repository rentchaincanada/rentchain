import type {
  BureauAdapter,
  NormalizedScreeningEvent,
  NormalizedScreeningStatus,
} from "../types";

const notImplemented = () => {
  throw new Error("Not implemented");
};

export class EquifaxProvider implements BureauAdapter {
  providerId = "equifax" as const;

  async startScreeningRedirect(_input: {
    applicationId: string;
  }): Promise<{ redirectUrl: string; requestId: string }> {
    return notImplemented();
  }

  async getScreeningStatus(
    _requestId: string
  ): Promise<{ status: NormalizedScreeningStatus; updatedAt: string }> {
    return notImplemented();
  }

  async fetchReportSummary(_requestId: string): Promise<{ available: boolean; scoreBand?: string }> {
    return notImplemented();
  }

  async listScreeningsForLandlord(_landlordId: string): Promise<NormalizedScreeningEvent[]> {
    return notImplemented();
  }
}
