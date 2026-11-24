"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { DeckId, TarotCard, ThemeId } from "@/types/tarot";
import { getCardImagePath, getDeckById } from "@/data/decks";
import { getThemeById } from "@/data/themes";
import { useCardTilt } from "@/lib/gyroscope";
import { soundEngine } from "@/lib/sound";
import { CardBackArtwork, MuchaFallbackFront } from "./CardBackArtwork";

export interface TarotCard3DFreeOrbit {
  rotateX: number;
  rotateY: number;
  isDragging?: boolean;
}

export interface TarotCard3DProps {
  card: TarotCard;
  deckId: DeckId;
  themeId?: ThemeId;
  flipped: boolean;
  reversed?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "hero";
  interactive?: boolean;
  tiltEnabled?: boolean;
  gyroEnabled?: boolean;
  soundEnabled?: boolean;
  slotLabel?: string;
  showCaption?: boolean;
  glowActive?: boolean;
  maxTilt?: number;
  freeOrbit?: TarotCard3DFreeOrbit;
  /** Tabletop mode aggressively trims hidden-face overlays & idle 3D edge slices */
  performanceMode?: "full" | "tabletop";
  /** Optional stagger delay (seconds) for batched 3D card flips */
  flipDelay?: number;
  onClick?: () => void;
  className?: string;
}

const CLASSIC_SIZE_CLASSES: Record<
  NonNullable<TarotCard3DProps["size"]>,
  string
> = {
  xs: "w-[72px] h-[124px]",
  sm: "w-[104px] h-[178px]",
  md: "w-[144px] h-[246px]",
  lg: "w-[188px] h-[322px]",
  hero: "w-[236px] h-[404px] sm:w-[264px] sm:h-[452px]",
};

// Matches native 848x1264 (~0.6709) Mucha Art Nouveau card proportions with zero horizontal crop
const ART_NOUVEAU_SIZE_CLASSES: Record<
  NonNullable<TarotCard3DProps["size"]>,
  string
> = {
  xs: "w-[82px] h-[122px]",
  sm: "w-[116px] h-[173px]",
  md: "w-[162px] h-[241px]",
  lg: "w-[212px] h-[316px]",
  hero: "w-[264px] h-[394px] sm:w-[296px] sm:h-[441px]",
};

const RADIUS_CLASSES: Record<NonNullable<TarotCard3DProps["size"]>, string> = {
  xs: "rounded-[7px]",
  sm: "rounded-[9px]",
  md: "rounded-[11px]",
  lg: "rounded-[13px]",
  hero: "rounded-[15px]",
};

// 6 crisp metallic slices forming a 350gsm gold-gilded card edge sandwiched between faces at ±2.2px
const EDGE_SLICES_Z = [-1.8, -1.1, -0.4, 0.4, 1.1, 1.8];

const FOIL_MASK_IMAGE =
  "linear-gradient(118deg, transparent 28%, rgba(0,0,0,0.45) 43%, rgba(0,0,0,1) 50%, rgba(0,0,0,0.45) 57%, transparent 72%)";

const STATIC_BACK_SPOTLIGHT =
  "radial-gradient(circle at 50% 50%, rgba(255,248,220,0.48) 0%, rgba(235,198,108,0.18) 14%, transparent 32%)";

const STATIC_FRONT_SPOTLIGHT =
  "radial-gradient(circle at 50% 50%, rgba(255,250,232,0.72) 0%, rgba(255,232,175,0.25) 15%, transparent 33%)";

const BROKEN_FRONT_THUMBS = new Set<string>();

let cachedLinenNoiseUri: string | null | undefined = undefined;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toCardThumbPath(imagePath: string): string {
  const lastSlash = imagePath.lastIndexOf("/");
  if (lastSlash === -1) return imagePath;
  return `${imagePath.slice(0, lastSlash)}/thumbs/${imagePath.slice(lastSlash + 1)}`;
}

/**
 * Generates a tiny 64x64 woven linen cardstock PNG data URL once on the client,
 * eliminating per-card SVG <feTurbulence> CPU filter rasterization.
 */
