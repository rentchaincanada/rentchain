import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import LoginForm from "./LoginForm";

afterEach(() => {
  cleanup();
});

function renderForm(overrides: Partial<React.ComponentProps<typeof LoginForm>> = {}) {
  const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());
  const onEmailChange = vi.fn();
  const onPasswordChange = vi.fn();

  render(
    <MemoryRouter>
      <LoginForm
        title="Sign in to RentChain"
        subtitle="Continue to your workspace."
        roleLabel="Landlord access"
        email=""
        onEmailChange={onEmailChange}
        password=""
        onPasswordChange={onPasswordChange}
        onSubmit={onSubmit}
        {...overrides}
      />
    </MemoryRouter>
  );

  return { onSubmit, onEmailChange, onPasswordChange };
}

describe("LoginForm", () => {
  it("renders shared password login fields and role context", () => {
    renderForm();

    expect(screen.getByRole("heading", { name: "Sign in to RentChain" })).toBeInTheDocument();
    expect(screen.getByText("Landlord access")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
      "href",
      "/forgot-password"
    );
  });

  it("delegates form submission and field changes", () => {
    const { onSubmit, onEmailChange, onPasswordChange } = renderForm({
      email: "initial@example.com",
      password: "initial-password",
    });

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "landlord@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(onEmailChange).toHaveBeenCalledWith("landlord@example.com");
    expect(onPasswordChange).toHaveBeenCalledWith("secret-password");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("supports email-only login without forgot password", () => {
    renderForm({
      title: "Tenant login",
      roleLabel: "Tenant access",
      passwordRequired: false,
      showForgotPassword: false,
      submitLabel: "Email me a login link",
    });

    expect(screen.getByRole("heading", { name: "Tenant login" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Forgot password?" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Email me a login link" })).toBeEnabled();
  });

  it("renders safe status, error, and banner states", () => {
    renderForm({
      error: "Invalid email or password",
      banner: {
        title: "Session expired",
        body: "Please log in again.",
        tone: "warning",
      },
    });

    expect(screen.getByText("Session expired")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid email or password");
  });

  it("uses the warm neutral auth theme without blue primary links or controls", () => {
    renderForm();

    const email = screen.getByLabelText("Email");
    const submit = screen.getByRole("button", { name: "Sign in" });
    const forgot = screen.getByRole("link", { name: "Forgot password?" });

    expect(email).toHaveStyle({
      background: "#fffdf8",
    });
    expect(email).toHaveStyle("border-color: rgba(105, 82, 49, 0.22)");
    fireEvent.focus(email);
    expect(email).toHaveStyle({
      borderColor: "rgba(63, 54, 37, 0.72)",
      boxShadow: "0 0 0 3px rgba(105, 82, 49, 0.22)",
    });
    expect(submit).toHaveStyle({
      background: "#171411",
      color: "#fffaf1",
    });
    expect(forgot).toHaveStyle({
      color: "#171411",
    });
    expect(screen.getByText("Landlord access")).toHaveStyle({
      background: "#dfe4d5",
    });
  });

  it("can disable submit separately from loading state", () => {
    renderForm({ disabled: true, submitLabel: "Email me a login link" });

    expect(screen.getByRole("button", { name: "Email me a login link" })).toBeDisabled();
  });
});
