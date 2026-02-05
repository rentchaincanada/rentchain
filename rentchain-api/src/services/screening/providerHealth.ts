import { getBureauProvider } from "./providers/bureauProvider";

export type ScreeningProviderHealth = {
  provider: string;
  configured: boolean;
  preflightOk: boolean;
  preflightDetail?: string | null;
};

export async function getScreeningProviderHealth(): Promise<ScreeningProviderHealth> {
  const provider = getBureauProvider();
  const configured = provider.isConfigured();
  let preflightOk = false;
  let preflightDetail: string | null = null;

  if (configured) {
    const result = await provider.preflight();
    preflightOk = Boolean(result.ok);
    preflightDetail = result.detail || null;
  } else {
    preflightDetail = "not_configured";
  }

  return {
    provider: provider.name,
    configured,
    preflightOk,
    preflightDetail,
  };
}
