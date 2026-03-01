function asString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function asNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function compareQuoteResponses(legacy: any, adapter: any) {
  const fields: string[] = [];
  const legacyData = legacy?.data || {};
  const adapterData = adapter?.data || {};

  if (asNumber(legacyData.totalAmountCents) !== asNumber(adapterData.totalAmountCents)) {
    fields.push("totalAmountCents");
  }
  if (asNumber(legacyData.baseAmountCents) !== asNumber(adapterData.baseAmountCents)) {
    fields.push("baseAmountCents");
  }
  if (asString(legacyData.currency).toLowerCase() !== asString(adapterData.currency).toLowerCase()) {
    fields.push("currency");
  }

  return { isMatch: fields.length === 0, fields };
}

export function compareCheckoutResponses(legacy: any, adapter: any) {
  const fields: string[] = [];
  const legacyUrl = asString(legacy?.checkoutUrl || legacy?.url);
  const adapterUrl = asString(adapter?.checkoutUrl || adapter?.url);
  if (Boolean(legacyUrl) !== Boolean(adapterUrl)) {
    fields.push("redirectUrlPresence");
  }
  const legacyProvider = asString(legacy?.provider || legacy?.data?.provider).toLowerCase();
  const adapterProvider = asString(adapter?.provider || adapter?.data?.provider).toLowerCase();
  if (legacyProvider && adapterProvider && legacyProvider !== adapterProvider) {
    fields.push("provider");
  }
  return { isMatch: fields.length === 0, fields };
}

