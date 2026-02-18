import React from "react";
import { Link } from "react-router-dom";
import { Logo } from "./Logo";

type RentChainLogoProps = {
  variant?: "light" | "dark";
  size?: "sm" | "md";
  href: string;
  className?: string;
};

export const RentChainLogo: React.FC<RentChainLogoProps> = ({
  variant = "light",
  size = "md",
  href,
  className = "",
}) => {
  const linkClassName = [
    "rc-logo-link",
    size === "sm" ? "rc-logo-link-sm" : "rc-logo-link-md",
    variant === "dark" ? "rc-logo-link-dark" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link to={href} aria-label="RentChain home" className={linkClassName}>
      <Logo className={size === "sm" ? "h-8 w-auto" : "h-8 w-auto"} priority />
    </Link>
  );
};
