// rentchain-frontend/src/hooks/useBlockchainVerify.ts
import { useCallback, useEffect, useState } from "react";
import { verifyBlockchain } from "@/api/blockchainApi";
import type { BlockchainVerifyResponse } from "@/api/blockchainApi";

export function useBlockchainVerify() {
  const [data, setData] = useState<BlockchainVerifyResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await verifyBlockchain();
      setData(result);
    } catch (err: any) {
      console.error("[useBlockchainVerify] error:", err);
      setError(err?.message ?? "Failed to verify blockchain");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  return {
    data,
    loading,
    error,
    refresh: run,
  };
}
