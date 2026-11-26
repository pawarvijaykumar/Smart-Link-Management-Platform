// Button: Accessible button component with primary, secondary, and ghost variants.
import React, { forwardRef } from "react";
import "./ui.css";

const Button = forwardRef(function Button(
  {
    children,
    variant = "secondary", // "primary" | "secondary" | "ghost" | "danger" (default: "secondary")
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

  const variantClass =
    variant === "primary"
      ? "btn-primary"
      : variant === "ghost"
      ? "btn-ghost"
      : variant === "danger"
      ? "btn-danger"
      : "btn-secondary";

  const sizeClass = size === "sm" ? "btn--sm" : size === "lg" ? "btn--lg" : "";
  const iconOnlyClass = !children && (Icon || loading) ? "btn--icon" : "";

  return (
    <button
      ref={ref}
      type={type}
      disabled={isActionDisabled}
      onClick={isActionDisabled ? undefined : onClick}
      className={`btn ${variantClass} ${sizeClass} ${iconOnlyClass} ${loading ? "btn--loading" : ""} ${className}`.trim()}
      {...props}
    >
      {loading ? (
        <span className="ui-btn-spinner" aria-hidden="true" />
      ) : Icon ? (
        <Icon className="ui-btn-icon" size={size === "sm" ? 14 : size === "lg" ? 18 : 16} strokeWidth={1.5} />
      ) : null}

      {children && <span className="ui-btn-label">{children}</span>}

      {!loading && IconRight && (
        <IconRight className="ui-btn-icon-right" size={size === "sm" ? 14 : size === "lg" ? 18 : 16} strokeWidth={1.5} />
      )}
    </button>
  );
});

export default Button;
export { Button };
