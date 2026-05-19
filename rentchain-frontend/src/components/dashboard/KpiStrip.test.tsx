import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KpiStrip } from "./KpiStrip";

describe("KpiStrip", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(max-width: 767px)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("stacks top dashboard KPI cards with mobile spacing", () => {
    const { container } = render(
      <MemoryRouter>
        <KpiStrip
          kpis={{
            propertiesCount: 2,
            unitsCount: 4,
            tenantsCount: 3,
            openActionsCount: 1,
            delinquentCount: 0,
          }}
        />
      </MemoryRouter>
    );

    const grid = container.firstElementChild as HTMLElement;
    expect(grid).toHaveStyle({ gridTemplateColumns: "1fr", gap: "16px", minWidth: "0", width: "100%", boxSizing: "border-box" });
    expect(screen.getByText("Properties")).toBeInTheDocument();
    expect(screen.getByText("Units")).toBeInTheDocument();
  });

  it("uses safe desktop grid tracks that cannot overflow the container width", () => {
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { container } = render(
      <MemoryRouter>
        <KpiStrip
          kpis={{
            propertiesCount: 2,
            unitsCount: 4,
            tenantsCount: 3,
            openActionsCount: 1,
            delinquentCount: 0,
          }}
        />
      </MemoryRouter>
    );

    const grid = container.firstElementChild as HTMLElement;
    expect(grid).toHaveStyle({
      gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
      width: "100%",
      boxSizing: "border-box",
    });
  });
});
