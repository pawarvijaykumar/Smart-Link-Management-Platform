import React, { Children } from "react";
import { motion, AnimatePresence } from "motion/react";

export default function AnimatedList({
  children,
  className = "",
  distance = 12,
  duration = 0.25,
}) {
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div className={`animated-list-container ${className}`}>
      <AnimatePresence initial={false}>
        {Children.map(children, (child) => {
          if (!child) return null;
          const key = child.key || child.props?.id || Math.random();
          return (
            <motion.div
              key={key}
              layout={!prefersReducedMotion}
              initial={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: -distance }
              }
              animate={{ opacity: 1, y: 0 }}
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, height: 0, marginBottom: 0, overflow: "hidden" }
              }
              transition={{
                duration: prefersReducedMotion ? 0.05 : duration,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {child}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
