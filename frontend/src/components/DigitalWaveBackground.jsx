import React, { useEffect, useRef } from "react";
import "./DigitalWaveBackground.css";

/**
 * DigitalWaveBackground
 * Premium futuristic digital wave background featuring:
 * - Deep navy & almost-black base
 * - Flowing purple & cyan particle waves
 * - Glowing dots and subtle light trails
 * - Smooth harmonic wave curves
 * - High-DPI support, zero dependencies, full viewport coverage
 * - Performance optimized with visibility auto-pause & reduced-motion respect
 */
export default function DigitalWaveBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let time = 0;
    let isVisible = true;

    // Check prefers-reduced-motion
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let isReducedMotion = mediaQuery.matches;
    const handleMotionChange = (e) => {
      isReducedMotion = e.matches;
    };
    mediaQuery.addEventListener?.("change", handleMotionChange);

    // Particles array
    const particles = [];
    const getParticleCount = (w) => (w < 700 ? 36 : 72);

    const initParticles = (w, h) => {
      particles.length = 0;
      const count = getParticleCount(w);
      for (let i = 0; i < count; i++) {
        const isCyan = Math.random() > 0.45;
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          radius: Math.random() * 1.8 + 0.8,
          baseAlpha: Math.random() * 0.5 + 0.35,
          alpha: 0.5,
          pulseSpeed: Math.random() * 0.02 + 0.01,
          pulseOffset: Math.random() * Math.PI * 2,
          color: isCyan ? "6, 182, 212" : "168, 85, 247", // Cyan or Purple
          waveAffinity: Math.random() > 0.4, // Attracted to wave heights
        });
      }
    };

    // Resize handler with High-DPI
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = "100%";
      canvas.style.height = "100%";

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      initParticles(width, height);
      if (isReducedMotion) {
        drawFrame();
      }
    };

    resize();
    window.addEventListener("resize", resize);

    // Pause RAF when page/tab is hidden
    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
      if (isVisible && !isReducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Wave parameters configuration
    const waves = [
      {
        baseYRatio: 0.62,
        amplitude: 48,
        frequency: 0.0016,
        speed: 0.008,
        color1: "rgba(6, 182, 212, 0.75)", // Cyan
        color2: "rgba(99, 102, 241, 0.80)", // Indigo
        glowColor: "rgba(6, 182, 212, 0.35)",
        lineWidth: 2.2,
      },
      {
        baseYRatio: 0.68,
        amplitude: 56,
        frequency: 0.0013,
        speed: 0.006,
        color1: "rgba(139, 92, 246, 0.70)", // Purple
        color2: "rgba(217, 70, 239, 0.65)", // Magenta
        glowColor: "rgba(168, 85, 247, 0.32)",
        lineWidth: 1.8,
      },
      {
        baseYRatio: 0.74,
        amplitude: 38,
        frequency: 0.0022,
        speed: 0.011,
        color1: "rgba(56, 189, 248, 0.60)", // Sky cyan
        color2: "rgba(147, 51, 234, 0.60)", // Deep purple
        glowColor: "rgba(99, 102, 241, 0.25)",
        lineWidth: 1.5,
      },
      {
        baseYRatio: 0.80,
        amplitude: 42,
        frequency: 0.0018,
        speed: 0.007,
        color1: "rgba(34, 211, 238, 0.45)", // Bright Cyan
        color2: "rgba(168, 85, 247, 0.45)", // Soft Violet
        glowColor: "rgba(34, 211, 238, 0.20)",
        lineWidth: 1.2,
      },
    ];

    const getWaveY = (x, wave, t) => {
      const baseY = height * wave.baseYRatio;
      return (
        baseY +
        Math.sin(x * wave.frequency + t * wave.speed) * wave.amplitude +
        Math.cos(x * wave.frequency * 0.6 + t * wave.speed * 0.8) * (wave.amplitude * 0.4)
      );
    };

    // Draw single frame
    const drawFrame = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Deep navy & almost-black base gradient
      const bgGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.55,
        100,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.85
      );
      bgGrad.addColorStop(0, "#080d24");
      bgGrad.addColorStop(0.35, "#06091c");
      bgGrad.addColorStop(0.7, "#040614");
      bgGrad.addColorStop(1, "#020309");

      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Ambient glowing orbs (subtle purple & cyan atmospheric glow)
      const cyanGlow = ctx.createRadialGradient(
        width * 0.82,
        height * 0.72,
        20,
        width * 0.82,
        height * 0.72,
        Math.min(width, height) * 0.55
      );
      cyanGlow.addColorStop(0, "rgba(6, 182, 212, 0.14)");
      cyanGlow.addColorStop(0.5, "rgba(6, 182, 212, 0.04)");
      cyanGlow.addColorStop(1, "transparent");
      ctx.fillStyle = cyanGlow;
      ctx.fillRect(0, 0, width, height);

      const purpleGlow = ctx.createRadialGradient(
        width * 0.18,
        height * 0.38,
        20,
        width * 0.18,
        height * 0.38,
        Math.min(width, height) * 0.6
      );
      purpleGlow.addColorStop(0, "rgba(139, 92, 246, 0.13)");
      purpleGlow.addColorStop(0.5, "rgba(139, 92, 246, 0.03)");
      purpleGlow.addColorStop(1, "transparent");
      ctx.fillStyle = purpleGlow;
      ctx.fillRect(0, 0, width, height);

      // 3. Flowing translucent wave ribbons (fills between adjacent waves)
      if (waves.length >= 2) {
        const step = Math.max(8, Math.floor(width / 120));
        const ribbonGrad = ctx.createLinearGradient(0, height * 0.55, width, height * 0.85);
        ribbonGrad.addColorStop(0, "rgba(6, 182, 212, 0.05)");
        ribbonGrad.addColorStop(0.5, "rgba(99, 102, 241, 0.06)");
        ribbonGrad.addColorStop(1, "rgba(168, 85, 247, 0.05)");

        ctx.beginPath();
        for (let x = 0; x <= width; x += step) {
          const y1 = getWaveY(x, waves[0], time);
          if (x === 0) ctx.moveTo(x, y1);
          else ctx.lineTo(x, y1);
        }
        for (let x = width; x >= 0; x -= step) {
          const y2 = getWaveY(x, waves[1], time);
          ctx.lineTo(x, y2);
        }
        ctx.closePath();
        ctx.fillStyle = ribbonGrad;
        ctx.fill();
      }

      // 4. Draw smooth flowing wave curves
      const step = Math.max(6, Math.floor(width / 140));
      waves.forEach((wave) => {
        const strokeGrad = ctx.createLinearGradient(0, 0, width, 0);
        strokeGrad.addColorStop(0, wave.color1);
        strokeGrad.addColorStop(0.5, wave.color2);
        strokeGrad.addColorStop(1, wave.color1);

        ctx.save();
        ctx.strokeStyle = strokeGrad;
        ctx.lineWidth = wave.lineWidth;
        ctx.shadowColor = wave.glowColor;
        ctx.shadowBlur = 12;

        ctx.beginPath();
        for (let x = 0; x <= width; x += step) {
          const y = getWaveY(x, wave, time);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      });

      // 5. Constellation lines between nearby particles
      ctx.lineWidth = 0.8;
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 80) {
            const lineAlpha = (1 - dist / 80) * 0.12;
            ctx.strokeStyle = `rgba(147, 197, 253, ${lineAlpha})`;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      // 6. Draw glowing dots and light trails
      particles.forEach((p) => {
        p.alpha = p.baseAlpha + Math.sin(time * p.pulseSpeed + p.pulseOffset) * 0.25;
        p.alpha = Math.max(0.15, Math.min(0.9, p.alpha));

        ctx.save();
        ctx.shadowColor = `rgba(${p.color}, 0.7)`;
        ctx.shadowBlur = 8;
        ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    };

    // Animation loop
    const render = () => {
      if (!isVisible) return;
      time += 1;

      // Update particle positions gently
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around boundaries smoothly
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;
      });

      drawFrame();

      if (!isReducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    if (isReducedMotion) {
      drawFrame();
    } else {
      animationFrameId = requestAnimationFrame(render);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      mediaQuery.removeEventListener?.("change", handleMotionChange);
    };
  }, []);

  return (
    <div className="digital-wave-bg" aria-hidden="true">
      <canvas ref={canvasRef} className="digital-wave-canvas" />
      <div className="digital-wave-overlay" />
    </div>
  );
}
