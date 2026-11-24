"use client";

import { useEffect, useRef } from "react";
import type { ThemePreset } from "@/types/tarot";

export interface ClothStageProps {
  theme: ThemePreset;
  subtle?: boolean;
}

const FABRIC_WEAVE_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23f)' opacity='0.48'/%3E%3C/svg%3E\")";

const ALTAR_SPOKES = Array.from({ length: 12 }, (_, i) => i * 30);
const ALTAR_TICKS = Array.from({ length: 36 }, (_, i) => i * 10);

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  phase: number;
  phaseSpeed: number;
  secondary: boolean;
  sparkle: boolean;
}

function createParticles(
  width: number,
  height: number,
  style: ThemePreset["particleStyle"],
  subtle: boolean
): Particle[] {
  const isCompact = width < 640;
  let count = isCompact ? 34 : 54;
  if (style === "aurora") {
    count = isCompact ? 9 : 14;
  } else if (style === "ink-mist") {
    count = isCompact ? 22 : 34;
  } else if (style === "firefly") {
    count = isCompact ? 24 : 38;
  }
  if (subtle) {
    count = Math.max(8, Math.round(count * 0.65));
  }

  return Array.from({ length: count }, (_, idx) => {
    const secondary = idx % 3 === 0;
    if (style === "aurora") {
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.12,
        size: 64 + Math.random() * (isCompact ? 76 : 110),
        alpha: 0.08 + Math.random() * 0.11,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: 0.004 + Math.random() * 0.005,
        secondary,
        sparkle: false,
      };
    }

    if (style === "firefly") {
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.28,
        vy: -0.08 - Math.random() * 0.24,
        size: 1.8 + Math.random() * 2.6,
        alpha: 0.25 + Math.random() * 0.55,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: 0.015 + Math.random() * 0.022,
        secondary,
        sparkle: false,
      };
    }

    if (style === "linen-motes") {
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 0.05 + Math.random() * 0.14,
        vy: -0.04 + (Math.random() - 0.5) * 0.12,
        size: 1.1 + Math.random() * 2.1,
        alpha: 0.16 + Math.random() * 0.26,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: 0.008 + Math.random() * 0.014,
        secondary,
        sparkle: false,
      };
    }

    if (style === "ink-mist") {
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.18,
        vy: -0.1 - Math.random() * 0.2,
        size: 10 + Math.random() * 24,
        alpha: 0.06 + Math.random() * 0.1,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: 0.007 + Math.random() * 0.01,
        secondary,
        sparkle: idx % 7 === 0,
      };
    }

    // Default: stardust
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.15,
      vy: -0.06 - Math.random() * 0.18,
      size: 0.9 + Math.random() * 1.9,
      alpha: 0.22 + Math.random() * 0.52,
      phase: Math.random() * Math.PI * 2,
      phaseSpeed: 0.012 + Math.random() * 0.024,
      secondary,
      sparkle: idx % 8 === 0,
    };
  });
}

