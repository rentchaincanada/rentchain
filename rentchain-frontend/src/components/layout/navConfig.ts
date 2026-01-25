import type { ComponentType } from "react";
import { LayoutDashboard, Building2, Users, ScrollText, MessagesSquare } from "lucide-react";

export type NavItem = {
  id: string;
  label: string;
  to: string;
  icon?: ComponentType<{ size?: number; strokeWidth?: number }>;
  showInDrawer?: boolean;
  showInTabs?: boolean;
  requiresAdmin?: boolean;
  requiresFeature?: string;
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
    showInTabs: true,
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
    id: "messages",
    label: "Messages",
    to: "/messages",
    icon: MessagesSquare,
    showInDrawer: true,
    showInTabs: true,
  },
  {
    id: "payments",
    label: "Payments",
    to: "/payments",
    showInDrawer: true,
  },
  {
    id: "billing",
    label: "Billing",
    to: "/billing",
    showInDrawer: true,
  },
  {
    id: "maintenance",
    label: "Maintenance",
    to: "/maintenance",
    showInDrawer: true,
  },
  {
    id: "screening",
    label: "Screening",
    to: "/screening",
    showInDrawer: true,
  },
  {
    id: "pricing",
    label: "Pricing",
    to: "/site/pricing",
    showInDrawer: true,
  },
  {
    id: "admin",
    label: "Admin Dashboard",
    to: "/admin",
    requiresAdmin: true,
    showInDrawer: true,
  },
  {
    id: "verified-screenings",
    label: "Verified Screenings",
    to: "/admin/verified-screenings",
    requiresAdmin: true,
    showInDrawer: true,
  },
];
