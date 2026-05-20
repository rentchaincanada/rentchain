import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { DEBUG_AUTH_KEY, TENANT_TOKEN_KEY } from "../../lib/authKeys";
import { TOKEN_KEY } from "../../lib/authToken";
import { AuthDebugOverlay } from "./AuthDebugOverlay";

describe("AuthDebugOverlay", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("shows token presence without exposing token prefixes or suffixes", () => {
    window.localStorage.setItem(DEBUG_AUTH_KEY, "1");
    window.sessionStorage.setItem(TOKEN_KEY, "header.payload.signature");
    window.localStorage.setItem(TENANT_TOKEN_KEY, "tenant.header.signature");

    render(React.createElement(AuthDebugOverlay));

    expect(screen.getByText("debugAuth")).toBeInTheDocument();
    const renderedText = document.body.textContent || "";
    expect(renderedText).toContain("session: yes len=24 [redacted]");
    expect(renderedText).toContain("tenant local: yes [redacted]");
    expect(renderedText).not.toContain("header.payload");
    expect(renderedText).not.toContain("signature");
    expect(renderedText).not.toContain("tenant.header");
  });
});
