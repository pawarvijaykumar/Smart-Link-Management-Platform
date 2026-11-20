// Input: Text input field with prefix/suffix icon slots, keyboard shortcut badge, and accent focus ring.
import React, { forwardRef } from "react";
import "./ui.css";

const Input = forwardRef(function Input(
  {
    type = "text",
    value,
    onChange,
    placeholder,
    icon: Icon,
    iconRight: IconRight,
    shortcut,
    error,
    disabled = false,
    size = "md", // "sm" | "md" | "lg"
    className = "",
    ...props
  },
  ref
) {
  return (
    <div className={`ui-input-container ${disabled ? "ui-input-container--disabled" : ""} ${error ? "ui-input-container--error" : ""} ${className}`}>
      {Icon && (
        <span className="ui-input-icon-left" aria-hidden="true">
          <Icon size={size === "sm" ? 14 : 16} strokeWidth={1.5} />
        </span>
      )}

      <input
        ref={ref}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`ui-input ui-input--${size} ${Icon ? "ui-input--has-icon-left" : ""} ${shortcut || IconRight ? "ui-input--has-icon-right" : ""}`}
        {...props}
      />

      {shortcut && (
        <kbd className="ui-input-shortcut" aria-hidden="true">
          {shortcut}
        </kbd>
      )}

      {!shortcut && IconRight && (
        <span className="ui-input-icon-right" aria-hidden="true">
          <IconRight size={size === "sm" ? 14 : 16} strokeWidth={1.5} />
        </span>
      )}
    </div>
  );
});

export default Input;
export { Input };
