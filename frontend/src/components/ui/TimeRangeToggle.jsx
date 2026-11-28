import React, { useRef, useState, useEffect } from "react";
import { useTimeRange, TIME_RANGE_OPTIONS } from "../../context/TimeRangeContext";
import "./TimeRangeToggle.css";

/**
 * TimeRangeToggle: Reusable segmented button toggle for 7D, 30D, and All date ranges.
 * Fully accessible with role="radiogroup", keyboard arrow navigation, and instant optimistic state feedback.
 * Buttons are never disabled during background loading to prevent lag and allow rapid switching.
 *
 * @param {string} value - Current active value ('7D' | '30D' | 'All' or lowercase variants)
 * @param {function} onChange - Callback invoked with selected value
 * @param {Array} options - Optional list of { value, label } options (defaults to 7D, 30D, All)
 * @param {boolean} disabled - Ignored for toggle buttons during loading to ensure instant responsiveness
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

  // Optimistic selection: set active state immediately in the exact same frame
  const [optimisticValue, setOptimisticValue] = useState(activeValue);

  useEffect(() => {
    if (activeValue !== undefined) {
      setOptimisticValue(activeValue);
    }
  }, [activeValue]);

  const handleSelect = (optValue) => {
    // Instant same-frame feedback: never wait for the async request to highlight button
    setOptimisticValue(optValue);
    if (typeof handleChange === "function") {
      handleChange(optValue);
    }
  };

  const handleKeyDown = (e, index) => {
    let nextIndex = -1;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      nextIndex = index > 0 ? index - 1 : options.length - 1;
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      nextIndex = index < options.length - 1 ? index + 1 : 0;
    }

    if (nextIndex >= 0) {
      const nextOpt = options[nextIndex];
      if (nextOpt) {
        handleSelect(nextOpt.value);
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
          String(optimisticValue).trim().toUpperCase() ===
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
            className={`time-range-toggle-btn ${isSelected ? "active" : ""}`}
            onClick={() => {
              // Never disable buttons while loading: allow rapid switching across timeframes
              if (!isSelected) {
                handleSelect(opt.value);
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
