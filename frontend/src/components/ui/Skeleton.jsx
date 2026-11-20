// Skeleton: Low-contrast animated pulse placeholder for loading content blocks, text lines, and charts.
import React from "react";
import "./ui.css";

function Skeleton({
  width = "100%",
  height = "20px",
  borderRadius = "6px",
  circle = false,
  className = "",
  style = {},
  ...props
}) {
  return (
    <div
      className={`ui-skeleton ${circle ? "ui-skeleton--circle" : ""} ${className}`}
      style={{
        width,
        height,
        borderRadius: circle ? "50%" : borderRadius,
        ...style,
      }}
      aria-hidden="true"
      {...props}
    />
  );
}

export default Skeleton;
export { Skeleton };
