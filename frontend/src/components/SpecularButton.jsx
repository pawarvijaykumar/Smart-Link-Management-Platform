// =============================================================================
// Unified SaaS Button Component (SpecularButton Drop-in Replacement)
// Replaced heavy WebGL shaders and glows with lightweight SaaS button system.
// Variants: primary, secondary, ghost, danger
// =============================================================================

import React from "react";
import "./SpecularButton.css";

const SpecularButton = React.forwardRef(function SpecularButton(
  {
    children,
    className = "",
    size = "md", // "xs" | "sm" | "md" | "lg" | "icon"
    variant = "secondary", // "primary" | "secondary" | "ghost" | "danger" | "icon"
    disabled = false,
    loading = false,
    loadingText,
    type = "button",
    onClick,
    style = {},
    ...rest
  },
  ref
) {
  const effectiveDisabled = disabled || loading;

  const variantClass =
    variant === "primary"
      ? "btn-primary"
      : variant === "ghost" || variant === "icon"
      ? "btn-ghost"
      : variant === "danger"
      ? "btn-danger"
      : "btn-secondary";

  const sizeClass =
    size === "xs" || size === "sm"
      ? "btn--sm"
      : size === "lg"
      ? "btn--lg"
      : "";

  const iconClass = size === "icon" ? "btn--icon" : "";

  return (
    <button
      ref={ref}
      type={type}
      disabled={effectiveDisabled}
      onClick={effectiveDisabled ? undefined : onClick}
      className={`btn ${variantClass} ${sizeClass} ${iconClass} ${className}`.trim()}
      style={style}
      {...rest}
    >
      {loading && <span className="ui-btn-spinner" aria-hidden="true" />}
      {loading && loadingText ? <span>{loadingText}</span> : children}
    </button>
  );
});

export default SpecularButton;
export { SpecularButton };
