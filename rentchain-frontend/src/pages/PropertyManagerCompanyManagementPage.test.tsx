import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PropertyManagerCompanyManagementPage from "./PropertyManagerCompanyManagementPage";
import type {
  PropertyManagerCompanyMember,
  PropertyManagerCompanyRelationship,
  PropertyManagerCompanyStaffAssignment,
} from "../api/propertyManagerCompanyManagementApi";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  logout: vi.fn(),
  showToast: vi.fn(),
  searchCompanies: vi.fn(),
  fetchLandlordRelationships: vi.fn(),
  createLandlordRelationship: vi.fn(),
  suspendLandlordRelationship: vi.fn(),
  reactivateLandlordRelationship: vi.fn(),
  terminateLandlordRelationship: vi.fn(),
  fetchLandlordAssignments: vi.fn(),
  fetchMyCompanies: vi.fn(),
  fetchCompanyRelationships: vi.fn(),
  acceptRelationship: vi.fn(),
  fetchMembers: vi.fn(),
  fetchCompanyAssignments: vi.fn(),
  createAssignment: vi.fn(),
  suspendAssignment: vi.fn(),
  reactivateAssignment: vi.fn(),
  removeAssignment: vi.fn(),
}));

vi.mock("../context/useAuth", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("../components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock("../api/propertyManagerCompanyManagementApi", async () => {
  const actual = await vi.importActual<object>("../api/propertyManagerCompanyManagementApi");
  return {
    ...actual,
    searchPropertyManagerCompanies: mocks.searchCompanies,
    fetchLandlordPropertyManagerRelationships: mocks.fetchLandlordRelationships,
    createLandlordPropertyManagerRelationship: mocks.createLandlordRelationship,
    suspendLandlordPropertyManagerRelationship: mocks.suspendLandlordRelationship,
    reactivateLandlordPropertyManagerRelationship: mocks.reactivateLandlordRelationship,
    terminateLandlordPropertyManagerRelationship: mocks.terminateLandlordRelationship,
    fetchLandlordPropertyManagerRelationshipAssignments: mocks.fetchLandlordAssignments,
    fetchMyPropertyManagerCompanies: mocks.fetchMyCompanies,
    fetchCompanyPropertyManagerRelationships: mocks.fetchCompanyRelationships,
    acceptCompanyPropertyManagerRelationship: mocks.acceptRelationship,
    fetchPropertyManagerCompanyMembers: mocks.fetchMembers,
    fetchPropertyManagerCompanyStaffAssignments: mocks.fetchCompanyAssignments,
    createPropertyManagerCompanyStaffAssignment: mocks.createAssignment,
    suspendPropertyManagerCompanyStaffAssignment: mocks.suspendAssignment,
    reactivatePropertyManagerCompanyStaffAssignment: mocks.reactivateAssignment,
    removePropertyManagerCompanyStaffAssignment: mocks.removeAssignment,
  };
});

function relationship(overrides: Partial<PropertyManagerCompanyRelationship> = {}): PropertyManagerCompanyRelationship {
  return {
    relationshipId: "relationship-internal-1",
    landlordId: "landlord-internal-1",
    propertyManagerCompanyId: "pm-company-internal-1",
    propertyManagerCompanyLabel: "Elite Property Management",
    landlordWorkspaceLabel: "Admin Portfolio",
    status: "active",
    relationshipScope: {
      propertyScope: { mode: "all_current_properties", propertyIds: [] },
      workspaceScopes: ["dashboard", "operations"],
    },
    createdAt: "2026-06-20T12:00:00.000Z",
    updatedAt: "2026-06-21T12:00:00.000Z",
    startedAt: "2026-06-21T12:00:00.000Z",
    suspendedAt: null,
    reactivatedAt: null,
    terminatedAt: null,
    staffAssignmentSummary: { total: 1, active: 1, suspended: 0, removed: 0 },
    ...overrides,
  };
}

function member(overrides: Partial<PropertyManagerCompanyMember> = {}): PropertyManagerCompanyMember {
  return {
    staffUserId: "staff-internal-1",
    staffLabel: "manager@example.com",
    role: "property_manager",
    status: "active",
    createdAt: "2026-06-20T12:00:00.000Z",
    updatedAt: "2026-06-20T12:00:00.000Z",
    suspendedAt: null,
    removedAt: null,
    ...overrides,
  };
}

function assignment(overrides: Partial<PropertyManagerCompanyStaffAssignment> = {}): PropertyManagerCompanyStaffAssignment {
  return {
    assignmentId: "assignment-internal-1",
    propertyManagerCompanyId: "pm-company-internal-1",
    relationshipId: "relationship-internal-1",
    staffUserId: "staff-internal-1",
    staffLabel: "manager@example.com",
    staffDisplayLabel: "manager@example.com",
    staffRole: "property_manager",
    status: "active",
    propertyScope: { mode: "all_current_properties", propertyIds: [] },
    workspaceScopes: ["dashboard"],
    createdAt: "2026-06-20T12:00:00.000Z",
    updatedAt: "2026-06-20T12:00:00.000Z",
    suspendedAt: null,
    reactivatedAt: null,
    removedAt: null,
    ...overrides,
  };
}

