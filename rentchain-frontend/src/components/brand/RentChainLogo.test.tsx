import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { RentChainLogo } from "./RentChainLogo";

describe("RentChainLogo", () => {
  afterEach(cleanup);
  it("renders an accessible linked lockup with a decorative mark", () => {
    render(<MemoryRouter><RentChainLogo href="/site" /></MemoryRouter>);

    const link = screen.getByRole("link", { name: "RentChain home" });
    expect(link).toHaveAttribute("href", "/site");
    expect(link).toHaveTextContent("RentChain");
    expect(link.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("renders an accessible standalone mark without visible text", () => {
    render(<RentChainLogo variant="mark" size="sm" />);

    expect(screen.getByLabelText("RentChain")).toHaveClass("rc-logo-link-sm");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByText("RentChain")).not.toBeInTheDocument();
  });

  it("supports wordmark and inverse presentation without a duplicate image", () => {
    const { container } = render(<RentChainLogo variant="wordmark" tone="inverse" size="lg" />);

    expect(within(container).getByText("RentChain")).toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(container.firstChild).toHaveClass("rc-logo-link-inverse", "rc-logo-link-lg");
  });
});
