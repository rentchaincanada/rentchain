import { afterEach, describe, it, expect } from "vitest";
import { isOriginAllowed } from "../cors";

describe("isOriginAllowed", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

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

  it("allows LAN Vite origins in non-production", () => {
    process.env.NODE_ENV = "development";
    expect(isOriginAllowed("http://192.168.2.253:5173")).toBe(true);
    expect(isOriginAllowed("http://10.0.0.12:5173")).toBe(true);
    expect(isOriginAllowed("http://172.16.0.8:5173")).toBe(true);
  });

  it("rejects LAN Vite origins in production", () => {
    process.env.NODE_ENV = "production";
    expect(isOriginAllowed("http://192.168.2.253:5173")).toBe(false);
    expect(isOriginAllowed("http://10.0.0.12:5173")).toBe(false);
    expect(isOriginAllowed("http://172.16.0.8:5173")).toBe(false);
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
