import React from "react";
import { Link } from "react-router-dom";
import { Logo } from "./Logo";

type RentChainLogoProps = {
  variant?: "mark" | "wordmark" | "lockup";
  tone?: "default" | "inverse";
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  href?: string;
  className?: string;
};

export const RentChainLogo: React.FC<RentChainLogoProps> = ({
  variant = "lockup",
  tone = "default",
  size = "md",
  showText,
  href,
  className = "",
}) => {
  const displaysText = showText ?? variant !== "mark";
  const linkClassName = [
    "rc-logo-link",
    `rc-logo-link-${size}`,
    tone === "inverse" ? "rc-logo-link-inverse" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {variant !== "wordmark" ? <Logo decorative priority /> : null}
      {displaysText ? <span className="rc-logo-wordmark">RentChain</span> : null}
    </>
  );

  return href ? (
    <Link to={href} aria-label="RentChain home" className={linkClassName}>{content}</Link>
  ) : (
    <span className={linkClassName} aria-label={displaysText ? undefined : "RentChain"}>{content}</span>
  );
};
