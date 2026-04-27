import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GetTransUnionAccessModal } from "./GetTransUnionAccessModal";

describe("GetTransUnionAccessModal", () => {
  const assignMock = vi.fn();
  const writeTextMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    assignMock.mockReset();
    writeTextMock.mockReset();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...window.location,
        assign: assignMock,
      },
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("renders one encoded mailto action and opens it once", () => {
    const onEmailClick = vi.fn();
    const onPhoneClick = vi.fn();
    render(
      <GetTransUnionAccessModal
        open
        onClose={vi.fn()}
        onMarkInProgress={vi.fn()}
        onEnterCredentials={vi.fn()}
        onEmailClick={onEmailClick}
        onPhoneClick={onPhoneClick}
      />
    );

    expect(screen.getByText("Chhavi Kumar")).toBeInTheDocument();
    expect(screen.getByText("Account Executive, Inside Sales")).toBeInTheDocument();
    expect(screen.getByText("Chhavi.kumar@transunion.com")).toBeInTheDocument();
    expect(screen.getByText("289-208-7386")).toBeInTheDocument();
    expect(screen.getByText("Customer Support: 1-800-565-2280")).toBeInTheDocument();
    expect(screen.getByText("Tech Support: (877) 559-5585 Option 4")).toBeInTheDocument();
    expect(screen.getByText("clientsupport@transunion.com")).toBeInTheDocument();

    const emailLink = screen.getByRole("link", { name: "Email Chhavi Kumar" });
    expect(emailLink).toHaveAttribute("href", expect.stringContaining("mailto:Chhavi.kumar@transunion.com"));
    expect(emailLink).toHaveAttribute(
      "href",
      expect.stringContaining(
        "subject=TransUnion%20Credentialing%20Request%20for%20RentChain%20Screening"
      )
    );
    expect(emailLink).toHaveAttribute(
      "href",
      expect.stringContaining(
        "I%20would%20like%20to%20start%20the%20credentialing%20process%20for%20TransUnion%20tenant%20screening"
      )
    );
    fireEvent.click(emailLink);
    expect(onEmailClick).toHaveBeenCalledTimes(1);
    expect(assignMock).toHaveBeenCalledTimes(1);
    expect(assignMock).toHaveBeenCalledWith(expect.stringContaining("mailto:Chhavi.kumar@transunion.com"));
    expect(screen.getByRole("status")).toHaveTextContent("Email opened — send from your mail app");

    const callLink = screen.getByRole("link", { name: "Call Chhavi Kumar" });
    expect(callLink).toHaveAttribute("href", "tel:2892087386");
    fireEvent.click(callLink);
    expect(onPhoneClick).toHaveBeenCalledTimes(1);
  });

  it("debounces rapid email clicks so tracking and opening happen once", () => {
    const onEmailClick = vi.fn();

    render(
      <GetTransUnionAccessModal
        open
        onClose={vi.fn()}
        onMarkInProgress={vi.fn()}
        onEnterCredentials={vi.fn()}
        onEmailClick={onEmailClick}
      />
    );

    const emailLink = screen.getByRole("link", { name: "Email Chhavi Kumar" });
    fireEvent.click(emailLink);
    fireEvent.click(emailLink);

    expect(onEmailClick).toHaveBeenCalledTimes(1);
    expect(assignMock).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    const resetLink = screen.getByRole("link", { name: "Email Chhavi Kumar" });
    fireEvent.click(resetLink);
    expect(onEmailClick).toHaveBeenCalledTimes(2);
    expect(assignMock).toHaveBeenCalledTimes(2);
  });

  it("copies the email template as a fallback", async () => {
    writeTextMock.mockResolvedValue(undefined);

    render(
      <GetTransUnionAccessModal
        open
        onClose={vi.fn()}
        onMarkInProgress={vi.fn()}
        onEnterCredentials={vi.fn()}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy email template" }));
    });
    
    expect(writeTextMock).toHaveBeenCalledTimes(1);
    expect(String(writeTextMock.mock.calls[0][0])).toContain("To: Chhavi.kumar@transunion.com");
    expect(String(writeTextMock.mock.calls[0][0])).toContain(
      "Subject: TransUnion Credentialing Request for RentChain Screening"
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Email template copied — paste it into your mail app"
    );
  });

  it("keeps the already credentialed path in the existing connect flow", () => {
    const onEnterCredentials = vi.fn();
    const onAlreadyCredentialedClick = vi.fn();
    render(
      <GetTransUnionAccessModal
        open
        onClose={vi.fn()}
        onMarkInProgress={vi.fn()}
        onEnterCredentials={onEnterCredentials}
        onAlreadyCredentialedClick={onAlreadyCredentialedClick}
      />
    );

    const buttons = screen.getAllByRole("button", { name: "Already Credentialed?" });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onAlreadyCredentialedClick).toHaveBeenCalledTimes(1);
    expect(onEnterCredentials).toHaveBeenCalledTimes(1);
  });
});
