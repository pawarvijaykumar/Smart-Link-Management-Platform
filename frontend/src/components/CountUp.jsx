// CHANGE: React Bits CountUp Component — 2026-11-19
import { useEffect, useRef, useState } from "react";

const CountUp = ({
  to = 0,
  from = 0,
  duration = 1.2,
  delay = 0,
  separator = ",",
  decimals = 0,
  className = "",
  startWhen = true,
}) => {
  const [displayValue, setDisplayValue] = useState(from);
  const ref = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    // Check user preference for reduced motion
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const targetVal = Number(to) || 0;
    const startVal = Number(from) || 0;

    if (prefersReducedMotion || !startWhen) {
      setDisplayValue(targetVal);
      return;
    }

    let startTime = null;
    let timerId = null;

    const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      const easedProgress = easeOutExpo(progress);
      const current = startVal + (targetVal - startVal) * easedProgress;

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(step);
      } else {
        setDisplayValue(targetVal);
      }
    };

    if (delay > 0) {
      timerId = setTimeout(() => {
        animationFrameRef.current = requestAnimationFrame(step);
      }, delay * 1000);
    } else {
      animationFrameRef.current = requestAnimationFrame(step);
    }

    return () => {
      if (timerId) clearTimeout(timerId);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [to, from, duration, delay, startWhen]);

  const formatNumber = (val) => {
    const num = Number(val) || 0;
    const parts = num.toFixed(decimals).split(".");
    if (separator) {
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, separator);
    }
    return parts.join(".");
  };

  return (
    <span
      ref={ref}
      className={`count-up ${className}`}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {formatNumber(displayValue)}
    </span>
  );
};

export default CountUp;
