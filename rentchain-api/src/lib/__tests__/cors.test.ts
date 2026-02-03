import { describe, it, expect } from "vitest";
import { isOriginAllowed } from "../cors";

describe("isOriginAllowed", () => {
  it("allows same-origin or missing origin", () => {
    expect(isOriginAllowed(undefined)).toBe(true);
    expect(isOriginAllowed(null)).toBe(true);
  });

  it("allows localhost preview ports", () => {
    expect(isOriginAllowed("http://localhost:5173")).toBe(true);
    expect(isOriginAllowed("http://localhost:4173")).toBe(true);
    expect(isOriginAllowed("http://localhost:4174")).toBe(true);
    expect(isOriginAllowed("http://localhost:3000")).toBe(true);
  });

  it("allows vercel preview hosts", () => {
    expect(isOriginAllowed("https://example.vercel.app")).toBe(true);
    expect(isOriginAllowed("https://foo-bar.vercel.app")).toBe(true);
  });

  it("allows prod domains", () => {
    expect(isOriginAllowed("https://www.rentchain.ai")).toBe(true);
    expect(isOriginAllowed("https://rentchain.ai")).toBe(true);
  });

  it("rejects unknown origins", () => {
    expect(isOriginAllowed("https://example.com")).toBe(false);
  });
});
