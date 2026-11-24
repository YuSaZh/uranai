"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ClothDetailSettings,
  ClothMaterialId,
  ClothMotifId,
  ThemePreset,
} from "@/types/tarot";
import {
  CLOTH_MATERIALS,
  DEFAULT_CLOTH_DETAIL,
  getProceduralFabricTiles,
  type GeneratedMaterialTiles,
} from "@/lib/cloth-textures";

export interface ClothStageProps {
  theme: ThemePreset;
  detail?: ClothDetailSettings;
  gyroEnabled?: boolean;
  subtle?: boolean;
}

const FALLBACK_WEAVE_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23f)' opacity='0.48'/%3E%3C/svg%3E\")";

const ALTAR_SPOKES = Array.from({ length: 12 }, (_, i) => i * 30);
const ALTAR_TICKS = Array.from({ length: 36 }, (_, i) => i * 10);
const BOTANICAL_PETALS = Array.from({ length: 8 }, (_, i) => i * 45);
const CELTIC_ARCS = Array.from({ length: 4 }, (_, i) => i * 90);

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

function getMaterialWeaveScale(
  material: ClothMaterialId,
  isLight: boolean
): { weaveMax: number; cloudMax: number; sheenBoost: number } {
  switch (material) {
    case "velvet":
      return {
        weaveMax: isLight ? 0.44 : 0.62,
        cloudMax: isLight ? 0.3 : 0.44,
        sheenBoost: 1.0,
      };
    case "linen":
      return {
        weaveMax: isLight ? 0.56 : 0.52,
        cloudMax: isLight ? 0.2 : 0.24,
        sheenBoost: 0.42,
      };
    case "silk":
      return {
        weaveMax: isLight ? 0.46 : 0.56,
        cloudMax: isLight ? 0.26 : 0.36,
        sheenBoost: 1.28,
      };
    case "suede":
      return {
        weaveMax: isLight ? 0.4 : 0.5,
        cloudMax: isLight ? 0.22 : 0.3,
        sheenBoost: 0.55,
      };
    case "constellation":
      return {
        weaveMax: isLight ? 0.48 : 0.64,
        cloudMax: isLight ? 0.24 : 0.32,
        sheenBoost: 1.15,
      };
  }
}

