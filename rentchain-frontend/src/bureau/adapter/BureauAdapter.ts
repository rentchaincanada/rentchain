import type { BureauAdapter } from "../types";
import { MockProvider } from "../mock/MockProvider";
import { EquifaxProvider } from "../providers/EquifaxProvider";
import { TransUnionProvider } from "../providers/TransUnionProvider";

export function getBureauAdapter(): BureauAdapter {
<<<<<<< HEAD
  const raw = String(import.meta.env.VITE_BUREAU_PROVIDER || "transunion")
    .toLowerCase()
    .trim();

  const provider = (() => {
    switch (raw) {
      case "transunionadapter":
      case "tu":
        return "transunion";
      case "eq":
        return "equifax";
      case "transunion":
      case "equifax":
      case "mock":
        return raw;
      default:
        return "transunion";
    }
  })();
=======
  const provider = import.meta.env.VITE_BUREAU_PROVIDER ?? "transunion";
>>>>>>> main

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
