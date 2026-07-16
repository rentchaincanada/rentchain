import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { colors } from "../../styles/tokens";
import { Button } from "./Ui";

describe("Button brand treatments", () => {
  afterEach(cleanup);
  it("uses pine for primary actions", () => {
    render(<Button>Primary action</Button>);
    expect(screen.getByRole("button", { name: "Primary action" })).toHaveStyle({
      background: colors.pine,
      color: "#fff",
    });
  });

  it("uses a neutral paper treatment for secondary actions", () => {
    render(<Button variant="secondary">Secondary action</Button>);
    const button = screen.getByRole("button", { name: "Secondary action" });
    expect(button.style.background).toBe("rgb(255, 250, 241)");
    expect(button.style.border).toContain("rgba(15, 23, 42, 0.16)");
  });
});
