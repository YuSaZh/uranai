"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { DeckId, TarotCard, ThemeId } from "@/types/tarot";
import { getCardImagePath, getDeckById } from "@/data/decks";
import { getThemeById } from "@/data/themes";
import { useCardTilt } from "@/lib/gyroscope";
import { soundEngine } from "@/lib/sound";
import { CardBackArtwork, MuchaFallbackFront } from "./CardBackArtwork";

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

// Lightweight woven linen cardstock micro-texture data URI
const LINEN_TEXTURE_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

const EDGE_SLICES_Z = [1.4, 0.5, -0.5, -1.4];

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

export function TarotCard3D({
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
  onClick,
  className = "",
}: TarotCard3DProps) {
  const theme = getThemeById(themeId);
  const deck = getDeckById(deckId);
  const imagePath = getCardImagePath(deckId, card.slug);

  const [imgError, setImgError] = useState(false);
  const [flipSequence, setFlipSequence] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const prevFlippedRef = useRef(flipped);

  // Reset image error state if deck or card switches
  useEffect(() => {
    setImgError(false);
  }, [deckId, card.slug]);

  // Trigger weighted lift + edge-glint flash + flip sound on flipped transitions
  useEffect(() => {
    if (prevFlippedRef.current !== flipped) {
      prevFlippedRef.current = flipped;
      setFlipSequence((seq) => seq + 1);
      setIsFlipping(true);
      soundEngine.playCardFlip(soundEnabled);

      const timer = window.setTimeout(() => {
        setIsFlipping(false);
      }, 860);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [flipped, soundEnabled]);

  const { ref, tiltX, tiltY, glareX, glareY, isInteracting, handlers } = useCardTilt({
    enabled: tiltEnabled,
    maxTilt,
    gyroEnabled,
  });

  const isArtNouveau = deck.frameStyle === "art-nouveau";
  const sizeClass = isArtNouveau
    ? ART_NOUVEAU_SIZE_CLASSES[size]
    : CLASSIC_SIZE_CLASSES[size];
  const radiusClass = RADIUS_CLASSES[size];
  const cardEdgeColor = theme.cardEdgeColor || "#c9a24b";
  const accentColor = theme.cssVars["--accent"] || "#d4af37";
  const foilGradient =
    theme.foilGradient ||
    "linear-gradient(125deg, transparent 22%, rgba(255,232,163,0.42) 48%, rgba(255,255,255,0.28) 52%, transparent 78%)";

  const edgeGradient = useMemo(
    () =>
      `linear-gradient(135deg, #fff1c2 0%, ${cardEdgeColor} 28%, #6d4f16 50%, #f8e29f 74%, ${cardEdgeColor} 100%)`,
    [cardEdgeColor]
  );

  // Dynamic cast shadow shifts opposite to card tilt and deepens mid-flip
  const shadowOffsetX = Math.round(-tiltY * 1.45 * 10) / 10;
  const shadowOffsetY = Math.round((tiltX * 1.15 + (isFlipping ? 22 : 10)) * 10) / 10;
  const shadowBlur = isFlipping ? 34 : isInteracting ? 26 : 18;
  const shadowSpread = isFlipping ? 4 : 0;

  // Foil sheen band mask sweeps diagonally across the card face with tilt/glare
  const sheenShiftPct = Math.round(((glareX + glareY) * 0.5) * 1.4 - 20);
  const foilMaskImage =
    "linear-gradient(118deg, transparent 28%, rgba(0,0,0,0.45) 43%, rgba(0,0,0,1) 50%, rgba(0,0,0,0.45) 57%, transparent 72%)";
  const activeSheenOpacity = isFlipping ? 0.52 : isInteracting ? 0.42 : gyroEnabled ? 0.24 : 0.08;
  const activeSpotlightOpacity = isFlipping ? 0.46 : isInteracting ? 0.52 : gyroEnabled ? 0.26 : 0.1;

  const showMuchaFallback = deckId === "mucha-hamster" && (!imagePath || imgError);
  const showClassicFallback = deckId !== "mucha-hamster" && (!imagePath || imgError);

  const isClickable = Boolean(onClick) || interactive;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={`inline-flex flex-col items-center select-none ${className}`}
    >
      {/* Optional Slot Label above card */}
      {slotLabel ? (
        <span
          className="mb-1.5 max-w-[140px] truncate rounded-full border px-2.5 py-0.5 text-[10px] font-medium tracking-[0.14em] backdrop-blur-sm"
          style={{
            borderColor: "var(--border-accent, rgba(212,175,55,0.35))",
            backgroundColor: "var(--bg-glass, rgba(12,15,28,0.68))",
            color: "var(--accent-strong, #f2d98a)",
          }}
        >
          {slotLabel}
        </span>
      ) : null}

      {/* 3D Perspective Stage */}
      <div
        ref={ref}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={
          flipped
            ? `${card.nameZh} (${card.nameEn}) ${reversed ? "逆位" : "正位"}`
            : `${slotLabel ? `${slotLabel} · ` : ""}未翻开的塔罗牌`
        }
        onClick={onClick}
        onKeyDown={handleKeyDown}
        onPointerEnter={tiltEnabled ? handlers.onPointerEnter : undefined}
        onPointerMove={tiltEnabled ? handlers.onPointerMove : undefined}
        onPointerLeave={tiltEnabled ? handlers.onPointerLeave : undefined}
        onTouchMove={tiltEnabled ? handlers.onTouchMove : undefined}
        onTouchEnd={tiltEnabled ? handlers.onTouchEnd : undefined}
        className={`relative ${sizeClass} ${isClickable ? "cursor-pointer" : ""} outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]/70 ${radiusClass}`}
        style={{
          perspective: "1400px",
          touchAction: maxTilt >= 18 ? "none" : "pan-y",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {/* Dynamic Cast Shadow + Living Candlelight Aura */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-1 ${radiusClass} transition-opacity duration-500`}
          style={{
            transform: `translate3d(${shadowOffsetX}px, ${shadowOffsetY}px, 0) scale(${
              isFlipping ? 1.04 : 0.96
            })`,
            boxShadow: glowActive
              ? `0 ${shadowOffsetY}px ${shadowBlur}px ${shadowSpread}px rgba(0,0,0,0.62), 0 0 28px 3px ${accentColor}55, 0 0 56px 6px ${accentColor}26`
              : `0 ${Math.max(6, shadowOffsetY * 0.6)}px ${shadowBlur}px ${shadowSpread}px rgba(0,0,0,0.58)`,
            opacity: isFlipping ? 0.95 : 0.85,
            willChange: "transform, box-shadow",
          }}
        />

        {/* Level 1: Smooth Tilt Wrapper */}
        <div
          className="relative h-full w-full"
          style={{
            transform: `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`,
            transformStyle: "preserve-3d",
            willChange: "transform",
          }}
        >
          {/* Level 2: Weighted 3D Flip Body */}
          <motion.div
            key={`card-body-${card.id}`}
            initial={false}
            animate={{
              rotateY: flipped ? 180 : 0,
              scale: flipSequence > 0 && isFlipping ? [1, 1.06, 1] : 1,
              y: flipSequence > 0 && isFlipping ? [0, -14, 0] : 0,
            }}
            transition={{
              rotateY: { duration: 0.85, ease: [0.22, 1, 0.36, 1] },
              scale: { duration: 0.85, times: [0, 0.45, 1], ease: [0.22, 1, 0.36, 1] },
              y: { duration: 0.85, times: [0, 0.45, 1], ease: [0.22, 1, 0.36, 1] },
            }}
            className="relative h-full w-full"
            style={{
              transformStyle: "preserve-3d",
              willChange: "transform",
            }}
          >
            {/* Simulated 350gsm Stacked Metallic Gilded Gold Card Edge Slices */}
            {EDGE_SLICES_Z.map((zPx, idx) => (
              <div
                key={idx}
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 ${radiusClass}`}
                style={{
                  transform: `translateZ(${zPx}px)`,
                  background: edgeGradient,
                  border: `1px solid ${cardEdgeColor}`,
                  boxShadow:
                    idx === 0 || idx === EDGE_SLICES_Z.length - 1
                      ? `inset 0 0 1px rgba(255,248,220,0.85)`
                      : undefined,
                }}
              />
            ))}

            {/* ================= BACK FACE ================= */}
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
              <CardBackArtwork deckId={deckId} themeId={themeId} />

              {/* Woven linen cardstock micro-texture */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
                style={{ backgroundImage: LINEN_TEXTURE_URI }}
              />

              {/* Layer 1: Radial candlelight specular spotlight */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 mix-blend-screen transition-opacity duration-300"
                style={{
                  opacity: activeSpotlightOpacity,
                  background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,248,220,0.44) 0%, rgba(235,198,108,0.16) 28%, transparent 64%)`,
                }}
              />

              {/* Layer 2: Diagonal metallic gold-foil sheen band */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 mix-blend-color-dodge transition-opacity duration-300"
                style={{
                  opacity: activeSheenOpacity,
                  backgroundImage: foilGradient,
                  maskImage: foilMaskImage,
                  WebkitMaskImage: foilMaskImage,
                  maskSize: "260% 260%",
                  WebkitMaskSize: "260% 260%",
                  maskPosition: `${sheenShiftPct}% ${sheenShiftPct}%`,
                  WebkitMaskPosition: `${sheenShiftPct}% ${sheenShiftPct}%`,
                }}
              />

              {/* Mid-flip golden edge-glint flash */}
              {isFlipping ? (
                <motion.div
                  aria-hidden="true"
                  initial={{ opacity: 0, x: "-115%" }}
                  animate={{ opacity: [0, 0.85, 0], x: ["-115%", "25%", "135%"] }}
                  transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(110deg, transparent 20%, rgba(255,244,198,0.68) 48%, rgba(255,255,255,0.75) 52%, transparent 76%)",
                    mixBlendMode: "screen",
                  }}
                />
              ) : null}
            </div>

            {/* ================= FRONT FACE ================= */}
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
              {/* Artwork layer — rotates 180deg cleanly when reversed */}
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
                    src={imagePath ?? ""}
                    alt={`${card.nameZh} ${card.nameEn}`}
                    loading="lazy"
                    draggable={false}
                    onError={() => setImgError(true)}
                    className="h-full w-full select-none object-cover"
                  />
                )}
              </div>

              {/* Deck-specific ornate gilded hairline inner bezel + micro bevel */}
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute ${
                  isArtNouveau && !showMuchaFallback
                    ? "inset-[1px]"
                    : "inset-[3px]"
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

              {/* Woven linen cardstock micro-texture overlay */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
                style={{ backgroundImage: LINEN_TEXTURE_URI }}
              />

              {/* Dual-layer dynamic foil specular sheen — Layer 1: Radial candlelight spotlight */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 mix-blend-soft-light transition-opacity duration-300"
                style={{
                  opacity: activeSpotlightOpacity + 0.16,
                  background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,250,232,0.72) 0%, rgba(255,232,175,0.25) 30%, transparent 66%)`,
                }}
              />

              {/* Dual-layer dynamic foil specular sheen — Layer 2: Diagonal metallic gold-foil band */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 mix-blend-screen transition-opacity duration-300"
                style={{
                  opacity: activeSheenOpacity,
                  backgroundImage: foilGradient,
                  maskImage: foilMaskImage,
                  WebkitMaskImage: foilMaskImage,
                  maskSize: "260% 260%",
                  WebkitMaskSize: "260% 260%",
                  maskPosition: `${sheenShiftPct}% ${sheenShiftPct}%`,
                  WebkitMaskPosition: `${sheenShiftPct}% ${sheenShiftPct}%`,
                }}
              />

              {/* Edge-glint flash blooming right across the freshly revealed card face */}
              {isFlipping ? (
                <motion.div
                  aria-hidden="true"
                  initial={{ opacity: 0, x: "-120%" }}
                  animate={{ opacity: [0, 0.9, 0], x: ["-120%", "15%", "140%"] }}
                  transition={{ duration: 0.78, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(115deg, transparent 22%, rgba(255,244,200,0.72) 48%, rgba(255,255,255,0.82) 52%, transparent 76%)",
                    mixBlendMode: "screen",
                  }}
                />
              ) : null}

              {/* Crisp upright orientation badge when reversed */}
              {reversed && size !== "xs" ? (
                <div className="pointer-events-none absolute right-1.5 top-1.5 z-10">
                  <span className="inline-flex items-center rounded-full border border-[#d4af37]/55 bg-[#090b14]/82 px-2 py-0.5 text-[10px] font-medium tracking-wider text-[#f3d98a] shadow-sm backdrop-blur-md">
                    逆位
                  </span>
                </div>
              ) : null}
            </div>
          </motion.div>
        </div>
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
}
