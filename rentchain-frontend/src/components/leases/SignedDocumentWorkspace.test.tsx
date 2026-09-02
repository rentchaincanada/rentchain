import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignedDocumentWorkspace } from "./SignedDocumentWorkspace";

describe("SignedDocumentWorkspace", () => {
  afterEach(() => cleanup());

  it("renders canonical signed-document availability as a button without a pre-click URL surface", () => {
    const onOpenDocument = vi.fn();
    const { container } = render(
      <SignedDocumentWorkspace
        audience="tenant"
        title="Lease document workspace"
        statusLabel="Signed document available"
        documentLabel="Signed lease document"
        documentAvailable
        documentKind="signed"
        onOpenDocument={onOpenDocument}
      />
    );

    const workspace = screen.getByRole("region", { name: "Lease document workspace" });
    const action = within(workspace).getByRole("button", { name: "View signed document" });
    expect(container.querySelector("a[href]")).toBeNull();
    expect(container.querySelector("object[data]")).toBeNull();
    expect(container.querySelector("[data-document-url]")).toBeNull();

    fireEvent.click(action);
    expect(onOpenDocument).toHaveBeenCalledOnce();
  });

  it("keeps an available generic lease document distinct from signed-document authority", () => {
    const onOpenDocument = vi.fn();
    const { container } = render(
      <SignedDocumentWorkspace
        audience="tenant"
        title="Lease document workspace"
        statusLabel="Lease document available"
        documentLabel="Generated lease package"
        documentAvailable
        documentKind="generic"
        onOpenDocument={onOpenDocument}
      />
    );

    expect(screen.getByRole("button", { name: "View lease document" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View signed document" })).not.toBeInTheDocument();
    expect(container.querySelector("a[href], object[data]")).toBeNull();
  });

  it("does not expose an action when tenant document metadata says unavailable", () => {
    const onOpenDocument = vi.fn();
    const { container } = render(
      <SignedDocumentWorkspace
        audience="tenant"
        title="Lease document workspace"
        statusLabel="Document unavailable"
        documentAvailable={false}
        documentKind="signed"
        onOpenDocument={onOpenDocument}
      />
    );

    expect(screen.queryByRole("button", { name: /View .*document/i })).not.toBeInTheDocument();
    expect(container.querySelector("a[href], object[data]")).toBeNull();
  });
});
