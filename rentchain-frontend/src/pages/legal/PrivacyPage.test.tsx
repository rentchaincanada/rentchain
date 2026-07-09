import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../../context/LanguageContext";
import PrivacyPage from "./PrivacyPage";

vi.mock("../../context/useAuth", () => ({
  useAuth: () => ({ user: null }),
}));

function renderPrivacyPage() {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <PrivacyPage />
      </LanguageProvider>
    </MemoryRouter>
  );
}

describe("PrivacyPage", () => {
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

  it("renders the privacy policy in the warm neutral public legal shell", () => {
    const { container } = renderPrivacyPage();

    expect(screen.getByRole("heading", { name: "Privacy Policy" })).toBeInTheDocument();
    expect(screen.getByText("Effective date: 2026-01-21")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveStyle({
      background: "#f4efe6",
      color: "#171411",
    });
  });
});
