import React from "react";
import { useTheme } from "../context/ThemeContext";
import "./PageBackground.css";

/**
 * Reusable PageBackground component for SmartLink public pages.
 * Rendered as first child of .page with z-index: 0.
 * Children of .page get position: relative; z-index: 1.
 */
export default function PageBackground({ variant }) {
  const { effectiveTheme, effectivePattern } = useTheme();
  const pattern = variant || effectivePattern || (effectiveTheme === "light" ? "dots" : "grid");

  if (pattern === "none") {
    return null;
  }

  return (
    <div
      className={`page-bg page-bg--${pattern} page-bg--theme-${effectiveTheme}`}
      aria-hidden="true"
    />
  );
}
