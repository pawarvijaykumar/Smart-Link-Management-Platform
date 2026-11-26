import React from "react";
import { motion } from "motion/react";

export default function FadeContent({
  children,
  blur = false,
  duration = 0.4,
  easing = "easeOut",
  delay = 0,
  initialOpacity = 0,
  distance = 10,
  className = "",
  style = {},
}) {
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      style={style}
      initial={{
        opacity: initialOpacity,
        y: distance,
        filter: blur ? "blur(4px)" : "none",
      }}
      animate={{
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
      }}
      transition={{
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
