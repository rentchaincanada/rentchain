import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve("src/components/properties/UnitEditModal.css"), "utf8");

describe("UnitEditModal responsive layout contract", () => {
  it("uses the changing visual viewport with safe-area-aware fallbacks", () => {
    expect(css).toContain("100svh");
    expect(css).toContain("100dvh");
    expect(css).toContain("env(safe-area-inset-top, 0px)");
    expect(css).toContain("env(safe-area-inset-bottom, 0px)");
  });

  it("keeps the panel bounded while only the form body scrolls", () => {
    expect(css).toMatch(/\.rc-unit-edit-panel\s*\{[\s\S]*?overflow:\s*hidden;/);
    expect(css).toMatch(/\.rc-unit-edit-body\s*\{[\s\S]*?min-height:\s*0;/);
    expect(css).toMatch(/\.rc-unit-edit-body\s*\{[\s\S]*?overflow-y:\s*auto;/);
    expect(css).toMatch(/\.rc-unit-edit-body\s*\{[\s\S]*?overscroll-behavior:\s*contain;/);
  });

  it("keeps header and actions outside the shrinking scroll region", () => {
    expect(css).toMatch(/\.rc-unit-edit-header,[\s\S]*?\.rc-unit-edit-actions\s*\{[\s\S]*?flex:\s*0 0 auto;/);
    expect(css).toMatch(/\.rc-unit-edit-actions\s*\{[\s\S]*?padding-bottom:\s*max\(16px, env\(safe-area-inset-bottom, 0px\)\);/);
  });

  it("keeps phone actions tappable and the overlay above landlord navigation", () => {
    expect(css).toMatch(/\.rc-unit-edit-overlay\s*\{[\s\S]*?z-index:\s*4030;/);
    expect(css).toMatch(/@media \(max-width: 768px\)[\s\S]*?\.rc-unit-edit-actions button\s*\{[\s\S]*?min-height:\s*44px;/);
  });
});
