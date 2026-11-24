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
} from "@/lib/cloth-textures";

export interface ClothStageProps {
  theme: ThemePreset;
  detail?: ClothDetailSettings;
  gyroEnabled?: boolean;
  subtle?: boolean;
}

const MAX_BAKE_DIM = 1280;
const RESIZE_DEBOUNCE_MS = 180;
const PARTICLE_FRAME_INTERVAL_MS = 33; // ~30fps throttle for ambient particles

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

interface DecodedTilePair {
  weave: HTMLImageElement;
  cloud: HTMLImageElement;
}

interface StaticClothBakeParams {
  theme: ThemePreset;
  material: ClothMaterialId;
  tileSize: number;
  weaveOpacity: number;
  cloudOpacity: number;
  foldScale: number;
  vignetteScale: number;
}

interface ParticleSpriteSet {
  primary: HTMLCanvasElement;
  secondary: HTMLCanvasElement;
  sparklePrimary?: HTMLCanvasElement;
  sparkleSecondary?: HTMLCanvasElement;
}

const DECODED_TILE_CACHE = new Map<string, DecodedTilePair>();
const DECODED_TILE_PROMISES = new Map<string, Promise<DecodedTilePair | null>>();

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function getDecodedTilePairSync(
  material: ClothMaterialId,
  isLight: boolean
): DecodedTilePair | null {
  return DECODED_TILE_CACHE.get(`${material}:${isLight ? "L" : "D"}`) ?? null;
}

function loadDecodedTilePair(
  material: ClothMaterialId,
  isLight: boolean
): Promise<DecodedTilePair | null> {
  const key = `${material}:${isLight ? "L" : "D"}`;
  const cached = DECODED_TILE_CACHE.get(key);
  if (cached) return Promise.resolve(cached);

  const pending = DECODED_TILE_PROMISES.get(key);
  if (pending) return pending;

  const tiles = getProceduralFabricTiles(material, isLight);
  if (!tiles) return Promise.resolve(null);

  const promise = Promise.all([
    loadImageElement(tiles.weaveUrl),
    loadImageElement(tiles.cloudUrl),
  ]).then(([weave, cloud]) => {
    DECODED_TILE_PROMISES.delete(key);
    if (!weave || !cloud) return null;
    const pair: DecodedTilePair = { weave, cloud };
    DECODED_TILE_CACHE.set(key, pair);
    return pair;
  });

  DECODED_TILE_PROMISES.set(key, promise);
  return promise;
}

