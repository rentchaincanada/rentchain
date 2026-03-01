import type { BureauAdapter } from "../types";
import { MockProvider } from "../mock/MockProvider";
import { EquifaxProvider } from "../providers/EquifaxProvider";
import { TransUnionProvider } from "../providers/TransUnionProvider";

export function getBureauAdapter(): BureauAdapter {
  const provider = import.meta.env.VITE_BUREAU_PROVIDER ?? "transunion";

  switch (provider) {
    case "transunion":
      return new TransUnionProvider();
    case "equifax":
      return new EquifaxProvider();
    case "mock":
      return new MockProvider();
    default:
      return new TransUnionProvider();
  }
}
