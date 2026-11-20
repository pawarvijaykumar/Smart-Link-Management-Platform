// Badge: High-contrast status indicator pill with semantic variants and subtle surface tints.
import React from "react";
import "./ui.css";

function Badge({
  children,
  variant = "default", // "default" | "success" | "warning" | "danger" | "accent" | "muted"
  size = "md", // "sm" | "md"
  dot = false,
  className = "",
  ...props
}) {
  return (
    <span className={`ui-badge ui-badge--${variant} ui-badge--${size} ${className}`} {...props}>
      {dot && <span className="ui-badge-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

export default Badge;
export { Badge };