function toZeroAlphaColor(color: string): string {
  const trimmed = color.trim();
  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
        return `rgba(${r}, ${g}, ${b}, 0)`;
      }
    } else if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
        return `rgba(${r}, ${g}, ${b}, 0)`;
      }
    }
  }
  const rgbMatch = trimmed.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i
  );
  if (rgbMatch) {
    return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, 0)`;
  }
  return "rgba(0, 0, 0, 0)";
}

function createSpriteCanvas(
  size: number
): [HTMLCanvasElement, CanvasRenderingContext2D] | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  return [canvas, ctx];
}

function bakeParticleSprite(
  style: ThemePreset["particleStyle"],
  color: string,
  size: number
): HTMLCanvasElement | null {
  const pair = createSpriteCanvas(size);
  if (!pair) return null;
  const [canvas, ctx] = pair;
  const half = size * 0.5;
  const zeroAlpha = toZeroAlphaColor(color);

  if (style === "aurora") {
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, color);
    grad.addColorStop(1, zeroAlpha);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return canvas;
  }

  if (style === "firefly") {
    const haloGrad = ctx.createRadialGradient(half, half, 0, half, half, half);
    haloGrad.addColorStop(0, color);
    haloGrad.addColorStop(0.35, color);
    haloGrad.addColorStop(1, zeroAlpha);
    ctx.fillStyle = haloGrad;
    ctx.fillRect(0, 0, size, size);

    const coreRadius = Math.max(2.2, half * (0.62 / 4.5));
    const coreGrad = ctx.createRadialGradient(
      half,
      half,
      0,
      half,
      half,
      coreRadius
    );
    coreGrad.addColorStop(0, "#fff8dc");
    coreGrad.addColorStop(0.62, "#fff8dc");
    coreGrad.addColorStop(1, "rgba(255, 248, 220, 0)");
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(half, half, coreRadius, 0, Math.PI * 2);
    ctx.fill();
    return canvas;
  }

  if (style === "ink-mist" || style === "linen-motes") {
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, color);
    grad.addColorStop(1, zeroAlpha);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return canvas;
  }

  // Default: stardust crisp dot with soft anti-aliased edge
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, color);
  grad.addColorStop(0.62, color);
  grad.addColorStop(1, zeroAlpha);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

function bakeSparkleSprite(
  style: ThemePreset["particleStyle"],
  color: string
): HTMLCanvasElement | null {
  if (style !== "stardust" && style !== "ink-mist") return null;
  const size = 32;
  const pair = createSpriteCanvas(size);
  if (!pair) return null;
  const [canvas, ctx] = pair;
  const half = size * 0.5;
  const zeroAlpha = toZeroAlphaColor(color);

  if (style === "ink-mist") {
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, color);
    grad.addColorStop(0.68, color);
    grad.addColorStop(1, zeroAlpha);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return canvas;
  }

  // Stardust 4-point cross sparkle
  const hGrad = ctx.createLinearGradient(1, half, size - 1, half);
  hGrad.addColorStop(0, zeroAlpha);
  hGrad.addColorStop(0.5, color);
  hGrad.addColorStop(1, zeroAlpha);
  ctx.strokeStyle = hGrad;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(1, half);
  ctx.lineTo(size - 1, half);
  ctx.stroke();

  const vGrad = ctx.createLinearGradient(half, 1, half, size - 1);
  vGrad.addColorStop(0, zeroAlpha);
  vGrad.addColorStop(0.5, color);
  vGrad.addColorStop(1, zeroAlpha);
  ctx.strokeStyle = vGrad;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(half, 1);
  ctx.lineTo(half, size - 1);
  ctx.stroke();

  const centerGrad = ctx.createRadialGradient(half, half, 0, half, half, 5);
  centerGrad.addColorStop(0, color);
  centerGrad.addColorStop(1, zeroAlpha);
  ctx.fillStyle = centerGrad;
  ctx.beginPath();
  ctx.arc(half, half, 5, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

function createParticleSpriteSet(
  style: ThemePreset["particleStyle"],
  primaryColor: string,
  secondaryColor: string
): ParticleSpriteSet | null {
  const spriteSize = style === "aurora" ? 64 : 32;
  const primary = bakeParticleSprite(style, primaryColor, spriteSize);
  const secondary = bakeParticleSprite(style, secondaryColor, spriteSize);
  if (!primary || !secondary) return null;

  const sparklePrimary = bakeSparkleSprite(style, primaryColor) ?? undefined;
  const sparkleSecondary = bakeSparkleSprite(style, secondaryColor) ?? undefined;
  return {
    primary,
    secondary,
    sparklePrimary,
    sparkleSecondary,
  };
}

function fillEllipticalGradient(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cxRatio: number,
  cyRatio: number,
  stops: Array<[number, string]>,
  rxOverride?: number,
  ryOverride?: number
) {
  const cx = w * cxRatio;
  const cy = h * cyRatio;
  const rx = rxOverride ?? Math.max(cx, w - cx) * Math.SQRT2;
  const ry = ryOverride ?? Math.max(cy, h - cy) * Math.SQRT2;
  if (rx <= 0 || ry <= 0) return;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(rx, ry);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const [offset, color] of stops) {
    grad.addColorStop(offset, color);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(-cx / rx, -cy / ry, w / rx, h / ry);
  ctx.restore();
}

function createCssLinearGradient(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  deg: number,
  stops: Array<[number, string]>
): CanvasGradient {
  const rad = (deg * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const halfLen = (Math.abs(w * dx) + Math.abs(h * dy)) * 0.5;
  const cx = w * 0.5;
  const cy = h * 0.5;
  const grad = ctx.createLinearGradient(
    cx - dx * halfLen,
    cy - dy * halfLen,
    cx + dx * halfLen,
    cy + dy * halfLen
  );
  for (const [offset, color] of stops) {
    grad.addColorStop(offset, color);
  }
  return grad;
}

function drawBaseClothGradient(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: ThemePreset
) {
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  switch (theme.id) {
    case "celestial-velvet":
      fillEllipticalGradient(ctx, w, h, 0.5, 0.24, [
        [0, "#1f1a36"],
        [0.52, "#110f1d"],
        [1, "#07070c"],
      ]);
      return;

    case "emerald-salon":
      fillEllipticalGradient(ctx, w, h, 0.5, 0.26, [
        [0, "#143d31"],
        [0.55, "#0a201a"],
        [1, "#05100d"],
      ]);
      return;

    case "astral-nebula": {
      const baseLinear = createCssLinearGradient(ctx, w, h, 180, [
        [0, "#0c0d24"],
        [1, "#060714"],
      ]);
      ctx.fillStyle = baseLinear;
      ctx.fillRect(0, 0, w, h);

      fillEllipticalGradient(ctx, w, h, 0.76, 0.74, [
        [0, "rgba(34, 211, 238, 0.2)"],
        [0.56, "rgba(34, 211, 238, 0)"],
        [1, "rgba(34, 211, 238, 0)"],
      ]);
      fillEllipticalGradient(ctx, w, h, 0.28, 0.18, [
        [0, "rgba(124, 58, 237, 0.36)"],
        [0.56, "rgba(124, 58, 237, 0)"],
        [1, "rgba(124, 58, 237, 0)"],
      ]);
      return;
    }

    case "parchment-linen":
      fillEllipticalGradient(ctx, w, h, 0.5, 0.24, [
        [0, "#faf5ea"],
        [0.58, "#efe6d5"],
        [1, "#e4d7c1"],
      ]);
      return;

    case "lunar-ink":
      fillEllipticalGradient(ctx, w, h, 0.5, 0.25, [
        [0, "#1e1d20"],
        [0.55, "#111113"],
        [1, "#080809"],
      ]);
      return;

    default: {
      const baseColor = theme.cssVars["--bg-base"] ?? theme.swatches[0] ?? "#090b14";
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, w, h);
      fillEllipticalGradient(ctx, w, h, 0.5, 0.25, [
        [0, theme.swatches[1] ?? "#1a1828"],
        [0.56, theme.swatches[0] ?? baseColor],
        [1, baseColor],
      ]);
    }
  }
}

function drawTiledPattern(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  img: HTMLImageElement,
  tileDisplayPx: number,
  opacity: number,
  compositeOp: GlobalCompositeOperation
) {
  if (!img.naturalWidth || tileDisplayPx <= 0 || opacity <= 0.005) return;
  const pattern = ctx.createPattern(img, "repeat");
  if (!pattern) return;

  const scale = tileDisplayPx / img.naturalWidth;
  if (scale <= 0) return;

  ctx.save();
  ctx.globalCompositeOperation = compositeOp;
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
  ctx.scale(scale, scale);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w / scale, h / scale);
  ctx.restore();
}

function renderBakedStaticCloth(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  viewportScale: number,
  params: StaticClothBakeParams,
  decodedTiles: DecodedTilePair | null
) {
  const { theme, tileSize, weaveOpacity, cloudOpacity, foldScale, vignetteScale } =
    params;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // 1. Base Dyed Reading Cloth (100% opaque base)
  drawBaseClothGradient(ctx, w, h, theme);

  // 2. Procedural Woven / Brushed Pile Textile Micro-Texture (hard-light)
  if (decodedTiles && weaveOpacity > 0.005) {
    drawTiledPattern(
      ctx,
      w,
      h,
      decodedTiles.weave,
      tileSize * viewportScale,
      weaveOpacity,
      "hard-light"
    );
  }

  // 3. Crushed-Velvet Directional Nap & Tonal Cloth Clouds (hard-light)
  if (decodedTiles && cloudOpacity > 0.01) {
    drawTiledPattern(
      ctx,
      w,
      h,
      decodedTiles.cloud,
      480 * viewportScale,
      cloudOpacity,
      "hard-light"
    );
  }

  // 4. Sculpted 3D Cloth Drape Folds & Soft Corner Creases (hard-light + multiply)
  if (foldScale > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = "hard-light";
    ctx.globalAlpha = Math.max(
      0,
      Math.min(1, foldScale * (theme.isLight ? 0.34 : 0.42))
    );
    ctx.fillStyle = createCssLinearGradient(ctx, w, h, 124, [
      [0, "rgba(0,0,0,0.44)"],
      [0.12, "rgba(255,255,255,0.22)"],
      [0.24, "rgba(0,0,0,0.34)"],
      [0.37, "rgba(255,255,255,0.14)"],
      [0.51, "rgba(0,0,0,0.26)"],
      [0.64, "rgba(255,255,255,0.2)"],
      [0.78, "rgba(0,0,0,0.36)"],
      [0.9, "rgba(255,255,255,0.16)"],
      [1, "rgba(0,0,0,0.42)"],
    ]);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    const mulAlpha = Math.max(
      0,
      Math.min(1, foldScale * (theme.isLight ? 0.26 : 0.36))
    );
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = mulAlpha;
    ctx.fillStyle = createCssLinearGradient(ctx, w, h, 38, [
      [0, "rgba(0,0,0,0.52)"],
      [0.18, "rgba(0,0,0,0)"],
      [0.34, "rgba(0,0,0,0.24)"],
      [0.54, "rgba(0,0,0,0)"],
      [0.72, "rgba(0,0,0,0.28)"],
      [0.86, "rgba(0,0,0,0)"],
      [1, "rgba(0,0,0,0.56)"],
    ]);
    ctx.fillRect(0, 0, w, h);

    fillEllipticalGradient(
      ctx,
      w,
      h,
      0.5,
      0,
      [
        [0, "rgba(0,0,0,0.34)"],
        [0.64, "rgba(0,0,0,0)"],
        [1, "rgba(0,0,0,0)"],
      ],
      w * 0.95,
      h * 0.42
    );
    fillEllipticalGradient(
      ctx,
      w,
      h,
      0.5,
      1,
      [
        [0, "rgba(0,0,0,0.42)"],
        [0.66, "rgba(0,0,0,0)"],
        [1, "rgba(0,0,0,0)"],
      ],
      w * 0.95,
      h * 0.42
    );
    ctx.restore();
  }

  // 5. Adjustable Deep Velvet Edge Vignette (baked into opaque static bitmap)
  if (vignetteScale > 0.01) {
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    if (theme.isLight) {
      const innerStop = Math.max(0.05, Math.min(0.95, Math.round(56 - vignetteScale * 18) / 100));
      fillEllipticalGradient(ctx, w, h, 0.5, 0.45, [
        [0, "rgba(86,62,32,0)"],
        [innerStop, "rgba(86,62,32,0)"],
        [1, `rgba(86,62,32,${(0.32 * vignetteScale).toFixed(3)})`],
      ]);
    } else {
      const innerStop = Math.max(0.05, Math.min(0.95, Math.round(56 - vignetteScale * 22) / 100));
      fillEllipticalGradient(ctx, w, h, 0.5, 0.45, [
        [0, "rgba(1,2,6,0)"],
        [innerStop, "rgba(1,2,6,0)"],
        [1, `rgba(1,2,6,${(0.84 * vignetteScale).toFixed(3)})`],
      ]);
    }
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}

function bakeStaticClothToCanvas(
  visibleCanvas: HTMLCanvasElement | null,
  offscreenRef: { current: HTMLCanvasElement | null },
  lastBakedDimRef: { current: { w: number; h: number } },
  params: StaticClothBakeParams,
  decodedTiles: DecodedTilePair | null
): boolean {
  if (!visibleCanvas || typeof window === "undefined") return false;

  const vw = Math.max(1, window.innerWidth);
  const vh = Math.max(1, window.innerHeight);
  const viewportScale = Math.min(1, MAX_BAKE_DIM / Math.max(vw, vh, 1));
  const bakeW = Math.max(1, Math.round(vw * viewportScale));
  const bakeH = Math.max(1, Math.round(vh * viewportScale));

  let offscreen = offscreenRef.current;
  if (!offscreen) {
    offscreen = document.createElement("canvas");
    offscreenRef.current = offscreen;
  }
  if (offscreen.width !== bakeW || offscreen.height !== bakeH) {
    offscreen.width = bakeW;
    offscreen.height = bakeH;
  }
  const offCtx = offscreen.getContext("2d", { alpha: false });
  if (!offCtx) return false;

  renderBakedStaticCloth(
    offCtx,
    bakeW,
    bakeH,
    viewportScale,
    params,
    decodedTiles
  );

  if (visibleCanvas.width !== bakeW || visibleCanvas.height !== bakeH) {
    visibleCanvas.width = bakeW;
    visibleCanvas.height = bakeH;
  }
  const visibleCtx = visibleCanvas.getContext("2d", { alpha: false });
  if (!visibleCtx) return false;

  visibleCtx.drawImage(offscreen, 0, 0);
  lastBakedDimRef.current = { w: bakeW, h: bakeH };
  return true;
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
    const subtleMax =
      style === "aurora"
        ? isCompact
          ? 6
          : 8
        : style === "ink-mist"
          ? isCompact
            ? 12
            : 18
          : style === "firefly"
            ? isCompact
              ? 14
              : 20
            : isCompact
              ? 16
              : 26;
    count = Math.max(4, Math.min(subtleMax, Math.round(count * 0.48)));
  } else {
    count = Math.max(0, Math.min(84, count));
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
  subtle,
}: {
  motif: ClothMotifId;
  accentColor: string;
  opacity: number;
  subtle: boolean;
}) {
  if (motif === "minimal" || opacity <= 0.005) return null;

  if (motif === "lunar-phases") {
    return (
      <svg
        viewBox="0 0 800 800"
        className={`h-[min(116vw,780px)] w-[min(116vw,780px)] ${
          subtle ? "" : "animate-[spin_240s_linear_infinite]"
        }`}
        style={{
          color: accentColor,
          opacity,
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
      className={`h-[min(118vw,780px)] w-[min(118vw,780px)] ${
        subtle ? "" : "animate-[spin_200s_linear_infinite]"
      }`}
      style={{
        color: accentColor,
        opacity,
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
  const staticClothCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenClothRef = useRef<HTMLCanvasElement | null>(null);
  const lastBakedDimRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sheenRef = useRef<HTMLDivElement | null>(null);
  const sheenPosRef = useRef<{ x: number; y: number } | null>(null);
  const [clothBakedReady, setClothBakedReady] = useState(false);

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
      : motifScale * (subtle ? 0.15 : theme.isLight ? 0.36 : 0.3);

  const bakeParamsRef = useRef<StaticClothBakeParams>({
    theme,
    material: detail.material,
    tileSize: materialMeta.tileSize,
    weaveOpacity,
    cloudOpacity,
    foldScale,
    vignetteScale,
  });

  // Bake static layers 1-4 + edge vignette into a single opaque 2D canvas (max 1280px, DPR=1)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params: StaticClothBakeParams = {
      theme,
      material: detail.material,
      tileSize: materialMeta.tileSize,
      weaveOpacity,
      cloudOpacity,
      foldScale,
      vignetteScale,
    };
    bakeParamsRef.current = params;

    let cancelled = false;
    const cachedTiles = getDecodedTilePairSync(detail.material, theme.isLight);
    if (cachedTiles) {
      if (
        bakeStaticClothToCanvas(
          staticClothCanvasRef.current,
          offscreenClothRef,
          lastBakedDimRef,
          params,
          cachedTiles
        )
      ) {
        setClothBakedReady(true);
      }
    } else {
      loadDecodedTilePair(detail.material, theme.isLight).then((decoded) => {
        if (cancelled) return;
        if (
          bakeStaticClothToCanvas(
            staticClothCanvasRef.current,
            offscreenClothRef,
            lastBakedDimRef,
            bakeParamsRef.current,
            decoded
          )
        ) {
          setClothBakedReady(true);
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [
    theme,
    detail.material,
    materialMeta.tileSize,
    weaveOpacity,
    cloudOpacity,
    foldScale,
    vignetteScale,
  ]);

  // Debounced resize re-bake for the static cloth canvas
  useEffect(() => {
    if (typeof window === "undefined") return;
    let resizeTimer: number | null = null;
    let disposed = false;

    const onResize = () => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null;
        if (disposed) return;

        const vw = Math.max(1, window.innerWidth);
        const vh = Math.max(1, window.innerHeight);
        const viewportScale = Math.min(1, MAX_BAKE_DIM / Math.max(vw, vh, 1));
        const nextW = Math.max(1, Math.round(vw * viewportScale));
        const nextH = Math.max(1, Math.round(vh * viewportScale));
        if (
          nextW === lastBakedDimRef.current.w &&
          nextH === lastBakedDimRef.current.h
        ) {
          return;
        }

        const current = bakeParamsRef.current;
        const cachedTiles = getDecodedTilePairSync(
          current.material,
          current.theme.isLight
        );
        if (cachedTiles) {
          if (
            bakeStaticClothToCanvas(
              staticClothCanvasRef.current,
              offscreenClothRef,
              lastBakedDimRef,
              current,
              cachedTiles
            )
          ) {
            setClothBakedReady(true);
          }
        } else {
          loadDecodedTilePair(current.material, current.theme.isLight).then(
            (decoded) => {
              if (
                disposed ||
                bakeParamsRef.current.material !== current.material ||
                bakeParamsRef.current.theme.isLight !== current.theme.isLight
              ) {
                return;
              }
              if (
                bakeStaticClothToCanvas(
                  staticClothCanvasRef.current,
                  offscreenClothRef,
                  lastBakedDimRef,
                  bakeParamsRef.current,
                  decoded
                )
              ) {
                setClothBakedReady(true);
              }
            }
          );
        }
      }, RESIZE_DEBOUNCE_MS);
    };

    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      disposed = true;
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Interactive grazing velvet/silk sheen via compositor-only translate3d (0 full-screen repaints)
  useEffect(() => {
    if (typeof window === "undefined" || !detail.interactiveSheen) return;
    const el = sheenRef.current;
    if (!el) return;

    let vw = Math.max(1, window.innerWidth);
    let vh = Math.max(1, window.innerHeight);

    const initialPos = sheenPosRef.current ?? { x: vw * 0.5, y: vh * 0.38 };
    let currentX = Math.max(vw * 0.08, Math.min(vw * 0.92, initialPos.x));
    let currentY = Math.max(vh * 0.08, Math.min(vh * 0.92, initialPos.y));
    let targetX = currentX;
    let targetY = currentY;
    let rafId: number | null = null;

    const applyTransform = () => {
      el.style.transform = `translate3d(${currentX.toFixed(1)}px, ${currentY.toFixed(1)}px, 0)`;
      sheenPosRef.current = { x: currentX, y: currentY };
    };
    applyTransform();

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reducedMotion) return;

    const tick = () => {
      currentX += (targetX - currentX) * 0.085;
      currentY += (targetY - currentY) * 0.085;

      if (
        Math.abs(targetX - currentX) > 0.5 ||
        Math.abs(targetY - currentY) > 0.5
      ) {
        applyTransform();
        rafId = window.requestAnimationFrame(tick);
      } else {
        currentX = targetX;
        currentY = targetY;
        applyTransform();
        rafId = null;
      }
    };

    const kick = () => {
      if (rafId === null) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (vw <= 0 || vh <= 0) return;
      targetX = Math.max(vw * 0.08, Math.min(vw * 0.92, e.clientX));
      targetY = Math.max(vh * 0.08, Math.min(vh * 0.92, e.clientY));
      kick();
    };

    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma === null && e.beta === null) return;
      const gx =
        typeof e.gamma === "number" ? Math.max(-45, Math.min(45, e.gamma)) : 0;
      const by =
        typeof e.beta === "number"
          ? Math.max(-35, Math.min(65, e.beta - 30))
          : 0;
      targetX = vw * (0.5 + (gx / 45) * 0.34);
      targetY = vh * (0.42 + (by / 50) * 0.3);
      kick();
    };

    const onResize = () => {
      const prevW = vw || 1;
      const prevH = vh || 1;
      vw = Math.max(1, window.innerWidth);
      vh = Math.max(1, window.innerHeight);
      currentX = (currentX / prevW) * vw;
      currentY = (currentY / prevH) * vh;
      targetX = (targetX / prevW) * vw;
      targetY = (targetY / prevH) * vh;
      applyTransform();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    if (gyroEnabled && window.isSecureContext) {
      window.addEventListener("deviceorientation", onOrientation, {
        passive: true,
      });
    }

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("deviceorientation", onOrientation);
    };
  }, [detail.interactiveSheen, gyroEnabled]);

  // Ambient dust / firefly / aurora particle canvas (pre-baked offscreen sprites + 30fps throttle)
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

    const sprites = createParticleSpriteSet(
      theme.particleStyle,
      theme.particleColor,
      theme.particleSecondary
    );
    if (!sprites) return;

    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );
    let reducedMotion = reducedMotionQuery.matches;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let particles: Particle[] = [];
    let rafId: number | null = null;
    let resizeTimer: number | null = null;
    let lastFrameTime = 0;

    const style = theme.particleStyle;
    const globalAlphaScale =
      (subtle ? 0.52 : 1) * (0.45 + particleScale * 0.65);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = subtle ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = createParticles(width, height, style, particleScale, subtle);
    };

    const drawFrame = (advance: boolean, dtScale: number) => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (advance) {
          p.phase += p.phaseSpeed * dtScale;
          const sway =
            style === "firefly" || style === "ink-mist"
              ? Math.sin(p.phase) * 0.24
              : Math.sin(p.phase) * 0.08;
          p.x += (p.vx + sway) * dtScale;
          p.y += p.vy * dtScale;

          const pad = p.size + 12;
          if (p.x < -pad) p.x = width + pad;
          if (p.x > width + pad) p.x = -pad;
          if (p.y < -pad) p.y = height + pad;
          if (p.y > height + pad) p.y = -pad;
        }

        const pulse = 0.55 + 0.45 * Math.sin(p.phase);
        const alpha = p.alpha * pulse * globalAlphaScale;
        if (alpha <= 0.004) continue;

        ctx.globalAlpha = alpha > 1 ? 1 : alpha;
        const sprite = p.secondary ? sprites.secondary : sprites.primary;

        if (style === "aurora") {
          const r = p.size;
          ctx.drawImage(sprite, p.x - r, p.y - r, r * 2, r * 2);
        } else if (style === "firefly") {
          const r = p.size * 4.5;
          ctx.drawImage(sprite, p.x - r, p.y - r, r * 2, r * 2);
        } else if (style === "ink-mist") {
          if (p.sparkle) {
            const dotSprite = p.secondary
              ? sprites.sparkleSecondary
              : sprites.sparklePrimary;
            if (dotSprite) {
              ctx.drawImage(dotSprite, p.x - 2.2, p.y - 2.2, 4.4, 4.4);
            }
          } else {
            const r = p.size;
            ctx.drawImage(sprite, p.x - r, p.y - r, r * 2, r * 2);
          }
        } else if (style === "linen-motes") {
          const r = p.size * 2.2;
          ctx.drawImage(sprite, p.x - r, p.y - r, r * 2, r * 2);
        } else {
          const r = p.size * 1.45;
          ctx.drawImage(sprite, p.x - r, p.y - r, r * 2, r * 2);

          if (p.sparkle && pulse > 0.72) {
            const sparkleSprite = p.secondary
              ? sprites.sparkleSecondary
              : sprites.sparklePrimary;
            if (sparkleSprite) {
              const arm = p.size * 4.2;
              ctx.drawImage(
                sparkleSprite,
                p.x - arm,
                p.y - arm,
                arm * 2,
                arm * 2
              );
            }
          }
        }
      }

      ctx.globalAlpha = 1;
    };

    const stopLoop = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      lastFrameTime = 0;
    };

    const startLoop = () => {
      if (rafId !== null || document.hidden || reducedMotion) return;
      const loop = (now: number) => {
        if (document.hidden || reducedMotion) {
          rafId = null;
          lastFrameTime = 0;
          return;
        }
        if (lastFrameTime === 0) {
          lastFrameTime = now;
          drawFrame(true, 1);
        } else {
          const elapsed = now - lastFrameTime;
          if (elapsed >= PARTICLE_FRAME_INTERVAL_MS) {
            lastFrameTime = now - (elapsed % PARTICLE_FRAME_INTERVAL_MS);
            const dtScale = Math.min(2.5, elapsed / 16.667);
            drawFrame(true, dtScale);
          }
        }
        rafId = window.requestAnimationFrame(loop);
      };
      rafId = window.requestAnimationFrame(loop);
    };

    const handleResize = () => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reducedMotion) drawFrame(false, 0);
      }, RESIZE_DEBOUNCE_MS);
    };

    const handleVisibility = () => {
      if (document.hidden) stopLoop();
      else startLoop();
    };

    const handleReducedMotion = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      if (reducedMotion) {
        stopLoop();
        drawFrame(false, 0);
      } else {
        startLoop();
      }
    };

    resize();
    if (reducedMotion) drawFrame(false, 0);
    else startLoop();

    window.addEventListener("resize", handleResize, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    reducedMotionQuery.addEventListener("change", handleReducedMotion);

    return () => {
      stopLoop();
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleResize);
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
      {/* 1. Zero-flash SSR Base Gradient fallback + Single Opaque Baked Static Cloth Canvas
          (Base Gradient + Weave hard-light + Nap Clouds hard-light + 3D Folds hard-light/multiply + Vignette) */}
      <div
        className="absolute inset-0"
        style={{
          background: clothGradient,
        }}
      />
      <canvas
        ref={staticClothCanvasRef}
        className="absolute inset-0 h-full w-full transition-opacity duration-300"
        style={{
          opacity: clothBakedReady ? 1 : 0,
        }}
      />

      {/* 2. Living Tabletop Ambient / Candlelight / Moonlight / Spotlight Pool */}
      <div
        className={`absolute -inset-6 transition-opacity duration-700 ${
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
          className="absolute inset-0 transition-opacity duration-700"
          style={{
            background: clothGlowBackground,
            opacity: subtle ? 0.35 : 0.62,
          }}
        />
      )}

      {/* 3. Interactive Grazing Nap Sheen (fixed radial disc moved via GPU translate3d — 0 full-screen repaints) */}
      {detail.interactiveSheen && (
        <div
          ref={sheenRef}
          className="pointer-events-none absolute -left-[40vmax] -top-[40vmax] h-[80vmax] w-[80vmax] transition-opacity duration-500 will-change-transform"
          style={{
            transform: "translate3d(50vw, 38vh, 0)",
            opacity: sheenOpacity,
            mixBlendMode: theme.isLight ? "soft-light" : "screen",
            background: theme.isLight
              ? "radial-gradient(circle, rgba(255,252,240,0.85) 0%, rgba(255,244,218,0.25) 42%, transparent 70%)"
              : `radial-gradient(circle, rgba(255,246,222,0.38) 0%, ${accentColor}26 36%, transparent 70%)`,
          }}
        />
      )}

      {/* 4. Gold-Thread Embroidered Altar Motif (pure SVG, no real-time drop-shadow filter) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <EmbroideredMotifSvg
          motif={detail.motif}
          accentColor={accentColor}
          opacity={motifFinalOpacity}
          subtle={subtle}
        />
      </div>

      {/* 5. Stitched Antique-Gold Altar Cloth Hem & 4 Corner Filigree Ornaments */}
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
                opacity: theme.isLight ? 0.58 : 0.48,
                transform: `rotate(${corner.rot}deg)`,
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

      {/* 6. 30fps Pre-Baked Sprite Ambient Particle Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
