// rentchain-frontend/src/hooks/useBlockchain.ts
import { useEffect, useState } from "react";
import { fetchBlockchain } from "@/api/blockchainApi";
import type { BlockchainBlock, BlockchainResponse } from "@/api/blockchainApi";

export function useBlockchain() {
  const [blocks, setBlocks] = useState<BlockchainBlock[]>([]);
  const [length, setLength] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data: BlockchainResponse = await fetchBlockchain();
        if (!cancelled) {
          setBlocks(data.blocks || []);
          setLength(data.length ?? data.blocks?.length ?? 0);
        }
      } catch (err: any) {
        console.error("[useBlockchain] error:", err);
        if (!cancelled) {
          setError(err?.message ?? "Failed to load blockchain");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const head = blocks.length > 0 ? blocks[blocks.length - 1] : null;

  return { blocks, length, head, loading, error };
}
