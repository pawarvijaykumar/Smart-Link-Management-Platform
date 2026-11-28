// StatCard: Clean metrics card with muted uppercase label, tabular-nums Geist Mono value, delta pill, and optional sparkline.
import React, { useEffect, useState, useRef } from "react";
import "./ui.css";

function MiniSparkline({ data = [], color = "var(--chart-1)", height = 24, width = 72 }) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * (width - 4) + 2;
      const y = height - 2 - ((val - min) / range) * (height - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="ui-stat-sparkline" aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function StatCard({
  label,
  value,
  delta,
  deltaType = "neutral", // "positive" | "negative" | "neutral"
  helperText,
  helper,
  sparklineData,
  sparklineColor,
  icon,
  className = "",
  decimals = 0,
  prefix = "",
  suffix = "",
}) {
  const finalHelper = helperText || helper;
  const cleanNum =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? parseFloat(value.replace(/,/g, ""))
      : NaN;
  const isNumber = !isNaN(cleanNum);
  const numericVal = isNumber ? cleanNum : 0;
  const [displayValue, setDisplayValue] = useState(isNumber ? numericVal : value);
  const prevValRef = useRef(numericVal);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (!isNumber) {
      setDisplayValue(value);
      return;
    }

    // Check user preference for reduced motion
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // On initial mount or reduced motion, set immediately without animation
    if (prefersReducedMotion || isInitialMount.current) {
      isInitialMount.current = false;
      setDisplayValue(numericVal);
      prevValRef.current = numericVal;
      return;
    }

    const startVal =
      prevValRef.current !== undefined && !isNaN(prevValRef.current)
        ? prevValRef.current
        : numericVal;
    const endVal = numericVal;
    prevValRef.current = numericVal;

    if (startVal === endVal) {
      setDisplayValue(decimals > 0 ? endVal.toFixed(decimals) : endVal);
      return;
    }

    // Smooth, unified 180ms transition from previous value to new value (never jumping from 0)
    let startTimestamp = null;
    const duration = 180;
    let rafId;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const current = startVal + (endVal - startVal) * (1 - (1 - progress) * (1 - progress));
      setDisplayValue(decimals > 0 ? current.toFixed(decimals) : Math.round(current));
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [value, isNumber, numericVal, decimals]);

  const formattedDisplay = isNumber
    ? `${prefix}${Number(displayValue).toLocaleString()}${suffix}`
    : `${prefix}${value}${suffix}`;

  return (
    <div className={`ui-stat-card ${className}`}>
      <div className="ui-stat-top">
        <span className="ui-stat-label">{label}</span>
        {icon && <span className="ui-stat-icon">{icon}</span>}
        {sparklineData && sparklineData.length > 1 && (
          <MiniSparkline data={sparklineData} color={sparklineColor} />
        )}
      </div>

      <div className="ui-stat-value tabular-nums" title={String(value)}>
        {formattedDisplay}
      </div>

      {(delta || finalHelper) && (
        <div className="ui-stat-bottom">
          {delta && (
            <span className={`ui-stat-delta ui-stat-delta--${deltaType}`}>
              {delta}
            </span>
          )}
          {finalHelper && <span className="ui-stat-helper">{finalHelper}</span>}
        </div>
      )}
    </div>
  );
}

export default StatCard;
export { StatCard };
