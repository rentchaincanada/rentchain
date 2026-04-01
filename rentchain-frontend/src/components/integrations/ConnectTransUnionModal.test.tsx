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
    expect(screen.getByText("Need TransUnion access?")).toBeInTheDocument();
    expect(screen.getByText("Already credentialed?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Get TransUnion Access" })).toBeInTheDocument();
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