describe("PropertyManagerCompanyManagementPage", () => {
  beforeEach(() => {
    mocks.useAuth.mockReturnValue({
      user: { id: "owner-user-1", role: "landlord", actorRole: "landlord", email: "owner@example.com" },
      logout: mocks.logout,
    });
    mocks.searchCompanies.mockResolvedValue([
      { propertyManagerCompanyId: "pm-company-internal-1", companyLabel: "Elite Property Management", status: "active" },
    ]);
    mocks.fetchLandlordRelationships.mockResolvedValue([
      relationship(),
      relationship({ relationshipId: "relationship-pending", status: "pending", propertyManagerCompanyLabel: "North PM" }),
      relationship({ relationshipId: "relationship-suspended", status: "suspended", propertyManagerCompanyLabel: "West PM" }),
      relationship({ relationshipId: "relationship-terminated", status: "terminated", propertyManagerCompanyLabel: "Former PM" }),
    ]);
    mocks.createLandlordRelationship.mockResolvedValue({ ok: true, relationship: relationship({ status: "pending" }) });
    mocks.suspendLandlordRelationship.mockResolvedValue({ ok: true, relationship: relationship({ status: "suspended" }) });
    mocks.reactivateLandlordRelationship.mockResolvedValue({ ok: true, relationship: relationship({ status: "active" }) });
    mocks.terminateLandlordRelationship.mockResolvedValue({ ok: true, relationship: relationship({ status: "terminated" }) });
    mocks.fetchLandlordAssignments.mockResolvedValue([assignment()]);
    mocks.fetchMyCompanies.mockResolvedValue([
      { propertyManagerCompanyId: "pm-company-internal-1", companyLabel: "Elite Property Management", status: "active", role: "company_admin" },
    ]);
    mocks.fetchCompanyRelationships.mockResolvedValue([
      relationship({
        relationshipScope: {
          propertyScope: { mode: "all_current_properties", propertyIds: [] },
          workspaceScopes: ["dashboard", "operations", "settings_billing"],
        },
      }),
      relationship({ relationshipId: "relationship-pending", status: "pending", landlordWorkspaceLabel: "Pending Portfolio" }),
    ]);
    mocks.acceptRelationship.mockResolvedValue({ ok: true, relationship: relationship({ status: "active" }) });
    mocks.fetchMembers.mockResolvedValue([
      member(),
      member({ staffUserId: "staff-removed", staffLabel: "removed@example.com", status: "removed" }),
    ]);
    mocks.fetchCompanyAssignments.mockResolvedValue([assignment()]);
    mocks.createAssignment.mockResolvedValue({ ok: true, assignment: assignment() });
    mocks.suspendAssignment.mockResolvedValue({ ok: true, assignment: assignment({ status: "suspended" }) });
    mocks.reactivateAssignment.mockResolvedValue({ ok: true, assignment: assignment({ status: "active" }) });
    mocks.removeAssignment.mockResolvedValue({ ok: true, assignment: assignment({ status: "removed" }) });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("approves the revised brief by rendering landlord relationship management from safe projections", async () => {
    const { container } = render(<PropertyManagerCompanyManagementPage />);

    expect(await screen.findByRole("heading", { name: "PM Company Management" })).toBeInTheDocument();
    expect(screen.getByText("Elite Property Management")).toBeInTheDocument();
    expect(screen.getByText("North PM")).toBeInTheDocument();
    expect(screen.getByText("West PM")).toBeInTheDocument();
    expect(screen.getByText("Former PM")).toBeInTheDocument();
    expect(screen.getAllByText("All current properties · Dashboard, Operations").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Suspended").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Terminated").length).toBeGreaterThan(0);
    expect(container).not.toHaveTextContent("relationship-internal");
    expect(container).not.toHaveTextContent("pm-company-internal");
    expect(container).not.toHaveTextContent("landlord-internal");
  });

  it("creates pending landlord relationships using discovery labels and all-current-property scope", async () => {
    render(<PropertyManagerCompanyManagementPage />);

    await screen.findByText("Elite Property Management");
    fireEvent.change(screen.getByLabelText("PM company search"), { target: { value: "elite" } });
    fireEvent.click(screen.getByRole("button", { name: "Search companies" }));
    await waitFor(() => expect(mocks.searchCompanies).toHaveBeenCalledWith("elite"));
    expect(screen.getByText("Search results")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Elite Property Management" }));
    expect(screen.getByText("Selected PM Company")).toBeInTheDocument();
    expect(screen.getByText("Ready to create pending relationship")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create pending relationship" }));

    await waitFor(() => expect(mocks.createLandlordRelationship).toHaveBeenCalledTimes(1));
    expect(mocks.createLandlordRelationship).toHaveBeenCalledWith({
      propertyManagerCompanyId: "pm-company-internal-1",
      propertyScope: { mode: "all_current_properties", propertyIds: [] },
      workspaceScopes: ["dashboard", "operations"],
    });
  });

  it("shows a clear no-results state when no active PM companies match search", async () => {
    mocks.searchCompanies.mockResolvedValueOnce([]);

    render(<PropertyManagerCompanyManagementPage />);

    await screen.findByText("Elite Property Management");
    fireEvent.change(screen.getByLabelText("PM company search"), { target: { value: "missing company" } });
    fireEvent.click(screen.getByRole("button", { name: "Search companies" }));

    expect(await screen.findByText("No PM companies found")).toBeInTheDocument();
    expect(screen.getByText("Try another company name or verify the company has been created and activated.")).toBeInTheDocument();
    expect(screen.queryByText("Ready to create pending relationship")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create pending relationship" })).toBeDisabled();
  });

  it("requires confirmation before terminating a landlord relationship", async () => {
    render(<PropertyManagerCompanyManagementPage />);

    await screen.findByText("Elite Property Management");
    fireEvent.click(screen.getAllByRole("button", { name: "Terminate" })[0]);
    expect(mocks.terminateLandlordRelationship).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Terminate relationship" });
    expect(dialog).toHaveTextContent("Access will remain blocked and history will be preserved");
    fireEvent.click(within(dialog).getByRole("button", { name: "Terminate" }));

    await waitFor(() => expect(mocks.terminateLandlordRelationship).toHaveBeenCalledWith("relationship-internal-1"));
  });

  it("lets Company Owner/Admin accept pending relationships and create scoped assignments with templates only", async () => {
    const { container } = render(<PropertyManagerCompanyManagementPage />);

    fireEvent.click(await screen.findByRole("tab", { name: "PM company admin" }));
    expect(await screen.findByText("Pending Portfolio")).toBeInTheDocument();
    expect(screen.getAllByText("manager@example.com").length).toBeGreaterThan(0);
    expect(screen.queryByText("Company Admin", { selector: "option" })).not.toBeInTheDocument();
    expect(screen.queryByText("Owner-only settings")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Accept relationship" }));
    const acceptDialog = screen.getByRole("dialog", { name: "Accept relationship" });
    fireEvent.click(within(acceptDialog).getByRole("button", { name: "Accept relationship" }));
    await waitFor(() =>
      expect(mocks.acceptRelationship).toHaveBeenCalledWith("pm-company-internal-1", "relationship-pending")
    );

    fireEvent.click(screen.getByRole("button", { name: /Create assignment/i }));
    await waitFor(() => expect(mocks.createAssignment).toHaveBeenCalledTimes(1));
    expect(mocks.createAssignment).toHaveBeenCalledWith("pm-company-internal-1", {
      relationshipId: "relationship-internal-1",
      staffUserId: "staff-internal-1",
      staffRole: "property_manager",
      propertyScope: { mode: "all_current_properties", propertyIds: [] },
      workspaceScopes: ["dashboard", "operations"],
    });
    expect(container).not.toHaveTextContent("settings_billing");
    expect(container).not.toHaveTextContent("assignment-internal");
  });

  it("requires confirmation before removing a staff assignment", async () => {
    render(<PropertyManagerCompanyManagementPage />);

    fireEvent.click(await screen.findByRole("tab", { name: "PM company admin" }));
    await waitFor(() => expect(screen.getAllByText("manager@example.com").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(mocks.removeAssignment).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Remove assignment" });
    expect(dialog).toHaveTextContent("History will be preserved");
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(mocks.removeAssignment).toHaveBeenCalledWith("pm-company-internal-1", "assignment-internal-1"));
  });

  it("shows account context and sign out on the standalone company-admin surface", async () => {
    render(<PropertyManagerCompanyManagementPage />);

    expect(await screen.findByText("Signed in as owner@example.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(mocks.logout).toHaveBeenCalledTimes(1);
  });

  it("shows landlord and company empty states without implying deletion", async () => {
    mocks.fetchLandlordRelationships.mockResolvedValueOnce([]);
    mocks.fetchCompanyRelationships.mockResolvedValue([]);
    mocks.fetchCompanyAssignments.mockResolvedValue([]);

    render(<PropertyManagerCompanyManagementPage />);

    expect(await screen.findByText("No PM company relationships yet")).toBeInTheDocument();
    expect(screen.getByText("Search for a PM company to begin a relationship.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "PM company admin" }));

    expect(await screen.findByText("No company relationships")).toBeInTheDocument();
    expect(screen.getByText("No staff assignments")).toBeInTheDocument();
    expect(screen.getByText(/Assignment history will remain visible/i)).toBeInTheDocument();
  });

  it("does not show admin controls for non-admin company staff without active company admin context", async () => {
    mocks.useAuth.mockReturnValue({
      user: { id: "staff-user-1", role: "property_manager", email: "staff@example.com" },
      logout: mocks.logout,
    });
    mocks.fetchLandlordRelationships.mockResolvedValueOnce([]);
    mocks.fetchMyCompanies.mockResolvedValueOnce([]);

    render(<PropertyManagerCompanyManagementPage />);

    expect(await screen.findByText("No PM company admin context")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Landlord owner" })).not.toBeInTheDocument();
    expect(screen.queryByText("Create staff assignment")).not.toBeInTheDocument();
    expect(screen.queryByText("Create pending relationship")).not.toBeInTheDocument();
  });
});
