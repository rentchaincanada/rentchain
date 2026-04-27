import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConnectTransUnionModal } from "./ConnectTransUnionModal";

describe("ConnectTransUnionModal", () => {
  it("shows the guidance states for new and already credentialed landlords", () => {
    render(
      <ConnectTransUnionModal
        open
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onGetAccess={vi.fn()}
      />
    );

    expect(screen.getByText("Connect Your TransUnion Account")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Connect your TransUnion membership by entering the member code and passcode issued to your business. Screening requests are initiated under your TransUnion credentials within RentChain."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/If connection details are not available yet, use the access flow first/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Need TransUnion access?")).toBeInTheDocument();
    expect(screen.getByText("Already credentialed?")).toBeInTheDocument();
    expect(screen.getByText("Choose path")).toBeInTheDocument();
    expect(screen.getByText("Connect membership")).toBeInTheDocument();
    expect(screen.getByText("Ready to screen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Get TransUnion Access" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "I Already Have Credentials" })).toBeInTheDocument();
    expect(screen.queryByText("Member code")).not.toBeInTheDocument();
  });

  it("reveals the credential form only after the landlord chooses the credentialed path", async () => {
    const onChooseExistingCredentials = vi.fn();
    render(
      <ConnectTransUnionModal
        open
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onGetAccess={vi.fn()}
        onChooseExistingCredentials={onChooseExistingCredentials}
      />
    );

    const dialog = screen.getAllByRole("dialog").find((node) =>
      node.getAttribute("aria-label") === "Connect Your TransUnion Account"
    ) as HTMLElement;
    const dialogQueries = within(dialog);

    fireEvent.click(dialogQueries.getByRole("button", { name: "I Already Have Credentials" }));

    expect(dialogQueries.getByText("Member code")).toBeInTheDocument();
    expect(dialogQueries.getByText("Passcode")).toBeInTheDocument();
    expect(dialogQueries.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(dialogQueries.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(dialogQueries.getByRole("button", { name: "Connect Account" })).toBeInTheDocument();
    expect(dialogQueries.getByText("Business details required for setup")).toBeInTheDocument();
    expect(
      dialogQueries.getByText(/Next step: connect your membership now, then return to Applications/i),
    ).toBeInTheDocument();
  });

  it("opens the pending credentialing flow directly in the focused credential-entry step", async () => {
    render(
      <ConnectTransUnionModal
        open
        integration={{
          provider: "transunion",
          status: "pending_credentialing",
          businessName: "North Wharf Holdings",
          contactName: "Avery Stone",
          contactEmail: "ops@example.com",
          version: 1,
        }}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const dialog = screen.getAllByRole("dialog").find((node) =>
      node.getAttribute("aria-label") === "Connect Your TransUnion Account"
    ) as HTMLElement;
    const dialogQueries = within(dialog);

    await waitFor(() => {
      expect(dialogQueries.getByText("Membership credentials")).toBeInTheDocument();
    });
    expect(dialogQueries.getByText("Business details required for setup")).toBeInTheDocument();
    expect(dialogQueries.queryByRole("button", { name: "I Already Have Credentials" })).not.toBeInTheDocument();
  });

  it("shows a connected success state after credentials are submitted", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <ConnectTransUnionModal
        open
        integration={{
          provider: "transunion",
          status: "connected",
          memberCodeMasked: "*******7788",
          version: 1,
        }}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    const dialog = screen.getAllByRole("dialog").find((node) =>
      node.getAttribute("aria-label") === "Connect Your TransUnion Account"
    ) as HTMLElement;
    const dialogQueries = within(dialog);
    const credentialButton = dialogQueries.queryByRole("button", {
      name: "I Already Have Credentials",
    });
    if (credentialButton) {
      fireEvent.click(credentialButton);
    }
    const textboxes = dialogQueries.getAllByRole("textbox");
    fireEvent.change(textboxes[0], {
      target: { value: "North Wharf Holdings" },
    });
    fireEvent.change(textboxes[1], {
      target: { value: "Avery Stone" },
    });
    fireEvent.change(textboxes[2], {
      target: { value: "ops@example.com" },
    });
    fireEvent.change(textboxes[3], {
      target: { value: "MEMBER-7788" },
    });
    fireEvent.change(dialogQueries.getAllByLabelText("Passcode")[0], {
      target: { value: "PASS-1122" },
    });
    fireEvent.click(
      dialogQueries.getAllByRole("checkbox", {
        name: /issued by transunion for permissible tenant-screening use/i,
      })[0]
    );

    fireEvent.click(dialogQueries.getAllByRole("button", { name: "Connect Account" })[0]);

    expect(await screen.findByText("TransUnion Connected")).toBeInTheDocument();
    const successDialog = screen.getAllByRole("dialog").find((node) =>
      node.getAttribute("aria-label") === "TransUnion Connected"
    ) as HTMLElement;
    expect(within(successDialog).getByRole("button", { name: "Continue to Screening" })).toBeInTheDocument();
  });
});
