import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../../context/LanguageContext";
import LegalHelpPage from "./LegalHelpPage";

vi.mock("../../context/useAuth", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("../../lib/analytics", () => ({
  track: vi.fn(),
}));

function renderLegalHelpPage() {
  return render(
    <MemoryRouter initialEntries={["/site/legal"]}>
      <LanguageProvider>
        <LegalHelpPage />
      </LanguageProvider>
    </MemoryRouter>
  );
}

describe("LegalHelpPage", () => {
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

  it("renders the public legal hub in the warm neutral shell", () => {
    const { container } = renderLegalHelpPage();

    expect(screen.getByRole("heading", { name: "Legal" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("button", { name: "Expand Ask RentChain widget" })).toHaveStyle({
      background: "rgba(234, 223, 205, 0.72)",
      color: "#171411",
    });
    expect(container.firstElementChild).toHaveStyle({
      background: "#f4efe6",
      color: "#171411",
    });
  });
});