function createParticles(
  width: number,
  height: number,
  style: ThemePreset["particleStyle"],
  densityScale: number,
  subtle: boolean
): Particle[] {
  if (densityScale <= 0.01) return [];
  const isCompact = width < 640;
  let baseCount = isCompact ? 34 : 56;
  if (style === "aurora") {
    baseCount = isCompact ? 9 : 14;
  } else if (style === "ink-mist") {
    baseCount = isCompact ? 22 : 34;
  } else if (style === "firefly") {
    baseCount = isCompact ? 24 : 38;
  }

  let count = Math.round(baseCount * (0.25 + densityScale * 1.1));
  if (subtle) {
    count = Math.max(4, Math.round(count * 0.65));
  }
  count = Math.max(0, Math.min(96, count));

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

function EmbroideredMotifSvg({
  motif,
  accentColor,
  opacity,
  isLight,
}: {
  motif: ClothMotifId;
  accentColor: string;
  opacity: number;
  isLight: boolean;
}) {
  if (motif === "minimal" || opacity <= 0.005) return null;

  const stitchFilter = isLight
    ? "drop-shadow(0 1px 1px rgba(255,252,244,0.65)) drop-shadow(0 -0.5px 0.8px rgba(70,48,18,0.22))"
    : "drop-shadow(0 1.4px 1.6px rgba(0,0,0,0.82)) drop-shadow(0 -0.6px 0.6px rgba(255,244,205,0.26))";

  if (motif === "lunar-phases") {
    return (
      <svg
        viewBox="0 0 800 800"
        className="h-[min(116vw,780px)] w-[min(116vw,780px)] animate-[spin_240s_linear_infinite]"
        style={{
          color: accentColor,
          opacity,
          filter: stitchFilter,
        }}
      >
        <circle cx="400" cy="400" r="356" fill="none" stroke="currentColor" strokeWidth="1.35" />
        <circle
          cx="400"
          cy="400"
          r="338"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.75"
          strokeDasharray="3 5"
        />
        <circle cx="400" cy="400" r="246" fill="none" stroke="currentColor" strokeWidth="1.05" />
        <circle
          cx="400"
          cy="400"
          r="152"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.75"
          strokeDasharray="2 6"
        />
        <circle cx="400" cy="400" r="78" fill="none" stroke="currentColor" strokeWidth="1.15" />

        {/* Central eclipsed sun-moon emblem */}
        <path
          d="M 400 342 A 58 58 0 1 1 400 458 A 42 42 0 1 0 400 342 Z"
          fill="currentColor"
          fillOpacity="0.48"
        />
        <circle cx="400" cy="400" r="10" fill="none" stroke="currentColor" strokeWidth="1.1" />
        <circle cx="400" cy="400" r="3.2" fill="currentColor" />

        {/* 8 Lunar Phases distributed symmetrically on the outer orbital ring */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, idx) => (
          <g key={deg} transform={`rotate(${deg} 400 400)`}>
            <line
              x1="400"
              y1="152"
              x2="400"
              y2="246"
              stroke="currentColor"
              strokeWidth="0.7"
              strokeOpacity="0.65"
            />
            <circle
              cx="400"
              cy="108"
              r="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.15"
            />
            {idx === 0 && (
              <circle cx="400" cy="108" r="19" fill="currentColor" fillOpacity="0.78" />
            )}
            {idx === 4 && (
              <circle
                cx="400"
                cy="108"
                r="17"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.9"
                strokeDasharray="2 3"
              />
            )}
            {(idx === 1 || idx === 7) && (
              <path
                d="M 400 89 A 19 19 0 1 1 400 127 A 10 19 0 1 1 400 89 Z"
                fill="currentColor"
                fillOpacity="0.7"
                transform={idx === 7 ? "scale(-1 1) translate(-800 0)" : undefined}
              />
            )}
            {(idx === 2 || idx === 6) && (
              <path
                d="M 400 89 A 19 19 0 0 1 400 127 Z"
                fill="currentColor"
                fillOpacity="0.72"
                transform={idx === 6 ? "scale(-1 1) translate(-800 0)" : undefined}
              />
            )}
            {(idx === 3 || idx === 5) && (
              <path
                d="M 400 89 A 19 19 0 0 1 400 127 A 11 19 0 0 0 400 89 Z"
                fill="currentColor"
                fillOpacity="0.72"
                transform={idx === 5 ? "scale(-1 1) translate(-800 0)" : undefined}
              />
            )}
            <path
              d="M 400 54 L 402.5 63 L 411 65.5 L 402.5 68 L 400 77 L 397.5 68 L 389 65.5 L 397.5 63 Z"
              fill="currentColor"
              fillOpacity="0.82"
            />
          </g>
        ))}
      </svg>
    );
  }

  if (motif === "mucha-botanical") {
    return (
      <svg
        viewBox="0 0 800 800"
        className="h-[min(116vw,780px)] w-[min(116vw,780px)]"
        style={{
          color: accentColor,
          opacity,
          filter: stitchFilter,
        }}
      >
        {/* Double Art Nouveau halo rings */}
        <circle cx="400" cy="400" r="358" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="400" cy="400" r="344" fill="none" stroke="currentColor" strokeWidth="0.8" />
        <circle
          cx="400"
          cy="400"
          r="306"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.95"
          strokeDasharray="6 4"
        />
        <circle cx="400" cy="400" r="222" fill="none" stroke="currentColor" strokeWidth="1.15" />
        <circle cx="400" cy="400" r="112" fill="none" stroke="currentColor" strokeWidth="0.9" />

        {/* 8 Symmetrical Mucha floral petals & sinuous whiplash tendrils */}
        {BOTANICAL_PETALS.map((deg) => (
          <g key={deg} transform={`rotate(${deg} 400 400)`}>
            {/* Sinuous whiplash arch */}
            <path
              d="M 400 58 C 436 96, 444 150, 418 202 C 409 220, 403 242, 400 288 C 397 242, 391 220, 382 202 C 356 150, 364 96, 400 58 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            {/* Inner iris blossom */}
            <path
              d="M 400 86 C 418 112, 418 144, 400 174 C 382 144, 382 112, 400 86 Z"
              fill="currentColor"
              fillOpacity="0.22"
              stroke="currentColor"
              strokeWidth="0.95"
            />
            {/* Flanking vine curls */}
            <path
              d="M 380 128 C 352 126, 342 150, 358 166 C 368 176, 382 168, 378 156"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.9"
            />
            <path
              d="M 420 128 C 448 126, 458 150, 442 166 C 432 176, 418 168, 422 156"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.9"
            />
            <circle cx="400" cy="70" r="4.2" fill="currentColor" />
            <circle cx="400" cy="196" r="2.6" fill="currentColor" />
          </g>
        ))}

        {/* Inner lotus rosette */}
        {BOTANICAL_PETALS.map((deg) => (
          <g key={`inner-${deg}`} transform={`rotate(${deg + 22.5} 400 400)`}>
            <path
              d="M 400 318 C 414 344, 414 370, 400 392 C 386 370, 386 344, 400 318 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.95"
            />
          </g>
        ))}
        <circle cx="400" cy="400" r="18" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="400" cy="400" r="5" fill="currentColor" />
      </svg>
    );
  }

  if (motif === "celtic-knot") {
    return (
      <svg
        viewBox="0 0 800 800"
        className="h-[min(116vw,780px)] w-[min(116vw,780px)]"
        style={{
          color: accentColor,
          opacity,
          filter: stitchFilter,
        }}
      >
        {/* Outer braided double border */}
        <circle cx="400" cy="400" r="356" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle
          cx="400"
          cy="400"
          r="338"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.15"
          strokeDasharray="12 6"
        />
        <circle cx="400" cy="400" r="320" fill="none" stroke="currentColor" strokeWidth="1.1" />
        <circle cx="400" cy="400" r="228" fill="none" stroke="currentColor" strokeWidth="1.2" />

        {/* Interlaced Celtic quaternary arcs */}
        {CELTIC_ARCS.map((deg) => (
          <g key={deg} transform={`rotate(${deg} 400 400)`}>
            <path
              d="M 400 84 C 520 84, 594 196, 514 286 C 464 342, 336 342, 286 286 C 206 196, 280 84, 400 84 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.35"
            />
            <path
              d="M 400 100 C 504 100, 568 196, 498 274 C 454 322, 346 322, 302 274 C 232 196, 296 100, 400 100 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
            />
            {/* Cardinal spear diamond */}
            <path
              d="M 400 44 L 414 82 L 400 120 L 386 82 Z"
              fill="currentColor"
              fillOpacity="0.22"
              stroke="currentColor"
              strokeWidth="1.1"
            />
            <circle cx="400" cy="82" r="3.4" fill="currentColor" />
          </g>
        ))}

        {/* Diagonal knot diamonds */}
        <rect
          x="236"
          y="236"
          width="328"
          height="328"
          rx="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
          transform="rotate(45 400 400)"
        />
        <rect
          x="252"
          y="252"
          width="296"
          height="296"
          rx="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.8"
        />
        <circle cx="400" cy="400" r="64" fill="none" stroke="currentColor" strokeWidth="1.25" />
        <circle cx="400" cy="400" r="14" fill="none" stroke="currentColor" strokeWidth="1.1" />
      </svg>
    );
  }

  // Default: Astrolabe
  return (
    <svg
      viewBox="0 0 800 800"
      className="h-[min(118vw,780px)] w-[min(118vw,780px)] animate-[spin_200s_linear_infinite]"
      style={{
        color: accentColor,
        opacity,
        filter: stitchFilter,
      }}
    >
      <circle cx="400" cy="400" r="360" fill="none" stroke="currentColor" strokeWidth="1.35" />
      <circle
        cx="400"
        cy="400"
        r="342"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.75"
        strokeDasharray="4 6"
      />
      <circle cx="400" cy="400" r="272" fill="none" stroke="currentColor" strokeWidth="1.05" />
      <circle cx="400" cy="400" r="256" fill="none" stroke="currentColor" strokeWidth="0.65" />
      <circle
        cx="400"
        cy="400"
        r="156"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeDasharray="2 5"
      />
      <circle cx="400" cy="400" r="74" fill="none" stroke="currentColor" strokeWidth="0.95" />

      {ALTAR_TICKS.map((deg) => (
        <line
          key={deg}
          x1="400"
          y1="40"
          x2="400"
          y2={deg % 30 === 0 ? "58" : "49"}
          stroke="currentColor"
          strokeWidth={deg % 30 === 0 ? "1.15" : "0.65"}
          transform={`rotate(${deg} 400 400)`}
        />
      ))}

      {ALTAR_SPOKES.map((deg) => (
        <g key={deg} transform={`rotate(${deg} 400 400)`}>
          <line
            x1="400"
            y1="144"
            x2="400"
            y2="256"
            stroke="currentColor"
            strokeWidth="0.7"
            strokeOpacity="0.82"
          />
          <circle cx="400" cy="116" r="2.8" fill="currentColor" />
        </g>
      ))}

      <rect
        x="218"
        y="218"
        width="364"
        height="364"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.85"
      />
      <rect
        x="218"
        y="218"
        width="364"
        height="364"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.85"
        transform="rotate(45 400 400)"
      />

      {[0, 90, 180, 270].map((deg) => (
        <g key={deg} transform={`rotate(${deg} 400 400)`}>
          <path
            d="M 396 76 A 12 12 0 1 1 396 96 A 9 9 0 1 0 396 76 Z"
            fill="currentColor"
          />
        </g>
      ))}
    </svg>
  );
}

