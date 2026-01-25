import type { ComponentType } from "react";
import { LayoutDashboard, Building2, Users, ScrollText, MessagesSquare } from "lucide-react";

export type NavItem = {
  id: string;
  label: string;
  to: string;
  icon?: ComponentType<{ size?: number; strokeWidth?: number }>;
  showInDesktopDrawer?: boolean;
  showInMobileDrawer?: boolean;
  showInBottomTabs?: boolean;
  requiresAdmin?: boolean;
  requiresFeature?: string;
};

export const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    to: "/dashboard",
    icon: LayoutDashboard,
    showInDesktopDrawer: true,
    showInMobileDrawer: true,
    showInBottomTabs: true,
  },
  {
    id: "properties",
    label: "Properties",
    to: "/properties",
    icon: Building2,
    showInDesktopDrawer: true,
    showInMobileDrawer: true,
    showInBottomTabs: true,
  },
  {
    id: "tenants",
    label: "Tenants",
    to: "/tenants",
    icon: Users,
    showInDesktopDrawer: true,
    showInMobileDrawer: true,
    showInBottomTabs: true,
  },
  {
    id: "applications",
    label: "Applications",
    to: "/applications",
    icon: ScrollText,
    showInDesktopDrawer: true,
    showInMobileDrawer: true,
    showInBottomTabs: true,
  },
  {
    id: "messages",
    label: "Messages",
    to: "/messages",
    icon: MessagesSquare,
    showInDesktopDrawer: true,
    showInMobileDrawer: true,
    showInBottomTabs: true,
  },
  {
    id: "payments",
    label: "Payments",
    to: "/payments",
    showInDesktopDrawer: true,
    showInMobileDrawer: true,
  },
  {
    id: "billing",
    label: "Billing",
    to: "/billing",
    showInDesktopDrawer: true,
    showInMobileDrawer: true,
  },
  {
    id: "maintenance",
    label: "Maintenance",
    to: "/maintenance",
    showInDesktopDrawer: true,
    showInMobileDrawer: true,
  },
  {
    id: "screening",
    label: "Screening",
    to: "/screening",
    showInDesktopDrawer: true,
    showInMobileDrawer: true,
  },
  {
    id: "pricing",
    label: "Pricing",
    to: "/site/pricing",
    showInDesktopDrawer: true,
    showInMobileDrawer: true,
  },
  {
    id: "admin",
    label: "Admin Dashboard",
    to: "/admin",
    requiresAdmin: true,
    showInDesktopDrawer: true,
    showInMobileDrawer: true,
  },
  {
    id: "verified-screenings",
    label: "Verified Screenings",
    to: "/admin/verified-screenings",
    requiresAdmin: true,
    showInDesktopDrawer: true,
    showInMobileDrawer: true,
  },
];