function createLinenNoiseUri(): string | null {
  if (typeof document === "undefined") return null;
  try {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;
    let seed = 0x9e3779b9;

    for (let y = 0; y < size; y++) {
      const rowWeave = (y & 1) === 0 ? 10 : -10;
      for (let x = 0; x < size; x++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const grain = (seed >>> 24) & 0xff;
        const colWeave = (x & 1) === 0 ? 14 : -14;
        const v = clamp(Math.round(grain * 0.72 + 36 + colWeave + rowWeave), 0, 255);
        const idx = (y * size + x) * 4;
        data[idx] = v;
        data[idx + 1] = v;
        data[idx + 2] = v;
        data[idx + 3] = 140;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return `url("${canvas.toDataURL("image/png")}")`;
  } catch {
    return null;
  }
}

function ClassicFallbackFront({ card }: { card: TarotCard }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-between bg-gradient-to-b from-[#1a1822] via-[#12101a] to-[#0b0a10] p-3 text-center text-[#f3e7cb]">
      <span className="font-serif text-[10px] tracking-[0.24em] text-[#d4af37]/80">
        {card.romanNumeral ?? String(card.number)}
      </span>
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d4af37]/45 bg-[#d4af37]/10 text-xs text-[#f2d680]">
          ✦
        </div>
        <p className="font-serif text-sm font-semibold tracking-wider text-[#f7ebd2]">
          {card.nameZh}
        </p>
        <p className="text-[9px] uppercase tracking-[0.18em] text-[#d4af37]/75">
          {card.nameEn}
        </p>
      </div>
      <span className="text-[9px] tracking-[0.15em] text-[#f3e7cb]/55">
        {card.element}
      </span>
    </div>
  );
}

export const TarotCard3D = memo(function TarotCard3D({
  card,
  deckId,
  themeId = "celestial-velvet",
  flipped,
  reversed = false,
  size = "md",
  interactive = true,
  tiltEnabled = true,
  gyroEnabled = false,
  soundEnabled = true,
  slotLabel,
  showCaption = false,
  glowActive = false,
  maxTilt = 14,
  freeOrbit,
  performanceMode = "full",
  flipDelay = 0,
  onClick,
  className = "",
}: TarotCard3DProps) {
  const theme = getThemeById(themeId);
  const deck = getDeckById(deckId);
  const fullImagePath = getCardImagePath(deckId, card.slug);

  const isFreeOrbit = freeOrbit !== undefined;
  const isCompactTabletop =
    !isFreeOrbit &&
    (performanceMode === "tabletop" || size === "xs" || size === "sm");
  const effectiveTiltEnabled = isFreeOrbit ? false : tiltEnabled;
  const effectiveGyroEnabled = isFreeOrbit ? false : gyroEnabled;
  const effectiveFlipDelay = isFreeOrbit ? 0 : Math.max(0, flipDelay);

  const preferThumb =
    !isFreeOrbit && (size === "xs" || size === "sm" || size === "md");
  const thumbImagePath =
    preferThumb && fullImagePath ? toCardThumbPath(fullImagePath) : null;

  const imgKey = `${deckId}:${card.slug}:${preferThumb ? 1 : 0}`;
  // 0 = primary (thumb when preferThumb, else full), 1 = full fallback, 2 = art fallback
  const [imgStageState, setImgStageState] = useState<{
    key: string;
    stage: 0 | 1 | 2;
  }>({ key: imgKey, stage: 0 });
  const imgStage = imgStageState.key === imgKey ? imgStageState.stage : 0;

  const useThumb =
    preferThumb &&
    Boolean(thumbImagePath) &&
    imgStage === 0 &&
    !BROKEN_FRONT_THUMBS.has(thumbImagePath!);
  const resolvedImageSrc =
    !fullImagePath || imgStage >= 2
      ? null
      : useThumb
        ? thumbImagePath
        : fullImagePath;

  const [linenTextureUri, setLinenTextureUri] = useState<string | null>(
    () => cachedLinenNoiseUri ?? null
  );
  const [flipSequence, setFlipSequence] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const prevFlippedRef = useRef(flipped);
  const soundEnabledRef = useRef(soundEnabled);
  const flipDelayRef = useRef(effectiveFlipDelay);

  // Hydrate cached 64x64 linen PNG texture once on the client (SSR-safe)
  useEffect(() => {
    if (cachedLinenNoiseUri === undefined) {
      cachedLinenNoiseUri = createLinenNoiseUri();
    }
    if (cachedLinenNoiseUri && linenTextureUri !== cachedLinenNoiseUri) {
      setLinenTextureUri(cachedLinenNoiseUri);
    }
  }, [linenTextureUri]);

  // Keep refs synchronized before the flip transition effect runs
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    flipDelayRef.current = effectiveFlipDelay;
  }, [soundEnabled, effectiveFlipDelay]);

  // Trigger weighted lift + edge-glint flash + staggered flip sound on flipped transitions
  useEffect(() => {
    if (isFreeOrbit) {
      prevFlippedRef.current = flipped;
      setIsFlipping(false);
      return undefined;
    }
    if (prevFlippedRef.current !== flipped) {
      prevFlippedRef.current = flipped;
      const delayMs = Math.round(Math.max(0, flipDelayRef.current) * 1000);
      setFlipSequence((seq) => seq + 1);
      setIsFlipping(true);

      let soundTimer: number | null = null;
      if (delayMs > 0) {
        soundTimer = window.setTimeout(() => {
          soundEngine.playCardFlip(soundEnabledRef.current);
        }, delayMs);
      } else {
        soundEngine.playCardFlip(soundEnabledRef.current);
      }

      const endTimer = window.setTimeout(() => {
        setIsFlipping(false);
      }, delayMs + 880);

      return () => {
        if (soundTimer !== null) {
          window.clearTimeout(soundTimer);
        }
        window.clearTimeout(endTimer);
      };
    }
    return undefined;
  }, [flipped, isFreeOrbit]);

  // Direct CSS-variable tilt driving (0 React re-renders during pointer/gyro tilt)
  const { handlers } = useCardTilt({
    enabled: effectiveTiltEnabled,
    maxTilt,
    gyroEnabled: effectiveGyroEnabled,
    targetRef: stageRef,
    ignoreTouch: isCompactTabletop,
  });

  const isArtNouveau = deck.frameStyle === "art-nouveau";
  const sizeClass = isArtNouveau
    ? ART_NOUVEAU_SIZE_CLASSES[size]
    : CLASSIC_SIZE_CLASSES[size];
  const radiusClass = RADIUS_CLASSES[size];
  const cardEdgeColor = theme.cardEdgeColor || "#c9a24b";
  const accentColor = theme.cssVars["--accent"] || "#d4af37";
  const accentStrong = theme.cssVars["--accent-strong"] || "#f2d98a";
  const foilGradient =
    theme.foilGradient ||
    "linear-gradient(125deg, transparent 22%, rgba(255,232,163,0.42) 48%, rgba(255,255,255,0.28) 52%, transparent 78%)";

  const edgeGradient = useMemo(
    () =>
      `linear-gradient(135deg, #fff1c2 0%, ${cardEdgeColor} 28%, #6d4f16 50%, #f8e29f 74%, ${cardEdgeColor} 100%)`,
    [cardEdgeColor]
  );

  // Static diagonal metallic foil band translated on GPU via --sheen-x (zero maskPosition repaint)
  const staticFoilSheenGradient = useMemo(
    () =>
      `linear-gradient(118deg, transparent 34%, ${cardEdgeColor}45 43%, ${accentStrong}80 49%, rgba(255,255,255,0.48) 51%, ${accentColor}40 57%, transparent 66%)`,
    [cardEdgeColor, accentStrong, accentColor]
  );

  const staticBoxShadow = useMemo(
    () =>
      glowActive
        ? `0 12px 26px 0px rgba(0,0,0,0.6), 0 0 26px 2px ${accentColor}52, 0 0 48px 5px ${accentColor}24`
        : isCompactTabletop
          ? "0 10px 18px 0px rgba(0,0,0,0.52)"
          : "0 12px 22px 0px rgba(0,0,0,0.56)",
    [glowActive, accentColor, isCompactTabletop]
  );

  // Free-orbit 360° optical math (preserved 100% for CardInspectorModal)
  const isOrbitDragging = Boolean(freeOrbit?.isDragging);
  const orbitRadX = isFreeOrbit ? (freeOrbit.rotateX * Math.PI) / 180 : 0;
  const orbitRadY = isFreeOrbit ? (freeOrbit.rotateY * Math.PI) / 180 : 0;
  const orbitSinX = isFreeOrbit ? Math.sin(orbitRadX) : 0;
  const orbitSinY = isFreeOrbit ? Math.sin(orbitRadY) : 0;
  const orbitCosYAbs = isFreeOrbit ? Math.abs(Math.cos(orbitRadY)) : 1;

  // Metallic gold edge glint (live in freeOrbit; flip-burst in standard mode)
  const edgeGlint = isFreeOrbit ? Math.pow(Math.abs(orbitSinY), 2.2) : 0;
  const edgeGlowStrength = isFreeOrbit ? edgeGlint : isFlipping ? 0.65 : 0;
  const edgeSpecularAlpha = Math.round(edgeGlowStrength * 0.78 * 100) / 100;
  const edgeRimGlowAlpha = Math.round(edgeGlowStrength * 0.56 * 100) / 100;
  const edgeBgShift = isFreeOrbit
    ? Math.round(50 + orbitSinX * 32 + orbitSinY * 22)
    : 50;

  // Free-orbit cast shadow & dual-face specular optics
  const orbitShadowOffsetX = isFreeOrbit
    ? Math.round(-Math.sin(2 * orbitRadY) * 14 * 10) / 10
    : 0;
  const orbitShadowOffsetY = isFreeOrbit
    ? Math.round((orbitSinX * 16 + (isOrbitDragging ? 24 : 12)) * 10) / 10
    : 10;
  const orbitShadowBlur = isFreeOrbit
    ? isOrbitDragging
      ? 38
      : 20 + Math.round((1 - orbitCosYAbs) * 10)
    : 18;
  const orbitShadowSpread = isFreeOrbit && isOrbitDragging ? 4 : 0;
  const orbitShadowScaleX = isFreeOrbit
    ? Math.round(
        (0.2 + orbitCosYAbs * 0.8) * (isOrbitDragging ? 1.03 : 0.96) * 1000
      ) / 1000
    : 0.96;
  const orbitShadowScaleY = isFreeOrbit ? (isOrbitDragging ? 1.04 : 0.96) : 0.96;
  const orbitShadowOpacity = isFreeOrbit
    ? isOrbitDragging
      ? 0.94
      : Math.round((0.58 + orbitCosYAbs * 0.28) * 100) / 100
    : 0.85;

  const orbitGlareY = isFreeOrbit
    ? Math.round(clamp(50 - orbitSinX * 44, 4, 96) * 100) / 100
    : 50;
  const orbitBackGlareX = isFreeOrbit
    ? Math.round(clamp(50 + orbitSinY * 46, 4, 96) * 100) / 100
    : 50;
  const orbitFrontGlareX = isFreeOrbit
    ? Math.round(clamp(50 - orbitSinY * 46, 4, 96) * 100) / 100
    : 50;

  const orbitBackSheenShiftPct = isFreeOrbit
    ? Math.round(
        clamp((orbitBackGlareX * 0.68 + orbitGlareY * 0.32) * 1.32 - 16, 0, 100)
      )
    : 50;
  const orbitFrontSheenShiftPct = isFreeOrbit
    ? Math.round(
        clamp((orbitFrontGlareX * 0.68 + orbitGlareY * 0.32) * 1.32 - 16, 0, 100)
      )
    : 50;

  const orbitAngleEnergy = isFreeOrbit
    ? Math.min(1, Math.abs(orbitSinY) * 1.15 + Math.abs(orbitSinX) * 0.9)
    : 0;
  const orbitFaceAttenuation = isFreeOrbit ? 0.35 + 0.65 * orbitCosYAbs : 1;

  const orbitSheenOpacity = isFreeOrbit
    ? Math.round(
        (0.14 + orbitAngleEnergy * 0.36 + (isOrbitDragging ? 0.08 : 0)) *
          orbitFaceAttenuation *
          1000
      ) / 1000
    : 0.08;
  const orbitSpotlightOpacity = isFreeOrbit
    ? Math.round(
        (0.14 + orbitAngleEnergy * 0.38 + (isOrbitDragging ? 0.08 : 0)) *
          orbitFaceAttenuation *
          1000
      ) / 1000
    : 0.1;

  // Compact tabletop GPU compositor trimming
  const renderEdgeSlices = isFreeOrbit || !isCompactTabletop || isFlipping;
  const renderBackOverlays =
    isFreeOrbit || !isCompactTabletop || isFlipping || !flipped;
  const renderFrontOverlays =
    isFreeOrbit || !isCompactTabletop || isFlipping || flipped;
  const useLightweightBack = !isFreeOrbit && size !== "hero";

  const showMuchaFallback = deckId === "mucha-hamster" && !resolvedImageSrc;
  const showClassicFallback = deckId !== "mucha-hamster" && !resolvedImageSrc;

  const isClickable = Boolean(onClick) || (interactive && !isFreeOrbit);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  const handleFrontImgError = () => {
    if (useThumb && thumbImagePath) {
      BROKEN_FRONT_THUMBS.add(thumbImagePath);
      setImgStageState({ key: imgKey, stage: 1 });
    } else {
      setImgStageState({ key: imgKey, stage: 2 });
    }
  };

  const stdBackSpotlightOpacity = isFlipping
    ? "0.46"
    : `calc(${effectiveGyroEnabled ? 0.2 : 0.08} + var(--tilt-active, 0) * ${
        effectiveGyroEnabled ? 0.32 : 0.42
      })`;
  const stdFrontSpotlightOpacity = isFlipping
    ? "0.62"
    : `calc(${effectiveGyroEnabled ? 0.34 : 0.2} + var(--tilt-active, 0) * ${
        effectiveGyroEnabled ? 0.34 : 0.46
      })`;
  const stdSheenOpacity = isFlipping
    ? "0.52"
    : `calc(${effectiveGyroEnabled ? 0.18 : 0.08} + var(--tilt-active, 0) * ${
        effectiveGyroEnabled ? 0.28 : 0.34
      })`;

  const cardSlabFaces = (
    <>
      {/* Simulated 350gsm Stacked Metallic Gilded Gold Card Edge Slices (6 slices) */}
      {renderEdgeSlices
        ? EDGE_SLICES_Z.map((zPx, idx) => {
            const isOuterSlice = idx === 0 || idx === EDGE_SLICES_Z.length - 1;
            return (
              <div
                key={idx}
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 ${radiusClass}`}
                style={{
                  transform: `translateZ(${zPx}px)`,
                  backgroundImage:
                    edgeGlowStrength > 0.04
                      ? `linear-gradient(155deg, rgba(255,250,224,${edgeSpecularAlpha}) 0%, rgba(255,232,158,${(
                          edgeSpecularAlpha * 0.55
                        ).toFixed(2)}) 38%, transparent 72%), ${edgeGradient}`
                      : edgeGradient,
                  backgroundSize: "180% 180%",
                  backgroundPosition: `${edgeBgShift}% ${100 - edgeBgShift}%`,
                  border: `1px solid ${cardEdgeColor}`,
                  boxShadow:
                    edgeGlowStrength > 0.06
                      ? isOuterSlice
                        ? `0 0 ${Math.round(
                            4 + edgeGlowStrength * 12
                          )}px rgba(255,232,160,${edgeRimGlowAlpha}), inset 0 0 2px rgba(255,250,226,${Math.min(
                            0.95,
                            0.45 + edgeGlowStrength * 0.5
                          ).toFixed(2)})`
                        : `inset 0 0 1.5px rgba(255,244,200,${(
                            edgeGlowStrength * 0.75
                          ).toFixed(2)})`
                      : isOuterSlice
                        ? "inset 0 0 1px rgba(255,248,220,0.85)"
                        : undefined,
                }}
              />
            );
          })
        : null}

      {/* ================= BACK FACE (visible at rotateY = 0° / 360°) ================= */}
      <div
        className={`absolute inset-0 overflow-hidden ${radiusClass}`}
        style={{
          transform: "rotateY(0deg) translateZ(2.2px)",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          border: `1px solid ${cardEdgeColor}cc`,
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.26), inset 0 -1px 2px rgba(0,0,0,0.55)",
        }}
      >
        <CardBackArtwork
          deckId={deckId}
          themeId={themeId}
          lightweight={useLightweightBack}
        />

        {renderBackOverlays ? (
          <>
            {/* Woven linen cardstock micro-texture (cached 64x64 PNG, zero SVG filter) */}
            {linenTextureUri ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
                style={{
                  backgroundImage: linenTextureUri,
                  backgroundRepeat: "repeat",
                  backgroundSize: "64px 64px",
                }}
              />
            ) : null}

            {isFreeOrbit ? (
              <>
                {/* Layer 1: Radial candlelight specular spotlight (360° free-orbit) */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 mix-blend-screen"
                  style={{
                    opacity: orbitSpotlightOpacity,
                    background: `radial-gradient(circle at ${orbitBackGlareX}% ${orbitGlareY}%, rgba(255,248,220,0.48) 0%, rgba(235,198,108,0.18) 28%, transparent 64%)`,
                  }}
                />

                {/* Layer 2: Diagonal metallic gold-foil sheen band (360° free-orbit) */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 mix-blend-color-dodge"
                  style={{
                    opacity: orbitSheenOpacity,
                    backgroundImage: foilGradient,
                    maskImage: FOIL_MASK_IMAGE,
                    WebkitMaskImage: FOIL_MASK_IMAGE,
                    maskSize: "260% 260%",
                    WebkitMaskSize: "260% 260%",
                    maskPosition: `${orbitBackSheenShiftPct}% ${orbitBackSheenShiftPct}%`,
                    WebkitMaskPosition: `${orbitBackSheenShiftPct}% ${orbitBackSheenShiftPct}%`,
                  }}
                />
              </>
            ) : (
              <>
                {/* Layer 1: Static radial spotlight translated purely on GPU via CSS vars */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-1/2 mix-blend-screen"
                  style={{
                    opacity: stdBackSpotlightOpacity,
                    background: STATIC_BACK_SPOTLIGHT,
                    transform:
                      "translate3d(calc(var(--glare-x, 50%) * 0.5 - 25%), calc(var(--glare-y, 50%) * 0.5 - 25%), 0)",
                  }}
                />

                {/* Layer 2: Static diagonal gold-foil sheen translated purely on GPU */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-[60%] mix-blend-color-dodge"
                  style={{
                    opacity: stdSheenOpacity,
                    backgroundImage: staticFoilSheenGradient,
                    transform:
                      "translate3d(var(--sheen-x, 0%), var(--sheen-x, 0%), 0)",
                  }}
                />
              </>
            )}
          </>
        ) : null}

        {/* Mid-flip golden edge-glint flash */}
        {!isFreeOrbit && isFlipping ? (
          <motion.div
            key={`glint-back-${flipSequence}`}
            aria-hidden="true"
            initial={{ opacity: 0, x: "-115%" }}
            animate={{ opacity: [0, 0.85, 0], x: ["-115%", "25%", "135%"] }}
            transition={{
              duration: 0.72,
              delay: effectiveFlipDelay,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(110deg, transparent 20%, rgba(255,244,198,0.68) 48%, rgba(255,255,255,0.75) 52%, transparent 76%)",
              mixBlendMode: "screen",
            }}
          />
        ) : null}
      </div>

      {/* ================= FRONT FACE (visible at rotateY = 180°) ================= */}
      <div
        className={`absolute inset-0 overflow-hidden ${radiusClass} ${
          isArtNouveau ? "bg-[#f5edd9]" : "bg-[#11121c]"
        }`}
        style={{
          transform: "rotateY(180deg) translateZ(2.2px)",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          border: `1.25px solid ${cardEdgeColor}d9`,
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.32), inset 0 -1px 2px rgba(0,0,0,0.48)",
        }}
      >
        {/* Artwork layer — rotates 180deg cleanly when reversed (always mounted for preloading) */}
        <div
          className="relative h-full w-full transition-transform duration-500 ease-out"
          style={{
            transform: reversed ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          {showMuchaFallback ? (
            <MuchaFallbackFront card={card} />
          ) : showClassicFallback ? (
            <ClassicFallbackFront card={card} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolvedImageSrc ?? ""}
              alt={`${card.nameZh} ${card.nameEn}`}
              loading={isFreeOrbit || size === "hero" ? "eager" : "lazy"}
              decoding="async"
              draggable={false}
              onError={handleFrontImgError}
              className="pointer-events-none h-full w-full select-none object-cover"
            />
          )}
        </div>

        {/* Deck-specific ornate gilded hairline inner bezel + micro bevel */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute ${
            isArtNouveau && !showMuchaFallback ? "inset-[1px]" : "inset-[3px]"
          } ${radiusClass}`}
          style={{
            border: isArtNouveau
              ? "1px solid rgba(196,154,72,0.42)"
              : "1px solid rgba(212,175,55,0.48)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.24), inset 0 0 8px rgba(0,0,0,0.18)",
          }}
        />

        {/* Subtle corner gilded accents for classic cards (Art Nouveau deck already carries hand-drawn floral corners) */}
        {size !== "xs" && !isArtNouveau ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-[6px] opacity-65"
          >
            <span
              className="absolute left-0 top-0 h-2.5 w-2.5 border-l border-t"
              style={{ borderColor: cardEdgeColor }}
            />
            <span
              className="absolute right-0 top-0 h-2.5 w-2.5 border-r border-t"
              style={{ borderColor: cardEdgeColor }}
            />
            <span
              className="absolute bottom-0 left-0 h-2.5 w-2.5 border-b border-l"
              style={{ borderColor: cardEdgeColor }}
            />
            <span
              className="absolute bottom-0 right-0 h-2.5 w-2.5 border-b border-r"
              style={{ borderColor: cardEdgeColor }}
            />
          </div>
        ) : null}

        {renderFrontOverlays ? (
          <>
            {/* Woven linen cardstock micro-texture overlay (cached 64x64 PNG) */}
            {linenTextureUri ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
                style={{
                  backgroundImage: linenTextureUri,
                  backgroundRepeat: "repeat",
                  backgroundSize: "64px 64px",
                }}
              />
            ) : null}

            {isFreeOrbit ? (
              <>
                {/* Layer 1: Radial candlelight spotlight (360° free-orbit) */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 mix-blend-soft-light"
                  style={{
                    opacity: orbitSpotlightOpacity + 0.16,
                    background: `radial-gradient(circle at ${orbitFrontGlareX}% ${orbitGlareY}%, rgba(255,250,232,0.72) 0%, rgba(255,232,175,0.25) 30%, transparent 66%)`,
                  }}
                />

                {/* Layer 2: Diagonal metallic gold-foil band (360° free-orbit) */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 mix-blend-screen"
                  style={{
                    opacity: orbitSheenOpacity,
                    backgroundImage: foilGradient,
                    maskImage: FOIL_MASK_IMAGE,
                    WebkitMaskImage: FOIL_MASK_IMAGE,
                    maskSize: "260% 260%",
                    WebkitMaskSize: "260% 260%",
                    maskPosition: `${orbitFrontSheenShiftPct}% ${orbitFrontSheenShiftPct}%`,
                    WebkitMaskPosition: `${orbitFrontSheenShiftPct}% ${orbitFrontSheenShiftPct}%`,
                  }}
                />
              </>
            ) : (
              <>
                {/* Layer 1: Static radial spotlight translated purely on GPU via CSS vars */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-1/2 mix-blend-soft-light"
                  style={{
                    opacity: stdFrontSpotlightOpacity,
                    background: STATIC_FRONT_SPOTLIGHT,
                    transform:
                      "translate3d(calc(var(--glare-x, 50%) * 0.5 - 25%), calc(var(--glare-y, 50%) * 0.5 - 25%), 0)",
                  }}
                />

                {/* Layer 2: Static diagonal gold-foil band translated purely on GPU */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-[60%] mix-blend-screen"
                  style={{
                    opacity: stdSheenOpacity,
                    backgroundImage: staticFoilSheenGradient,
                    transform:
                      "translate3d(var(--sheen-x, 0%), var(--sheen-x, 0%), 0)",
                  }}
                />
              </>
            )}
          </>
        ) : null}

        {/* Edge-glint flash blooming right across the freshly revealed card face */}
        {!isFreeOrbit && isFlipping ? (
          <motion.div
            key={`glint-front-${flipSequence}`}
            aria-hidden="true"
            initial={{ opacity: 0, x: "-120%" }}
            animate={{ opacity: [0, 0.9, 0], x: ["-120%", "15%", "140%"] }}
            transition={{
              duration: 0.78,
              delay: effectiveFlipDelay + 0.12,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(115deg, transparent 22%, rgba(255,244,200,0.72) 48%, rgba(255,255,255,0.82) 52%, transparent 76%)",
              mixBlendMode: "screen",
            }}
          />
        ) : null}

        {/* Crisp upright orientation badge when reversed (no backdrop-blur for WebKit 3D batching) */}
        {reversed && size !== "xs" ? (
          <div className="pointer-events-none absolute right-1.5 top-1.5 z-10">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wider shadow-sm ${
                theme.isLight
                  ? "border-[#9e6f2c]/55 bg-[#fbf6ea]/92 text-[#7d5218]"
                  : "border-[#d4af37]/55 bg-[#0b0d18]/90 text-[#f3d98a]"
              }`}
            >
              逆位
            </span>
          </div>
        ) : null}
      </div>
    </>
  );

  return (
    <div
      className={`inline-flex flex-col items-center select-none ${className}`}
    >
      {/* Optional Slot Label above card (high-contrast translucent fill, no backdrop-blur) */}
      {slotLabel ? (
        <span
          className={`mb-1.5 max-w-[140px] truncate rounded-full border px-2.5 py-0.5 text-[10px] font-medium tracking-[0.14em] ${
            theme.isLight ? "bg-[#fbf6ea]/92" : "bg-[#0b0d18]/90"
          }`}
          style={{
            borderColor: "var(--border-accent, rgba(212,175,55,0.35))",
            color: "var(--accent-strong, #f2d98a)",
          }}
        >
          {slotLabel}
        </span>
      ) : null}

      {/* 3D Perspective Stage */}
      <div
        ref={stageRef}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={
          flipped
            ? `${card.nameZh} (${card.nameEn}) ${reversed ? "逆位" : "正位"}`
            : `${slotLabel ? `${slotLabel} · ` : ""}未翻开的塔罗牌`
        }
        onClick={onClick}
        onKeyDown={handleKeyDown}
        onPointerEnter={effectiveTiltEnabled ? handlers.onPointerEnter : undefined}
        onPointerMove={effectiveTiltEnabled ? handlers.onPointerMove : undefined}
        onPointerLeave={effectiveTiltEnabled ? handlers.onPointerLeave : undefined}
        onPointerCancel={effectiveTiltEnabled ? handlers.onPointerCancel : undefined}
        className={`relative ${sizeClass} ${isClickable ? "cursor-pointer" : ""} outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]/70 ${radiusClass}`}
        style={{
          perspective: "1400px",
          touchAction: isFreeOrbit ? "none" : maxTilt >= 18 ? "none" : "pan-y",
          WebkitTapHighlightColor: "transparent",
          WebkitTouchCallout: "none",
        }}
      >
        {/* Dynamic Cast Shadow + Living Candlelight Aura (static box-shadow in standard mode) */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-1 ${radiusClass} ${
            isFreeOrbit ? "" : "transition-opacity duration-500"
          }`}
          style={
            isFreeOrbit
              ? {
                  transform: `translate3d(${orbitShadowOffsetX}px, ${orbitShadowOffsetY}px, 0) scale(${orbitShadowScaleX}, ${orbitShadowScaleY})`,
                  boxShadow: glowActive
                    ? `0 ${orbitShadowOffsetY}px ${orbitShadowBlur}px ${orbitShadowSpread}px rgba(0,0,0,0.62), 0 0 28px 3px ${accentColor}55, 0 0 56px 6px ${accentColor}26`
                    : `0 ${Math.max(6, orbitShadowOffsetY * 0.6)}px ${orbitShadowBlur}px ${orbitShadowSpread}px rgba(0,0,0,0.58)`,
                  opacity: orbitShadowOpacity,
                  willChange: "transform",
                }
              : {
                  transform: `translate3d(var(--shadow-x, 0px), calc(var(--shadow-y, 0px) + ${
                    isFlipping ? 20 : 10
                  }px), 0) scale(${isFlipping ? 1.04 : 0.96})`,
                  boxShadow: staticBoxShadow,
                  opacity: isFlipping ? 0.95 : 0.85,
                  willChange: isFlipping ? "transform" : undefined,
                }
          }
        />

        {isFreeOrbit ? (
          /* Free 360° Orbit Mode: tactile grab lift + zero-lag direct 60fps 3D transform */
          <div
            className="relative h-full w-full"
            style={{
              transform: `translate3d(0, ${isOrbitDragging ? -7 : 0}px, ${
                isOrbitDragging ? 14 : 0
              }px) scale(${isOrbitDragging ? 1.025 : 1})`,
              transition: "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)",
              transformStyle: "preserve-3d",
              willChange: "transform",
            }}
          >
            <div
              className="relative h-full w-full"
              style={{
                transform: `rotateX(${freeOrbit.rotateX}deg) rotateY(${freeOrbit.rotateY}deg)`,
                transformStyle: "preserve-3d",
                willChange: "transform",
              }}
            >
              {cardSlabFaces}
            </div>
          </div>
        ) : (
          /* Standard / Tabletop Mode: Level 1 CSS-Var Tilt Wrapper + Level 2 Weighted 3D Flip Body */
          <div
            className="relative h-full w-full"
            style={{
              transform: "rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))",
              transformStyle: "preserve-3d",
              willChange: isFlipping ? "transform" : undefined,
            }}
          >
            <motion.div
              key={`card-body-${card.id}`}
              initial={false}
              animate={{
                rotateY: flipped ? 180 : 0,
                scale: flipSequence > 0 && isFlipping ? [1, 1.06, 1] : 1,
                y: flipSequence > 0 && isFlipping ? [0, -14, 0] : 0,
              }}
              transition={{
                rotateY: {
                  duration: 0.85,
                  delay: effectiveFlipDelay,
                  ease: [0.22, 1, 0.36, 1],
                },
                scale: {
                  duration: 0.85,
                  delay: effectiveFlipDelay,
                  times: [0, 0.45, 1],
                  ease: [0.22, 1, 0.36, 1],
                },
                y: {
                  duration: 0.85,
                  delay: effectiveFlipDelay,
                  times: [0, 0.45, 1],
                  ease: [0.22, 1, 0.36, 1],
                },
              }}
              className="relative h-full w-full"
              style={{
                transformStyle: "preserve-3d",
                willChange: isFlipping ? "transform" : undefined,
              }}
            >
              {cardSlabFaces}
            </motion.div>
          </div>
        )}
      </div>

      {/* Optional Card Name & Orientation Caption */}
      {showCaption ? (
        <div className="mt-2 flex max-w-[180px] flex-col items-center gap-0.5 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <span
              className="truncate font-serif text-xs font-semibold tracking-wider sm:text-sm"
              style={{ color: "var(--text-primary, #f3e7cb)" }}
            >
              {flipped ? card.nameZh : "静待揭晓"}
            </span>
            {flipped ? (
              <span
                className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-medium tracking-wider ${
                  reversed
                    ? theme.isLight
                      ? "border-amber-700/35 bg-amber-600/12 text-amber-800"
                      : "border-amber-400/45 bg-amber-500/15 text-amber-200"
                    : theme.isLight
                      ? "border-emerald-700/30 bg-emerald-600/10 text-emerald-800"
                      : "border-emerald-400/35 bg-emerald-500/15 text-emerald-200"
                }`}
              >
                {reversed ? "逆位" : "正位"}
              </span>
            ) : null}
          </div>
          {flipped && size !== "xs" ? (
            <span
              className="truncate text-[10px] tracking-[0.12em] opacity-70"
              style={{ color: "var(--text-secondary, #cbbca0)" }}
            >
              {card.nameEn}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
