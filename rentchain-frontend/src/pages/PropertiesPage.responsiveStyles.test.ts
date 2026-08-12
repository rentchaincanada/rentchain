import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const propertiesPageCss = readFileSync(resolve("src/pages/PropertiesPage.css"), "utf8");
const propertiesMobileCss = readFileSync(resolve("src/styles/propertiesMobile.css"), "utf8");

describe("Properties mobile layout contract", () => {
  it("recovers the nested shell gutter only on phones and keeps the page bounded", () => {
    expect(propertiesPageCss).toContain("@media (max-width: 480px)");
    expect(propertiesPageCss).toContain("width: calc(100% + 28px)");
    expect(propertiesPageCss).toContain("margin-inline: -14px");
    expect(propertiesPageCss).toContain("padding: 10px");
  });

  it("removes redundant mobile detail insets without changing the desktop card rule", () => {
    expect(propertiesPageCss).toContain(".rc-properties-page .rc-properties-detail-card");
    expect(propertiesPageCss).toContain("padding: 0");
    expect(propertiesPageCss).toContain(".rc-properties-page .rc-property-detail-stack");
    expect(propertiesPageCss).toContain("width: min(100%, 1180px)");
  });

  it("gives Unit and Status stable readable columns instead of shrinking flex items", () => {
    expect(propertiesMobileCss).toContain(
      "grid-template-columns: minmax(88px, 0.7fr) minmax(0, 1.3fr)"
    );
    expect(propertiesMobileCss).toContain(".rc-unit-card-row > *");
    expect(propertiesMobileCss).toContain("white-space: nowrap");
    expect(propertiesMobileCss).toContain("overflow-wrap: break-word");
  });

  it("retains mobile unit action sizing and the existing tablet table breakpoint", () => {
    expect(propertiesMobileCss).toContain(".rc-unit-actions button");
    expect(propertiesMobileCss).toContain("width: 100%");
    expect(propertiesMobileCss).toContain("@media (min-width: 481px) and (max-width: 768px)");
  });
});
