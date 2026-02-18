import React from "react";

type LogoProps = {
  className?: string;
  priority?: boolean;
};

export const Logo: React.FC<LogoProps> = ({ className = "h-8 w-auto", priority = false }) => {
  const combinedClassName = className.trim() || "h-8 w-auto";

  return (
    <img
      src="/brand/logo-wordmark.png"
      srcSet="/brand/logo-wordmark.png 1x, /brand/logo-wordmark@2x.png 2x"
      alt="RentChain"
      className={combinedClassName}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      style={{ height: "32px", width: "auto", display: "block" }}
    />
  );
};

