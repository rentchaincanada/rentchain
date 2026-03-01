import { getShadowTimeoutMs, shouldShadowRun } from "./shadowMode";

export async function runShadowTask<T>(args: {
  name: string;
  seedKey: string;
  timeoutMs?: number;
  task: () => Promise<T>;
  onResult?: (result: T) => void;
  onError?: (error: unknown) => void;
}): Promise<void> {
  const { seedKey, timeoutMs, task, onResult, onError } = args;
  if (!shouldShadowRun(seedKey)) return;

  const effectiveTimeoutMs = timeoutMs ?? getShadowTimeoutMs();
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error("shadow_timeout")), effectiveTimeoutMs);
    });
    const result = await Promise.race([task(), timeoutPromise]);
    onResult?.(result as T);
  } catch (error) {
    onError?.(error);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}
