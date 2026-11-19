// CHANGE: React Bits AnimatedContent Component — 2026-11-19
import { useRef, useEffect } from "react";
import gsap from "gsap";

const AnimatedContent = ({
  children,
  distance = 30,
  direction = "vertical",
  reverse = false,
  duration = 0.6,
  delay = 0,
  initialOpacity = 0,
  animateOpacity = true,
  scale = 1,
  className = "",
  style = {},
}) => {
  const elRef = useRef(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    // Check user preference for reduced motion
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      gsap.set(el, { opacity: 1, x: 0, y: 0, scale: 1 });
      return;
    }

    const axis = direction === "horizontal" ? "x" : "y";
    const offset = reverse ? -distance : distance;

    gsap.fromTo(
      el,
      {
        opacity: animateOpacity ? initialOpacity : 1,
        [axis]: offset,
        scale: scale !== 1 ? scale : 1,
      },
      {
        opacity: 1,
        [axis]: 0,
        scale: 1,
        duration,
        delay,
        ease: "power2.out",
        clearProps: "transform",
      }
    );
  }, [distance, direction, reverse, duration, delay, initialOpacity, animateOpacity, scale]);

  return (
    <div ref={elRef} className={`animated-content ${className}`} style={style}>
      {children}
    </div>
  );
};

export default AnimatedContent;
