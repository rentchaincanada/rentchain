import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ViewingStatusBadge } from "./ViewingStatusBadge";

describe("ViewingStatusBadge", () => {
  it.each([
    ["requested", "Viewing requested"],
    ["slots_proposed", "Times proposed"],
    ["scheduled", "Viewing scheduled"],
    ["completed", "Viewing completed"],
    ["cancelled", "Viewing cancelled"],
  ] as const)("renders %s label", (status, label) => {
    render(<ViewingStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
