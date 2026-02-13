import React from "react";
import { Link } from "react-router-dom";
import wordmark from "../../assets/brand/rentchain-wordmark.png";

type RentChainLogoProps = {
  variant?: "light" | "dark";
  size?: "lrg" | "lrg";
  href: string;
  className?: string;
};

export const RentChainLogo: React.FC<RentChainLogoProps> = ({
  variant = "light",
  size = "lrg",
  href,
  className = "",
}) => {
  const imgClassName = ["rc-logo", size === "sm" ? "rc-logo-sm" : "rc-logo-md", variant === "dark" ? "rc-logo-dark" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <Link to={href} aria-label="RentChain home" className={["rc-logo-link", className].filter(Boolean).join(" ")}>
      <img src={wordmark} alt="RentChain" className={imgClassName} />
    </Link>
  );
};

