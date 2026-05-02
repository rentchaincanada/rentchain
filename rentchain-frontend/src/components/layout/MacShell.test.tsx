import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MacShell } from "./MacShell";

vi.mock("./TopNav", () => ({
  default: () => <div>Top nav</div>,
}));

describe("MacShell", () => {
  it("keeps its desktop page padding while exposing a mobile-safe shell class", () => {
    render(
      <MacShell showTopNav={false}>
        <div>Shell content</div>
      </MacShell>
    );

    const main = screen.getByText("Shell content").closest("main");
    expect(main).toHaveClass("rc-mac-shell-main");
    expect(main).toHaveStyle({ margin: "0 auto" });
  });
});
