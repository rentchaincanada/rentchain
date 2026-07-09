import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../../context/LanguageContext";
import TermsPage from "./TermsPage";

vi.mock("../../context/useAuth", () => ({
  useAuth: () => ({ user: null }),
}));

function renderTermsPage() {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <TermsPage />
      </LanguageProvider>
    </MemoryRouter>
  );
}

describe("TermsPage", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  it("renders the terms in the warm neutral public legal shell without changing copy", () => {
    const { container } = renderTermsPage();

    expect(screen.getByRole("heading", { name: "Terms of Service" })).toBeInTheDocument();
    expect(screen.getByText("Effective date: 2026-01-21")).toBeInTheDocument();
    expect(screen.getByText(/RentChain provides governed operational infrastructure/)).toBeInTheDocument();
    expect(container.firstElementChild).toHaveStyle({
      background: "#f4efe6",
      color: "#171411",
    });
  });
});
