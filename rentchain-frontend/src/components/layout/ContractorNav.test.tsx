import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, expect, it } from "vitest";
import { ContractorNav } from "./ContractorNav";

vi.mock("../../context/useAuth", () => ({
  useAuth: () => ({ logout: vi.fn() }),
}));

describe("ContractorNav", () => {
  it("uses the shared RentChain lockup with a separate portal label", () => {
    render(
      <MemoryRouter>
        <ContractorNav><div>Contractor content</div></ContractorNav>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "RentChain home" })).toHaveAttribute("href", "/contractor");
    expect(screen.getByText("Contractor")).toBeInTheDocument();
    expect(screen.getByText("Contractor content")).toBeInTheDocument();
  });
});
