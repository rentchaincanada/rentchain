import React from "react";
import rentchainMark from "../../assets/brand/rentchain-mark.svg";

type LogoProps = {
  className?: string;
  priority?: boolean;
  decorative?: boolean;
};

export const Logo: React.FC<LogoProps> = ({ className = "", priority = false, decorative = false }) => {
  return (
    <img
      src={rentchainMark}
      alt={decorative ? "" : "RentChain"}
      aria-hidden={decorative || undefined}
      className={["rc-logo-icon", className].filter(Boolean).join(" ")}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
    />
  );
};
