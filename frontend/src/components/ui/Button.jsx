// Button: Accessible glass and flat button component with primary, glass, ghost, and danger variants.
import React, { forwardRef } from "react";
import "./ui.css";

const Button = forwardRef(function Button(
  {
    children,
    variant = "glass", // "primary" | "glass" | "ghost" | "danger"
    size = "md", // "sm" | "md" | "lg"
    className = "",
    disabled = false,
    loading = false,
    icon: Icon,
    iconRight: IconRight,
    type = "button",
    onClick,
    ...props
  },
  ref
) {
  const isActionDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isActionDisabled}
      onClick={isActionDisabled ? undefined : onClick}
      className={`ui-btn ui-btn--${variant} ui-btn--${size} ${loading ? "ui-btn--loading" : ""} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="ui-btn-spinner" aria-hidden="true" />
      ) : Icon ? (
        <Icon className="ui-btn-icon" size={size === "sm" ? 14 : size === "lg" ? 20 : 16} strokeWidth={1.5} />
      ) : null}

      {children && <span className="ui-btn-label">{children}</span>}

      {!loading && IconRight && (
        <IconRight className="ui-btn-icon-right" size={size === "sm" ? 14 : size === "lg" ? 20 : 16} strokeWidth={1.5} />
      )}
    </button>
  );
});

export default Button;
export { Button };
