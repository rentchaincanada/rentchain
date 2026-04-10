import React from "react";
import { TenantNav } from "../../components/layout/TenantNav";

type TenantLayoutProps = {
  children: React.ReactNode;
};

export default function TenantLayout({ children }: TenantLayoutProps) {
  return <TenantNav>{children}</TenantNav>;
}
