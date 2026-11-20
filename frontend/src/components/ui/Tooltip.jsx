// Tooltip: Lightweight hover label styled with surface tokens and border for subtle contextual guidance.
import React, { useState } from "react";
import "./ui.css";

function Tooltip({
  content,
  children,
  position = "top", // "top" | "bottom" | "left" | "right"
  delay = 120,
  className = "",
}) {
  const [visible, setVisible] = useState(false);
  const [timer, setTimer] = useState(null);

  if (!content) return children;

  const handleMouseEnter = () => {
    const t = setTimeout(() => setVisible(true), delay);
    setTimer(t);
  };

  const handleMouseLeave = () => {
    if (timer) clearTimeout(timer);
    setVisible(false);
  };

  return (
    <div
      className={`ui-tooltip-anchor ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={`ui-tooltip ui-tooltip--${position}`}
        >
          {content}
        </div>
      )}
    </div>
  );
}

export default Tooltip;
export { Tooltip };