export function ClothStage({
  theme,
  detail = DEFAULT_CLOTH_DETAIL,
  gyroEnabled = false,
  subtle = false,
}: ClothStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sheenRef = useRef<HTMLDivElement | null>(null);
  const [tiles, setTiles] = useState<GeneratedMaterialTiles | null>(null);

  const clothGradient =
    theme.cssVars["--cloth-gradient"] ??
    theme.cssVars["--bg-base"] ??
    "radial-gradient(circle at 50% 35%, #161b33 0%, #090b14 75%)";
  const rawClothGlow = theme.cssVars["--cloth-glow"] ?? "rgba(212,175,55,0.16)";
  const clothGlowBackground = rawClothGlow.includes("gradient")
    ? rawClothGlow
    : `radial-gradient(ellipse 68% 54% at 50% 42%, ${rawClothGlow} 0%, transparent 72%)`;
  const accentColor = theme.cssVars["--accent"] ?? "#d4af37";

  const materialMeta = useMemo(
    () =>
      CLOTH_MATERIALS.find((m) => m.id === detail.material) ??
      CLOTH_MATERIALS[0],
    [detail.material]
  );

  // Generate & cache seamless procedural textile tiles client-side
  useEffect(() => {
    const generated = getProceduralFabricTiles(detail.material, theme.isLight);
    setTiles(generated);
  }, [detail.material, theme.isLight]);

  const textureScale = Math.max(0, Math.min(1, detail.textureIntensity / 100));
  const foldScale = Math.max(0, Math.min(1, detail.foldDepth / 100));
  const motifScale = Math.max(0, Math.min(1, detail.motifOpacity / 100));
  const vignetteScale = Math.max(0, Math.min(1, detail.vignetteStrength / 100));
  const particleScale = Math.max(0, Math.min(1, detail.particleDensity / 100));

  const optics = getMaterialWeaveScale(detail.material, theme.isLight);
  const weaveOpacity = textureScale * optics.weaveMax;
  const cloudOpacity = textureScale * optics.cloudMax;
  const motifFinalOpacity =
    detail.motif === "minimal"
      ? 0
      : motifScale * (subtle ? 0.14 : theme.isLight ? 0.34 : 0.28);

  // Interactive grazing velvet/silk sheen driven via RAF CSS custom properties (0 re-renders)
  useEffect(() => {
    if (typeof window === "undefined" || !detail.interactiveSheen) return;
    const el = sheenRef.current;
    if (!el) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    let targetX = 50;
    let targetY = 38;
    let currentX = 50;
    let currentY = 38;
    let rafId: number | null = null;

    const tick = () => {
      currentX += (targetX - currentX) * 0.085;
      currentY += (targetY - currentY) * 0.085;
      el.style.setProperty("--sheen-x", `${currentX.toFixed(2)}%`);
      el.style.setProperty("--sheen-y", `${currentY.toFixed(2)}%`);

      if (
        Math.abs(targetX - currentX) > 0.08 ||
        Math.abs(targetY - currentY) > 0.08
      ) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        rafId = null;
      }
    };

    const kick = () => {
      if (rafId === null) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (window.innerWidth <= 0 || window.innerHeight <= 0) return;
      targetX = Math.max(8, Math.min(92, (e.clientX / window.innerWidth) * 100));
      targetY = Math.max(8, Math.min(92, (e.clientY / window.innerHeight) * 100));
      kick();
    };

    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma === null && e.beta === null) return;
      const gx = typeof e.gamma === "number" ? Math.max(-45, Math.min(45, e.gamma)) : 0;
      const by = typeof e.beta === "number" ? Math.max(-35, Math.min(65, e.beta - 30)) : 0;
      targetX = 50 + (gx / 45) * 34;
      targetY = 42 + (by / 50) * 30;
      kick();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    if (gyroEnabled && window.isSecureContext) {
      window.addEventListener("deviceorientation", onOrientation, { passive: true });
    }

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("deviceorientation", onOrientation);
    };
  }, [detail.interactiveSheen, gyroEnabled]);

  // Ambient dust / firefly / aurora particle canvas
  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (particleScale <= 0.01) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

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
      particles = createParticles(
        width,
        height,
        theme.particleStyle,
        particleScale,
        subtle
      );
    };

    const drawFrame = (advance: boolean) => {
      ctx.clearRect(0, 0, width, height);
      const globalAlphaScale =
        (subtle ? 0.52 : 1) * (0.45 + particleScale * 0.65);

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
      if (document.hidden) stopLoop();
      else startLoop();
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
    if (reducedMotion) drawFrame(false);
    else startLoop();

    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    reducedMotionQuery.addEventListener("change", handleReducedMotion);

    return () => {
      stopLoop();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);
      reducedMotionQuery.removeEventListener("change", handleReducedMotion);
    };
  }, [
    theme.particleStyle,
    theme.particleColor,
    theme.particleSecondary,
    particleScale,
    subtle,
  ]);

  // Lighting gradient crafted per lighting preset & theme luminance
  const lightingLayer = useMemo(() => {
    if (detail.lighting === "candlelight") {
      return {
        animated: true,
        background: theme.isLight
          ? "radial-gradient(ellipse 68% 58% at 48% 36%, rgba(255, 214, 138, 0.34) 0%, rgba(214, 152, 64, 0.12) 48%, transparent 78%)"
          : "radial-gradient(ellipse 64% 56% at 48% 38%, rgba(255, 198, 108, 0.22) 0%, rgba(218, 148, 56, 0.11) 42%, transparent 76%)",
        blend: theme.isLight ? ("multiply" as const) : ("screen" as const),
      };
    }
    if (detail.lighting === "moonlight") {
      return {
        animated: false,
        background: theme.isLight
          ? "radial-gradient(ellipse 76% 62% at 20% 14%, rgba(168, 198, 238, 0.32) 0%, rgba(126, 156, 206, 0.08) 54%, transparent 82%)"
          : "radial-gradient(ellipse 74% 64% at 22% 16%, rgba(175, 210, 255, 0.22) 0%, rgba(92, 132, 214, 0.11) 46%, transparent 80%)",
        blend: "screen" as const,
      };
    }
    if (detail.lighting === "spotlight") {
      return {
        animated: false,
        background: theme.isLight
          ? "radial-gradient(circle at 50% 44%, rgba(255, 252, 240, 0.56) 0%, rgba(255, 246, 224, 0.18) 38%, rgba(86, 62, 32, 0.18) 88%)"
          : "radial-gradient(circle at 50% 44%, rgba(255, 244, 212, 0.2) 0%, rgba(255, 235, 190, 0.07) 34%, rgba(0, 0, 0, 0.54) 84%)",
        blend: "normal" as const,
      };
    }
    return {
      animated: false,
      background: clothGlowBackground,
      blend: "normal" as const,
    };
  }, [clothGlowBackground, detail.lighting, theme.isLight]);

  const sheenOpacity = detail.interactiveSheen
    ? Math.min(0.45, (0.14 + textureScale * 0.16) * optics.sheenBoost)
    : 0;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 isolate overflow-hidden select-none"
    >
      {/* 1. Base Dyed Reading Cloth */}
      <div
        className="absolute inset-0 transition-all duration-700 ease-out"
        style={{
          background: clothGradient,
        }}
      />

      {/* 2. Procedural Woven / Brushed Pile Textile Micro-Texture (hard-light preserves dark velvet depth & highlights) */}
      <div
        className="absolute inset-0 transition-opacity duration-500"
        style={{
          backgroundImage: tiles ? `url("${tiles.weaveUrl}")` : FALLBACK_WEAVE_URI,
          backgroundRepeat: "repeat",
          backgroundSize: tiles
            ? `${materialMeta.tileSize}px ${materialMeta.tileSize}px`
            : "140px 140px",
          opacity: tiles ? weaveOpacity : theme.isLight ? 0.16 : 0.12,
          mixBlendMode: tiles ? "hard-light" : theme.isLight ? "multiply" : "soft-light",
        }}
      />

      {/* 3. Crushed-Velvet Directional Nap & Tonal Cloth Clouds */}
      {tiles && cloudOpacity > 0.01 && (
        <div
          className="absolute inset-0 transition-opacity duration-500"
          style={{
            backgroundImage: `url("${tiles.cloudUrl}")`,
            backgroundRepeat: "repeat",
            backgroundSize: "480px 480px",
            opacity: cloudOpacity,
            mixBlendMode: "hard-light",
          }}
        />
      )}

      {/* 4. Sculpted 3D Cloth Drape Folds & Soft Corner Creases */}
      {foldScale > 0.01 && (
        <>
          <div
            className="absolute inset-0 transition-opacity duration-500"
            style={{
              opacity: foldScale * (theme.isLight ? 0.34 : 0.42),
              mixBlendMode: "hard-light",
              background:
                "linear-gradient(124deg, rgba(0,0,0,0.44) 0%, rgba(255,255,255,0.22) 12%, rgba(0,0,0,0.34) 24%, rgba(255,255,255,0.14) 37%, rgba(0,0,0,0.26) 51%, rgba(255,255,255,0.2) 64%, rgba(0,0,0,0.36) 78%, rgba(255,255,255,0.16) 90%, rgba(0,0,0,0.42) 100%)",
            }}
          />
          <div
            className="absolute inset-0 transition-opacity duration-500"
            style={{
              opacity: foldScale * (theme.isLight ? 0.26 : 0.36),
              mixBlendMode: "multiply",
              background:
                "linear-gradient(38deg, rgba(0,0,0,0.52) 0%, transparent 18%, rgba(0,0,0,0.24) 34%, transparent 54%, rgba(0,0,0,0.28) 72%, transparent 86%, rgba(0,0,0,0.56) 100%), radial-gradient(ellipse 95% 42% at 50% 0%, rgba(0,0,0,0.34) 0%, transparent 64%), radial-gradient(ellipse 95% 42% at 50% 100%, rgba(0,0,0,0.42) 0%, transparent 66%)",
            }}
          />
        </>
      )}

      {/* 5. Living Tabletop Ambient / Candlelight / Moonlight / Spotlight Pool */}
      <div
        className={`absolute -inset-6 transition-all duration-700 ${
          lightingLayer.animated ? "animate-candle-breath" : ""
        }`}
        style={{
          background: lightingLayer.background,
          mixBlendMode: lightingLayer.blend,
          opacity: subtle ? 0.65 : 1,
        }}
      />
      {detail.lighting !== "ambient" && (
        <div
          className="absolute inset-0 transition-all duration-700"
          style={{
            background: clothGlowBackground,
            opacity: subtle ? 0.35 : 0.62,
          }}
        />
      )}

      {/* 6. Interactive Grazing Nap Sheen (tracks pointer / mobile gyroscope with 0 React re-renders) */}
      {detail.interactiveSheen && (
        <div
          ref={sheenRef}
          className="absolute inset-0 transition-opacity duration-500"
          style={
            {
              "--sheen-x": "50%",
              "--sheen-y": "38%",
              opacity: sheenOpacity,
              mixBlendMode: theme.isLight ? "soft-light" : "screen",
              background: theme.isLight
                ? "radial-gradient(ellipse 52% 42% at var(--sheen-x) var(--sheen-y), rgba(255,252,240,0.85) 0%, rgba(255,244,218,0.25) 45%, transparent 74%)"
                : `radial-gradient(ellipse 46% 36% at var(--sheen-x) var(--sheen-y), rgba(255,246,222,0.38) 0%, ${accentColor}26 38%, transparent 74%)`,
            } as React.CSSProperties
          }
        />
      )}

      {/* 7. Embossed Gold-Thread Embroidered Altar Motif */}
      <div className="absolute inset-0 flex items-center justify-center">
        <EmbroideredMotifSvg
          motif={detail.motif}
          accentColor={accentColor}
          opacity={motifFinalOpacity}
          isLight={theme.isLight}
        />
      </div>

      {/* 8. Stitched Antique-Gold Altar Cloth Hem & 4 Corner Filigree Ornaments */}
      {detail.goldTrim && (
        <div
          className="absolute inset-[8px] sm:inset-[12px] rounded-[18px] sm:rounded-[22px] transition-opacity duration-500"
          style={{
            border: `1px solid ${accentColor}4a`,
            boxShadow: theme.isLight
              ? `inset 0 0 0 1px ${accentColor}22, 0 1px 0 rgba(255,255,255,0.45)`
              : `inset 0 0 0 1px ${accentColor}1c, 0 1px 4px rgba(0,0,0,0.65)`,
          }}
        >
          {/* Inner stitched dashed embroidery thread */}
          <div
            className="absolute inset-[5px] rounded-[14px] sm:rounded-[17px]"
            style={{
              border: `1px dashed ${accentColor}40`,
            }}
          />

          {/* 4 Symmetrical Corner Filigree Medallions */}
          {[
            { pos: "top-1 left-1", rot: 0 },
            { pos: "top-1 right-1", rot: 90 },
            { pos: "bottom-1 right-1", rot: 180 },
            { pos: "bottom-1 left-1", rot: 270 },
          ].map((corner, idx) => (
            <svg
              key={idx}
              viewBox="0 0 64 64"
              className={`absolute ${corner.pos} h-9 w-9 sm:h-13 sm:w-13`}
              style={{
                color: accentColor,
                opacity: theme.isLight ? 0.56 : 0.44,
                transform: `rotate(${corner.rot}deg)`,
                filter: theme.isLight
                  ? "drop-shadow(0 1px 0.8px rgba(255,255,255,0.55))"
                  : "drop-shadow(0 1px 1.6px rgba(0,0,0,0.75))",
              }}
            >
              <path
                d="M 6 50 L 6 16 C 6 10 10 6 16 6 L 50 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path
                d="M 10 38 A 28 28 0 0 1 38 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.85"
              />
              <path
                d="M 10 28 A 18 18 0 0 1 28 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.65"
                strokeDasharray="2 2.5"
              />
              <circle cx="14" cy="14" r="3.2" fill="none" stroke="currentColor" strokeWidth="0.9" />
              <circle cx="14" cy="14" r="1.2" fill="currentColor" />
              <path
                d="M 27 21 L 28.1 25.9 L 33 27 L 28.1 28.1 L 27 33 L 25.9 28.1 L 21 27 L 25.9 25.9 Z"
                fill="currentColor"
                fillOpacity="0.85"
              />
              <circle cx="48" cy="11" r="1.2" fill="currentColor" />
              <circle cx="11" cy="48" r="1.2" fill="currentColor" />
            </svg>
          ))}
        </div>
      )}

      {/* 9. 60fps Lightweight Ambient Particle Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* 10. Adjustable Deep Velvet Edge Vignette */}
      {vignetteScale > 0.01 && (
        <div
          className="absolute inset-0 transition-opacity duration-500"
          style={{
            background: theme.isLight
              ? `radial-gradient(ellipse at 50% 45%, transparent ${Math.round(56 - vignetteScale * 18)}%, rgba(86,62,32,${(0.32 * vignetteScale).toFixed(3)}) 100%)`
              : `radial-gradient(ellipse at 50% 45%, transparent ${Math.round(56 - vignetteScale * 22)}%, rgba(1,2,6,${(0.84 * vignetteScale).toFixed(3)}) 100%)`,
          }}
        />
      )}
    </div>
  );
}
