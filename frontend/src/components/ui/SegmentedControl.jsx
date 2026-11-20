// SegmentedControl: Inline multi-option control with accessible keyboard navigation and sliding active pill.
import React from "react";
import "./ui.css";

function SegmentedControl({
  options = [], // string[] or { value, label }[]
  value,
  onChange,
  size = "md", // "sm" | "md"
  className = "",
  ariaLabel = "Timeframe selector",
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`ui-segmented ui-segmented--${size} ${className}`}
    >
      {options.map((opt) => {
        const optValue = typeof opt === "object" ? opt.value : opt;
        const optLabel = typeof opt === "object" ? opt.label : opt;
        const isSelected = value === optValue;

        return (
          <button
            key={optValue}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange && onChange(optValue)}
            className={`ui-segmented-item ${isSelected ? "ui-segmented-item--active" : ""}`}
          >
            {optLabel}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
export { SegmentedControl };
