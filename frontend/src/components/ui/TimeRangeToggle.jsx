import React, { useRef } from "react";
import { useTimeRange, TIME_RANGE_OPTIONS } from "../../context/TimeRangeContext";
import "./TimeRangeToggle.css";

/**
 * TimeRangeToggle: Reusable segmented button toggle for 7D, 30D, and All date ranges.
 * Fully accessible with role="radiogroup", keyboard arrow navigation, and optimistic state feedback.
 *
 * @param {string} value - Current active value ('7D' | '30D' | 'All' or lowercase variants)
 * @param {function} onChange - Callback invoked with selected value
 * @param {Array} options - Optional list of { value, label } options (defaults to 7D, 30D, All)
 * @param {boolean} disabled - Disable all toggle buttons
 * @param {string} className - Optional container className
 * @param {string} ariaLabel - Accessible label for the radiogroup
 */
export default function TimeRangeToggle({
  value,
  onChange,
  options = TIME_RANGE_OPTIONS,
  disabled = false,
  className = "",
  ariaLabel = "Timeframe selection",
}) {
  const { timeRange: globalRange, setTimeRange: setGlobalRange } = useTimeRange();
  const buttonRefs = useRef([]);

  // Use controlled props if passed, otherwise fall back to global context
  const activeValue = value !== undefined ? value : globalRange;
  const handleChange = onChange || setGlobalRange;

  const handleKeyDown = (e, index) => {
    let nextIndex = -1;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      nextIndex = index > 0 ? index - 1 : options.length - 1;
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      nextIndex = index < options.length - 1 ? index + 1 : 0;
    }

    if (nextIndex >= 0 && !disabled) {
      const nextOpt = options[nextIndex];
      if (nextOpt) {
        handleChange(nextOpt.value);
        buttonRefs.current[nextIndex]?.focus();
      }
    }
  };

  return (
    <div
      className={`time-range-toggle ${className}`}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((opt, index) => {
        const isSelected =
          String(activeValue).trim().toUpperCase() ===
          String(opt.value).trim().toUpperCase();

        return (
          <button
            key={opt.value}
            ref={(el) => (buttonRefs.current[index] = el)}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-pressed={isSelected}
            tabIndex={isSelected ? 0 : -1}
            disabled={disabled}
            className={`time-range-toggle-btn ${isSelected ? "active" : ""}`}
            onClick={() => {
              // Prevent double-fire if already selected or disabled
              if (!isSelected && !disabled && typeof handleChange === "function") {
                handleChange(opt.value);
              }
            }}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export { TimeRangeToggle };
