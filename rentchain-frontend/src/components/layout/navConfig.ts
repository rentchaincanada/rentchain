import type { ComponentType } from "react";
import { LayoutDashboard, Building2, Users, ScrollText, MessagesSquare, User, ReceiptText, BarChart3, Inbox, ClipboardList, FileText } from "lucide-react";
import { SCREENING_ENABLED } from "../../config/screening";

export type NavItem = {
  id: string;
  label: string;
  to: string;
  icon?: ComponentType<{ size?: number; strokeWidth?: number }>;
  showInDrawer?: boolean;
  showInTabs?: boolean;
  requiresAdmin?: boolean;
  requiresLandlordOrAdmin?: boolean;
  requiresFeature?: string;
  requiresRoles?: string[];
};

export const getVisibleNavItems = (role?: string | null, features?: Record<string, boolean>) => {
  const normalizedRole = String(role || "").trim().toLowerCase();
  const isAdmin = normalizedRole === "admin";
  const isLandlord = normalizedRole === "landlord";
  return NAV_ITEMS.filter((item) => {
    if (!SCREENING_ENABLED && item.id === "screening") return false;
    if (item.requiresAdmin && !isAdmin) return false;
    if (item.requiresLandlordOrAdmin && !(isLandlord || isAdmin)) return false;
    if (item.requiresRoles?.length && !item.requiresRoles.includes(normalizedRole)) return false;
    if (!isAdmin && item.requiresFeature && features && features[item.requiresFeature] === false) return false;
    return true;
  });
};

export const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    to: "/dashboard",
    icon: LayoutDashboard,
    showInDrawer: true,
    showInTabs: true,
  },
  {
    id: "operations",
    label: "Operations",
    to: "/operations",
    icon: ClipboardList,
    showInDrawer: false,
    requiresLandlordOrAdmin: true,
  },
  {
    id: "properties",
    label: "Properties",
    to: "/properties",
    icon: Building2,
    showInDrawer: true,
    showInTabs: true,
  },
  {
    id: "tenants",
    label: "Tenants",
    to: "/tenants",
    icon: Users,
    showInDrawer: true,
  },
  {
    id: "applications",
    label: "Applications",
    to: "/applications",
    icon: ScrollText,
    showInDrawer: true,
    showInTabs: true,
  },
  {
    id: "documents",
    label: "Documents",
    to: "/applications",
    icon: FileText,
    showInDrawer: false,
    showInTabs: false,
    requiresLandlordOrAdmin: true,
  },
  {
    id: "leases",
    label: "Leases",
    to: "/leases",
    icon: ScrollText,
    showInDrawer: true,
    showInTabs: false,
    requiresLandlordOrAdmin: true,
  },
  {
    id: "unified-inbox",
    label: "Inbox",
    to: "/landlord/unified-inbox",
    icon: Inbox,
    showInDrawer: true,
    showInTabs: true,
    requiresLandlordOrAdmin: true,
  },
  {
    id: "decision-inbox",
    label: "Decisions",
    to: "/decision-inbox",
    icon: Inbox,
    showInDrawer: false,
    requiresLandlordOrAdmin: true,
  },
  {
    id: "analytics",
    label: "Analytics",
    to: "/analytics",
    icon: BarChart3,
    showInDrawer: true,
    requiresLandlordOrAdmin: true,
    requiresFeature: "portfolio_health_summary",
  },
  {
    id: "messages",
    label: "Messages",
    to: "/messages",
    icon: MessagesSquare,
    showInDrawer: false,
    showInTabs: false,
    requiresFeature: "messaging",
  },
  {
    id: "payments",
    label: "Payments",
    to: "/payments",
    showInDrawer: true,
  },
  {
    id: "expenses",
    label: "Expenses",
    to: "/expenses",
    icon: ReceiptText,
    showInDrawer: true,
  },
  {
    id: "work-orders",
    label: "Work Orders",
    to: "/work-orders",
    showInDrawer: true,
    requiresLandlordOrAdmin: true,
  },
  {
    id: "contractors",
    label: "Contractors",
    to: "/contractors",
    showInDrawer: true,
    requiresLandlordOrAdmin: true,
  },
  {
    id: "contractor-portal",
    label: "Contractor Portal",
    to: "/contractor",
    showInDrawer: true,
    requiresRoles: ["contractor", "admin"],
  },
  {
    id: "account",
    label: "My Account",
    to: "/account",
    icon: User,
    showInDrawer: true,
    showInTabs: false,
    requiresLandlordOrAdmin: true,
  },
  {
    id: "onboarding-hardening",
    label: "Onboarding",
    to: "/onboarding-hardening",
    showInDrawer: true,
    requiresLandlordOrAdmin: true,
  },
  {
    id: "referrals",
    label: "Referrals",
    to: "/referrals",
    showInDrawer: true,
    requiresLandlordOrAdmin: true,
  },
  {
    id: "maintenance",
    label: "Maintenance",
    to: "/maintenance",
    showInDrawer: true,
    requiresFeature: "maintenance",
  },
  {
    id: "screening",
    label: "Screening",
    to: "/screening",
    showInDrawer: true,
  },
  {
    id: "admin",
    label: "Admin",
    to: "/admin",
    requiresAdmin: true,
    showInDrawer: true,
  },
  {
    id: "support-operations",
    label: "Support Ops",
    to: "/support-operations",
    requiresAdmin: true,
    showInDrawer: true,
  },
  {
    id: "governed-review-workspaces",
    label: "Governed review workspaces",
    to: "/admin/review-workspaces",
    requiresAdmin: true,
    showInDrawer: true,
  },
  {
    id: "pdf-export-observability",
    label: "PDF Observability",
    to: "/admin/pdf-export-observability",
    requiresAdmin: true,
    showInDrawer: true,
  },
  {
    id: "production-integrations",
    label: "Production Integrations",
    to: "/admin/production-integrations",
    requiresAdmin: true,
    showInDrawer: true,
  },
  {
    id: "enterprise-municipal-readiness",
    label: "Enterprise Readiness",
    to: "/admin/enterprise-municipal-readiness",
    requiresAdmin: true,
    showInDrawer: true,
  },
  {
    id: "admin-leads",
    label: "Referral Requests",
    to: "/admin/leads",
    requiresAdmin: true,
    showInDrawer: true,
  },
  {
    id: "admin-properties",
    label: "Admin Properties",
    to: "/admin/properties",
    requiresAdmin: true,
    showInDrawer: true,
  },
  {
    id: "admin-registry",
    label: "Registry Sources",
    to: "/admin/registry/sources",
    requiresAdmin: true,
    showInDrawer: true,
  },
  {
    id: "admin-tenants",
    label: "Admin Tenants",
    to: "/admin/tenants",
    requiresAdmin: true,
    showInDrawer: true,
  },
  {
    id: "admin-leases",
    label: "Admin Leases",
    to: "/admin/leases",
    requiresAdmin: true,
    showInDrawer: true,
  },
  {
    id: "verified-screenings",
    label: "Verified Screenings",
    to: "/verified-screenings",
    showInDrawer: true,
  },
];
