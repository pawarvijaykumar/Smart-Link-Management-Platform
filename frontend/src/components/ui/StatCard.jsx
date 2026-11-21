// StatCard: Clean metrics card with muted uppercase label, tabular-nums Geist Mono value, delta pill, and optional sparkline.
import React, { useEffect, useState } from "react";
import "./ui.css";

function MiniSparkline({ data = [], color = "#6C7CFF", height = 24, width = 72 }) {
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
  const numericVal = typeof value === "number" ? value : parseFloat(value);
  const isNumber = !isNaN(numericVal);
  const [displayValue, setDisplayValue] = useState(isNumber ? 0 : value);

  useEffect(() => {
    if (!isNumber) {
      setDisplayValue(value);
      return;
    }

    // Single gentle count-up on initial load (600ms)
    let startTimestamp = null;
    const duration = 600;
    const startVal = 0;
    const endVal = numericVal;

    let rafId;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease out quad
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
