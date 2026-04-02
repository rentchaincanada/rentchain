import React from "react";

type Props = {
  enabled: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
};

export function FeatureGate({ enabled, fallback = null, children }: Props) {
  if (!enabled) return <>{fallback}</>;
  return <>{children}</>;
}

export default FeatureGate;
