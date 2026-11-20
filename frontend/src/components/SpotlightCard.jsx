// CHANGE: React Bits SpotlightCard Component (Dynamic Cursor Glow & Border Illumination) — 2026-11-20
import { useRef, useState, useEffect, useCallback } from "react";
import "./SpotlightCard.css";

const SpotlightCard = ({
  children,
  className = "",
  spotlightColor = "rgba(168, 85, 247, 0.38)",
  borderColor = "rgba(192, 132, 252, 0.8)",
  radius = 280,
  onClick,
  style = {},
}) => {
  const divRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(mediaQuery.matches);
      const handler = (e) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener?.("change", handler);
      return () => mediaQuery.removeEventListener?.("change", handler);
    }
  }, []);

  const handleMouseMove = useCallback(
    (e) => {
      if (!divRef.current || prefersReducedMotion) return;
      const rect = divRef.current.getBoundingClientRect();
      const x = Math.round(e.clientX - rect.left);
      const y = Math.round(e.clientY - rect.top);
      setPosition({ x, y });

      divRef.current.style.setProperty("--mouse-x", `${x}px`);
      divRef.current.style.setProperty("--mouse-y", `${y}px`);
    },
    [prefersReducedMotion]
  );

  const handleMouseEnter = useCallback(() => {
    if (prefersReducedMotion) return;
    setIsHovered(true);
  }, [prefersReducedMotion]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  const handleFocus = useCallback(() => {
    if (prefersReducedMotion) return;
    setIsFocused(true);
  }, [prefersReducedMotion]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  const isVisible = (isHovered || isFocused) && !prefersReducedMotion;

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={`card-spotlight ${className} ${isVisible ? "spotlight-active" : ""}`}
      style={{
        ...style,
        "--spotlight-color": spotlightColor,
        "--spotlight-border-color": borderColor,
        "--spotlight-radius": `${radius}px`,
      }}
    >
      {/* 1. Dynamic Cursor-Following Border Glow */}
      {!prefersReducedMotion && (
        <div
          className="spotlight-border-layer"
          style={{
            opacity: isVisible ? 1 : 0,
            background: `radial-gradient(var(--spotlight-radius, 280px) circle at ${position.x}px ${position.y}px, var(--spotlight-border-color), transparent 65%)`,
          }}
          aria-hidden="true"
        />
      )}

      {/* 2. Dynamic Cursor-Following Surface Glow */}
      {!prefersReducedMotion && (
        <div
          className="spotlight-surface-layer"
          style={{
            opacity: isVisible ? 1 : 0,
            background: `radial-gradient(var(--spotlight-radius, 280px) circle at ${position.x}px ${position.y}px, var(--spotlight-color), transparent 75%)`,
          }}
          aria-hidden="true"
        />
      )}

      {/* 3. Card Content */}
      <div className="card-spotlight-inner">{children}</div>
    </div>
  );
};

export default SpotlightCard;