export function ClothStage({ theme, subtle = false }: ClothStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const clothGradient =
    theme.cssVars["--cloth-gradient"] ??
    theme.cssVars["--bg-base"] ??
    "radial-gradient(circle at 50% 35%, #161b33 0%, #090b14 75%)";
  const rawClothGlow = theme.cssVars["--cloth-glow"] ?? "rgba(212,175,55,0.16)";
  const clothGlowBackground = rawClothGlow.includes("gradient")
    ? rawClothGlow
    : `radial-gradient(ellipse 68% 54% at 50% 42%, ${rawClothGlow} 0%, transparent 72%)`;
  const accentColor = theme.cssVars["--accent"] ?? "#d4af37";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = reducedMotionQuery.matches;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let particles: Particle[] = [];
    let rafId: number | null = null;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = createParticles(width, height, theme.particleStyle, subtle);
    };

    const drawFrame = (advance: boolean) => {
      ctx.clearRect(0, 0, width, height);
      const globalAlphaScale = subtle ? 0.52 : 1;

      for (const p of particles) {
        if (advance) {
          p.phase += p.phaseSpeed;
          const sway =
            theme.particleStyle === "firefly" || theme.particleStyle === "ink-mist"
              ? Math.sin(p.phase) * 0.24
              : Math.sin(p.phase) * 0.08;
          p.x += p.vx + sway;
          p.y += p.vy;

          const pad = p.size + 12;
          if (p.x < -pad) p.x = width + pad;
          if (p.x > width + pad) p.x = -pad;
          if (p.y < -pad) p.y = height + pad;
          if (p.y > height + pad) p.y = -pad;
        }

        const pulse = 0.55 + 0.45 * Math.sin(p.phase);
        const alpha = p.alpha * pulse * globalAlphaScale;
        const color = p.secondary ? theme.particleSecondary : theme.particleColor;

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

        if (theme.particleStyle === "aurora") {
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          grad.addColorStop(0, color);
          grad.addColorStop(1, "transparent");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (theme.particleStyle === "firefly") {
          const haloRadius = p.size * 4.5;
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, haloRadius);
          grad.addColorStop(0, color);
          grad.addColorStop(0.35, color);
          grad.addColorStop(1, "transparent");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, haloRadius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#fff8dc";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.55, 0, Math.PI * 2);
          ctx.fill();
        } else if (theme.particleStyle === "ink-mist") {
          if (p.sparkle) {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
            ctx.fill();
          } else {
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
            grad.addColorStop(0, color);
            grad.addColorStop(1, "transparent");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (theme.particleStyle === "linen-motes") {
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.2);
          grad.addColorStop(0, color);
          grad.addColorStop(1, "transparent");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2.2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Stardust
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();

          if (p.sparkle && pulse > 0.72) {
            const arm = p.size * 4.2;
            ctx.strokeStyle = color;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(p.x - arm, p.y);
            ctx.lineTo(p.x + arm, p.y);
            ctx.moveTo(p.x, p.y - arm);
            ctx.lineTo(p.x, p.y + arm);
            ctx.stroke();
          }
        }

        ctx.restore();
      }
    };

    const stopLoop = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const startLoop = () => {
      if (rafId !== null || document.hidden || reducedMotion) return;
      const loop = () => {
        if (document.hidden || reducedMotion) {
          rafId = null;
          return;
        }
        drawFrame(true);
        rafId = window.requestAnimationFrame(loop);
      };
      rafId = window.requestAnimationFrame(loop);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stopLoop();
      } else {
        startLoop();
      }
    };

    const handleReducedMotion = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      if (reducedMotion) {
        stopLoop();
        drawFrame(false);
      } else {
        startLoop();
      }
    };

    resize();
    if (reducedMotion) {
      drawFrame(false);
    } else {
      startLoop();
    }

    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    reducedMotionQuery.addEventListener("change", handleReducedMotion);

    return () => {
      stopLoop();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);
      reducedMotionQuery.removeEventListener("change", handleReducedMotion);
    };
  }, [theme.particleStyle, theme.particleColor, theme.particleSecondary, subtle]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden select-none"
    >
      {/* 1. Base Reading Cloth Gradient */}
      <div
        className="absolute inset-0 transition-all duration-700 ease-out"
        style={{
          background: clothGradient,
        }}
      />

      {/* 2. Woven Velvet / Silk / Linen Micro-Texture Overlay */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          backgroundImage: FABRIC_WEAVE_URI,
          opacity: theme.isLight ? 0.14 : 0.085,
          mixBlendMode: theme.isLight ? "multiply" : "soft-light",
        }}
      />

      {/* 3. Subtle Inlaid Sacred-Geometry Altar Astrolabe Ring */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg
          viewBox="0 0 800 800"
          className="h-[min(118vw,780px)] w-[min(118vw,780px)] animate-[spin_180s_linear_infinite]"
          style={{
            color: accentColor,
            opacity: subtle ? 0.045 : theme.isLight ? 0.1 : 0.085,
          }}
        >
          {/* Outer inlaid circles */}
          <circle
            cx="400"
            cy="400"
            r="360"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <circle
            cx="400"
            cy="400"
            r="342"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.7"
            strokeDasharray="4 6"
          />
          <circle
            cx="400"
            cy="400"
            r="272"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
          <circle
            cx="400"
            cy="400"
            r="256"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.6"
          />
          <circle
            cx="400"
            cy="400"
            r="156"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.85"
            strokeDasharray="2 5"
          />
          <circle
            cx="400"
            cy="400"
            r="74"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.9"
          />

          {/* 36 astrolabe perimeter ticks */}
          {ALTAR_TICKS.map((deg) => (
            <line
              key={deg}
              x1="400"
              y1="40"
              x2="400"
              y2={deg % 30 === 0 ? "58" : "49"}
              stroke="currentColor"
              strokeWidth={deg % 30 === 0 ? "1.1" : "0.6"}
              transform={`rotate(${deg} 400 400)`}
            />
          ))}

          {/* 12 zodiac meridian rays */}
          {ALTAR_SPOKES.map((deg) => (
            <g key={deg} transform={`rotate(${deg} 400 400)`}>
              <line
                x1="400"
                y1="144"
                x2="400"
                y2="256"
                stroke="currentColor"
                strokeWidth="0.65"
                strokeOpacity="0.8"
              />
              <circle cx="400" cy="116" r="2.8" fill="currentColor" />
            </g>
          ))}

          {/* Sacred geometry octagram */}
          <rect
            x="218"
            y="218"
            width="364"
            height="364"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.75"
          />
          <rect
            x="218"
            y="218"
            width="364"
            height="364"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.75"
            transform="rotate(45 400 400)"
          />

          {/* Four cardinal lunar crescents */}
          {[0, 90, 180, 270].map((deg) => (
            <g key={deg} transform={`rotate(${deg} 400 400)`}>
              <path
                d="M 396 76 A 12 12 0 1 1 396 96 A 9 9 0 1 0 396 76 Z"
                fill="currentColor"
              />
            </g>
          ))}
        </svg>
      </div>

      {/* 4. Soft Central Candlelight Glow Pool */}
      <div
        className="absolute inset-0 transition-all duration-700"
        style={{
          background: clothGlowBackground,
          opacity: subtle ? 0.58 : 1,
        }}
      />

      {/* 5. 60fps Lightweight Ambient Particle Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* 6. Soft Reading Table Edge Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: theme.isLight
            ? "radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(92,70,40,0.14) 100%)"
            : "radial-gradient(ellipse at 50% 45%, transparent 42%, rgba(2,4,10,0.62) 100%)",
        }}
      />
    </div>
  );
}
