import { apiJson } from "@/lib/apiClient";

export interface BlockchainBlock {
  index: number;
  eventId: string | null;
  type: string;
  tenantId: string | null;
  tenantName: string | null;
  propertyName: string | null;
  unit: string | null;
  amount: number | null;
  method: string | null;
  notes: string | null;

  timestamp: string; // ISO string
  eventDate: string | null;

  payloadHash: string;
  prevHash: string;
  hash: string;
}

export interface BlockchainResponse {
  length: number;
  blocks: BlockchainBlock[];
}

export interface BlockchainVerifyResponse {
  ok: boolean;
  message?: string;
  reason?: string;
  tenantId?: string;
  blockHeight?: number;
  rootHash?: string;
  expected?: string;
  actual?: string;
  storedSnapshot?: any;
  error?: string;
}

export async function fetchBlockchain(): Promise<BlockchainResponse> {
  return apiJson<BlockchainResponse>("/blockchain");
}

export async function verifyBlockchain(): Promise<BlockchainVerifyResponse> {
  try {
    return await apiJson<BlockchainVerifyResponse>("/blockchain/verify");
  } catch (err: any) {
    const status = err?.status ?? err?.body?.status;
    if (status === 404 || status === 403) {
      return { ok: false, message: "verification unavailable" };
    }
    throw err;
  }
}
