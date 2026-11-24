"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, animate, motion, useMotionValue } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Filter,
  FlipHorizontal2,
  FlipVertical2,
  GalleryHorizontalEnd,
  Hand,
  Layers,
  Maximize2,
  Minimize2,
  Orbit,
  Palette,
  RotateCcw,
  RotateCw,
  Scissors,
  Shuffle,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import type {
  DeckId,
  DeckPoolConfig,
  SpreadSlot,
  TarotCard,
  ThemeId,
} from "@/types/tarot";
import { TAROT_CARDS, getCardById } from "@/data/tarot-cards";
import { SPREADS, getSpreadById } from "@/data/spreads";
import { getThemeById } from "@/data/themes";
import { getDeckById } from "@/data/decks";
import {
  DEFAULT_DECK_POOL,
  getDeckPoolShortLabel,
  getPoolCardIds,
} from "@/lib/deck-pool";
import { soundEngine } from "@/lib/sound";
import { CardBackArtwork } from "@/components/tarot/CardBackArtwork";
import { TarotCard3D } from "@/components/tarot/TarotCard3D";
import type {
  TablePhase,
  TablePlacedCard,
  TableSpreadId,
} from "./types";

export interface VirtualTableCanvasProps {
  deckId: DeckId;
  themeId: ThemeId;
  spreadId: TableSpreadId;
  deckPool?: DeckPoolConfig;
  allowReversed: boolean;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  gyroEnabled: boolean;
  placedCards: TablePlacedCard[];
  onPlacedCardsChange: React.Dispatch<React.SetStateAction<TablePlacedCard[]>>;
  onSpreadChange: (spreadId: TableSpreadId) => void;
  onInspectCard: (card: TarotCard, reversed: boolean) => void;
  onOpenDrawer: () => void;
  onOpenClothSheet: () => void;
  onOpenDeckSheet: () => void;
  onOpenDeckPoolModal?: () => void;
  onResetTable: () => void;
  querentFacing: boolean;
  onToggleQuerentFacing: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  canFullscreen: boolean;
  wakeLockActive: boolean;
  onExit: () => void;
}

interface WashCardBody {
  id: number;
  cardId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  vAngle: number;
  zIndex: number;
}

interface WashPointer {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  lastTime: number;
}

interface RibbonDragGhostMeta {
  cardId: string;
  ribbonIdx: number;
}

interface PlacedCardMotionControl {
  el: HTMLDivElement | null;
  stop: () => void;
  jumpTo: (x: number, y: number, scale: number, rotate: number) => void;
  springBack: () => void;
}

type DeckAnimState = "idle" | "riffle" | "cut";

const PLACED_CARD_SPRING = {
  type: "spring" as const,
  stiffness: 280,
  damping: 28,
};

function getSpreadUiStage(p: number): number {
  if (p < 0.12) return 0;
  if (p < 0.32) return 1;
  if (p < 0.36) return 2;
  if (p < 0.88) return 3;
  return 4;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function fisherYates<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function cutDeck<T>(items: T[]): T[] {
  if (items.length < 4) return [...items];
  const minCut = Math.floor(items.length * 0.28);
  const maxCut = Math.floor(items.length * 0.72);
  const cutAt = minCut + Math.floor(Math.random() * Math.max(1, maxCut - minCut));
  return [...items.slice(cutAt), ...items.slice(0, cutAt)];
}

/**
 * Maps a SpreadSlot's normalized (x, y) into the open tabletop reading zone.
 * Leaves generous space along the lower edge while the silk ribbon is deployed,
 * and expands gracefully across the full velvet cloth during Focus mode.
 */
function mapSlotToTable(
  slot: SpreadSlot,
  compactForRibbon: boolean
): { xPct: number; yPct: number; rotation: number } {
  const xMin = 10;
  const xSpan = 80;
  const yMin = compactForRibbon ? 15 : 15;
  const ySpan = compactForRibbon ? 51 : 68;

  return {
    xPct: clamp(xMin + (slot.x / 100) * xSpan, 11, 89),
    yPct: clamp(yMin + (slot.y / 100) * ySpan, 16, compactForRibbon ? 67 : 83),
    rotation: slot.rotation ?? 0,
  };
}

/**
 * Computes tidy natural coordinates for free-placed or clarifier cards drawn via tap.
 */
function computeFreeSlotPosition(
  index: number,
  compactForRibbon: boolean
): { xPct: number; yPct: number; rotation: number } {
  const perRow = 5;
  const row = Math.floor(index / perRow);
  const col = index % perRow;
  const colsInRow = Math.min(perRow, index < perRow ? Math.max(1, index + 1) : perRow);

  // Use clean deterministic grid anchored near center with slight hand-dealt organic tilt
  const colOffsets = [50, 35, 65, 22, 78];
  const xPct =
    row === 0 && index < 5
      ? colOffsets[col]
      : 20 + ((col + 0.5) / Math.max(1, colsInRow)) * 60;

  const baseRowY = compactForRibbon ? 34 : 38;
  const rowStepY = compactForRibbon ? 20 : 24;
  const yPct = clamp(baseRowY + (row % 3) * rowStepY, 18, compactForRibbon ? 64 : 78);

  // Subtle deterministic organic scatter (-2.4deg..+2.4deg)
  const scatter = (((index * 37) % 11) - 5) * 0.45;
  return { xPct, yPct, rotation: scatter };
}

function getCardPixelDims(
  deckId: DeckId,
  size: "xs" | "sm" | "md" | "lg"
): { w: number; h: number } {
  if (deckId === "mucha-hamster") {
    switch (size) {
      case "xs":
        return { w: 82, h: 122 };
      case "sm":
        return { w: 116, h: 173 };
      case "md":
        return { w: 162, h: 241 };
      case "lg":
        return { w: 212, h: 316 };
    }
  }
  switch (size) {
    case "xs":
      return { w: 72, h: 124 };
    case "sm":
      return { w: 104, h: 178 };
    case "md":
      return { w: 144, h: 246 };
    case "lg":
      return { w: 188, h: 322 };
  }
}

interface PlacedTableCardItemProps {
  placed: TablePlacedCard;
  tarotCard: TarotCard;
  deckId: DeckId;
  themeId: ThemeId;
  isLightTheme: boolean;
  accentColor: string;
  accentStrong: string;
  placedCardSize: "xs" | "sm" | "md" | "lg";
  placedCardScale: number;
  cardWidth: number;
  cardHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  querentFacing: boolean;
  cleanMode: boolean;
  gyroEnabled: boolean;
  soundEnabled: boolean;
  isSelected: boolean;
  flipDelay: number;
  slotIndexLabel?: number;
  slotLabelZh?: string;
  slotRotation?: number;
  activeDraggingUidRef: React.MutableRefObject<string | null>;
  registerControl: (uid: string, ctrl: PlacedCardMotionControl | null) => void;
  onPointerDown: (uid: string, e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (uid: string, e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (uid: string, e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (uid: string) => void;
  onKeyDown: (uid: string, e: React.KeyboardEvent<HTMLDivElement>) => void;
}

const PlacedTableCardItem = React.memo(function PlacedTableCardItem({
  placed,
  tarotCard,
  deckId,
  themeId,
  isLightTheme,
  accentColor,
  accentStrong,
  placedCardSize,
  placedCardScale,
  cardWidth,
  cardHeight,
  canvasWidth,
  canvasHeight,
  querentFacing,
  cleanMode,
  gyroEnabled,
  soundEnabled,
  isSelected,
  flipDelay,
  slotIndexLabel,
  slotLabelZh,
  slotRotation,
  activeDraggingUidRef,
  registerControl,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onKeyDown,
}: PlacedTableCardItemProps) {
  const cardX = (placed.xPct / 100) * canvasWidth - cardWidth / 2;
  const cardY = (placed.yPct / 100) * canvasHeight - cardHeight / 2;
  const effectiveRotation = placed.rotation + (querentFacing ? 180 : 0);
  const targetScale = isSelected ? placedCardScale * 1.03 : placedCardScale;

  // Entrance deal-in starts slightly below target and scaled down, animated purely on GPU
  const initialY = Math.min(
    canvasHeight * 0.92 - cardHeight / 2,
    cardY + canvasHeight * 0.12
  );

  const mvX = useMotionValue(cardX);
  const mvY = useMotionValue(initialY);
  const mvScale = useMotionValue(placedCardScale * 0.72);
  const mvRotate = useMotionValue(effectiveRotation - 8);

  const rootElRef = useRef<HTMLDivElement | null>(null);
  const animsRef = useRef<Array<{ stop: () => void }>>([]);
  const latestTargetsRef = useRef({
    x: cardX,
    y: cardY,
    scale: targetScale,
    rotate: effectiveRotation,
  });
  latestTargetsRef.current = {
    x: cardX,
    y: cardY,
    scale: targetScale,
    rotate: effectiveRotation,
  };

  const stopAnims = useCallback(() => {
    for (const a of animsRef.current) {
      a.stop();
    }
    animsRef.current = [];
  }, []);

  const springToTargets = useCallback(() => {
    stopAnims();
    const t = latestTargetsRef.current;
    animsRef.current = [
      animate(mvX, t.x, PLACED_CARD_SPRING),
      animate(mvY, t.y, PLACED_CARD_SPRING),
      animate(mvScale, t.scale, PLACED_CARD_SPRING),
      animate(mvRotate, t.rotate, PLACED_CARD_SPRING),
    ];
  }, [mvRotate, mvScale, mvX, mvY, stopAnims]);

  useEffect(() => {
    const ctrl: PlacedCardMotionControl = {
      get el() {
        return rootElRef.current;
      },
      stop: stopAnims,
      jumpTo: (x, y, scale, rotate) => {
        stopAnims();
        mvX.jump(x);
        mvY.jump(y);
        mvScale.jump(scale);
        mvRotate.jump(rotate);
      },
      springBack: springToTargets,
    };
    registerControl(placed.uid, ctrl);
    return () => {
      stopAnims();
      registerControl(placed.uid, null);
    };
  }, [
    mvRotate,
    mvScale,
    mvX,
    mvY,
    placed.uid,
    registerControl,
    springToTargets,
    stopAnims,
  ]);

  useEffect(() => {
    if (activeDraggingUidRef.current === placed.uid) return;
    springToTargets();
  }, [
    activeDraggingUidRef,
    cardX,
    cardY,
    effectiveRotation,
    placed.uid,
    placed.zIndex,
    springToTargets,
    targetScale,
  ]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => onPointerDown(placed.uid, e),
    [onPointerDown, placed.uid]
  );
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => onPointerMove(placed.uid, e),
    [onPointerMove, placed.uid]
  );
  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => onPointerUp(placed.uid, e),
    [onPointerUp, placed.uid]
  );
  const handlePointerCancel = useCallback(
    () => onPointerCancel(placed.uid),
    [onPointerCancel, placed.uid]
  );
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => onKeyDown(placed.uid, e),
    [onKeyDown, placed.uid]
  );

  const pillSurfaceClass = isLightTheme
    ? "bg-[#fbf6ea]/92"
    : "bg-[#0b0d18]/88";

  return (
    <motion.div
      ref={rootElRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ scale: 0.68, opacity: 0, transition: { duration: 0.22 } }}
      role="button"
      tabIndex={0}
      aria-label={
        placed.revealed
          ? `${tarotCard.nameZh} ${placed.reversed ? "逆位" : "正位"}`
          : "点击翻开塔罗牌"
      }
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className="absolute top-0 left-0 touch-none outline-none"
      style={{
        width: cardWidth,
        height: cardHeight,
        x: mvX,
        y: mvY,
        scale: mvScale,
        rotate: mvRotate,
        zIndex: placed.zIndex,
        cursor: "grab",
      }}
    >
      <div className="relative h-full w-full">
        {/* Subtle slot pill above card (solid high-opacity surface, zero backdrop-blur) */}
        {!cleanMode &&
        slotLabelZh !== undefined &&
        slotIndexLabel !== undefined &&
        (slotRotation ?? 0) === 0 ? (
          <span
            className={`pointer-events-none absolute bottom-full left-1/2 mb-1.5 max-w-[130px] -translate-x-1/2 truncate rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wider ${pillSurfaceClass}`}
            style={{
              borderColor: `${accentColor}52`,
              color: accentStrong,
            }}
          >
            {slotIndexLabel + 1}. {slotLabelZh}
          </span>
        ) : null}

        <TarotCard3D
          card={tarotCard}
          deckId={deckId}
          themeId={themeId}
          flipped={placed.revealed}
          reversed={placed.reversed}
          size={placedCardSize}
          interactive
          tiltEnabled
          gyroEnabled={gyroEnabled}
          soundEnabled={soundEnabled}
          glowActive={isSelected}
          maxTilt={14}
          performanceMode="tabletop"
          flipDelay={flipDelay}
          className="touch-none"
        />

        {/* Compact card name pill once flipped (solid high-opacity surface, zero backdrop-blur) */}
        {placed.revealed && !cleanMode && placedCardSize !== "xs" ? (
          <div
            className={`pointer-events-none absolute top-full left-1/2 mt-1.5 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[10px] ${pillSurfaceClass}`}
            style={{
              borderColor: "var(--border-subtle)",
              color: "var(--text-primary)",
            }}
          >
            <span className="font-serif font-medium tracking-wide">
              {tarotCard.nameZh}
            </span>
            <span
              className={
                placed.reversed
                  ? isLightTheme
                    ? "text-amber-800"
                    : "text-amber-300"
                  : "text-[var(--accent-strong)]"
              }
            >
              · {placed.reversed ? "逆" : "正"}
            </span>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
});

export const VirtualTableCanvas = React.memo(function VirtualTableCanvas({
  deckId,
  themeId,
  spreadId,
  deckPool = DEFAULT_DECK_POOL,
  allowReversed,
  soundEnabled,
  hapticsEnabled,
  gyroEnabled,
  placedCards,
  onPlacedCardsChange,
  onSpreadChange,
  onInspectCard,
  onOpenDrawer,
  onOpenClothSheet,
  onOpenDeckSheet,
  onOpenDeckPoolModal,
  onResetTable,
  querentFacing,
  onToggleQuerentFacing,
  isFullscreen,
  onToggleFullscreen,
  canFullscreen,
  wakeLockActive,
  onExit,
}: VirtualTableCanvasProps) {
  const theme = getThemeById(themeId);
  const deck = getDeckById(deckId);
  const activeSpread = useMemo(
    () => (spreadId === "free" ? null : getSpreadById(spreadId)),
    [spreadId]
  );

  // Active divination card pool driven by user's selected rule
  const activePoolCardIds = useMemo(() => {
    const ids = getPoolCardIds(deckPool, TAROT_CARDS);
    return ids.length > 0 ? ids : TAROT_CARDS.map((c) => c.id);
  }, [deckPool]);
  const poolSignature = useMemo(
    () => activePoolCardIds.join(","),
    [activePoolCardIds]
  );
  const deckPoolShortLabel = useMemo(
    () => getDeckPoolShortLabel(deckPool, activePoolCardIds.length),
    [activePoolCardIds.length, deckPool]
  );

  const accentColor = theme.cssVars["--accent"] ?? "#d4af37";
  const accentStrong = theme.cssVars["--accent-strong"] ?? "#f0d27a";
  const cardEdgeColor = theme.cardEdgeColor ?? "#c9a24b";
  const clothGlow = theme.cssVars["--cloth-glow"] ?? "rgba(212,175,55,0.16)";

  // Viewport bounds measured via ResizeObserver
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({
    width: 1024,
    height: 768,
  });

  // Tabletop ritual phase & UI state
  const [phase, setPhase] = useState<TablePhase>("stack");
  const [cleanMode, setCleanMode] = useState<boolean>(false);
  const [spreadMenuOpen, setSpreadMenuOpen] = useState<boolean>(false);
  const [deckAnim, setDeckAnim] = useState<DeckAnimState>("idle");
  const [shuffleCount, setShuffleCount] = useState<number>(0);

  // Shuffled active pool deck order (deterministic initial for SSR, immediately Fisher-Yates shuffled on mount)
  const [deckOrder, setDeckOrder] = useState<string[]>(() => activePoolCardIds);
  const [washCardIds, setWashCardIds] = useState<string[]>(() => activePoolCardIds);

  // Ribbon phase states (slimmed so live drag/sweep runs 0-rerender via DOM refs!)
  const [spreadProgress, setSpreadProgress] = useState<number>(0);
  const [ribbonDirection, setRibbonDirection] = useState<"ltr" | "rtl">("ltr");
  const [hoveredRibbonIdx, setHoveredRibbonIdx] = useState<number | null>(null);
  const [ribbonGhost, setRibbonGhost] = useState<RibbonDragGhostMeta | null>(null);

  // Placed card interaction states
  const [selectedCardUid, setSelectedCardUid] = useState<string | null>(null);
  const [floatReadingTab, setFloatReadingTab] = useState<
    "general" | "love" | "career" | "wealth" | "advice"
  >("general");
  const [dragHoverSlotIdx, setDragHoverSlotIdx] = useState<number | null>(null);
  const [isGatheringWash, setIsGatheringWash] = useState<boolean>(false);
  const [flipDelays, setFlipDelays] = useState<Record<string, number>>({});

  // Refs for physics, gestures, timers, and zero-rerender DOM transforms
  const maxZRef = useRef<number>(20);
  const movedByUserRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<number[]>([]);
  const ribbonAnimRafRef = useRef<number | null>(null);
  const spreadProgressRef = useRef<number>(0);
  const ribbonDirectionRef = useRef<"ltr" | "rtl">("ltr");
  const ribbonLiveDriveRef = useRef<boolean>(false);
  const lastSpreadUiStageRef = useRef<number>(0);
  const lastRibbonTickBucketRef = useRef<number>(0);
  const lastHapticMsRef = useRef<number>(0);
  const lastTapRef = useRef<{ uid: string; ts: number }>({ uid: "", ts: 0 });
  const prevPlacedLenRef = useRef<number>(placedCards.length);
  const hasFlipDelaysRef = useRef<boolean>(false);

  // Zero-rerender DOM element & live state refs
  const placedCardsRef = useRef<TablePlacedCard[]>(placedCards);
  const placedCardControlsRef = useRef<Map<string, PlacedCardMotionControl>>(
    new Map()
  );
  const activeDraggingUidRef = useRef<string | null>(null);
  const dragHoverSlotIdxRef = useRef<number | null>(null);
  const selectedCardUidRef = useRef<string | null>(selectedCardUid);
  const spreadMenuOpenRef = useRef<boolean>(spreadMenuOpen);
  const querentFacingRef = useRef<boolean>(querentFacing);
  const canvasSizeRef = useRef(canvasSize);
  const ghostElRef = useRef<HTMLDivElement | null>(null);
  const ghostPosRef = useRef<{ x: number; y: number; vx: number }>({
    x: 0,
    y: 0,
    vx: 0,
  });
  const ribbonCardElsRef = useRef<Array<HTMLDivElement | null>>([]);
  const hoveredRibbonIdxRef = useRef<number | null>(hoveredRibbonIdx);
  const ribbonGhostCardIdRef = useRef<string | null>(ribbonGhost?.cardId ?? null);

  placedCardsRef.current = placedCards;
  selectedCardUidRef.current = selectedCardUid;
  spreadMenuOpenRef.current = spreadMenuOpen;
  querentFacingRef.current = querentFacing;
  canvasSizeRef.current = canvasSize;
  hoveredRibbonIdxRef.current = hoveredRibbonIdx;
  ribbonGhostCardIdRef.current = ribbonGhost?.cardId ?? null;

  // Wash shuffle 60fps refs (no React re-renders per frame!)
  const washBodiesRef = useRef<WashCardBody[]>([]);
  const washCardElsRef = useRef<Array<HTMLDivElement | null>>([]);
  const washPointersRef = useRef<Map<number, WashPointer>>(new Map());
  const washRafRef = useRef<number | null>(null);
  const washGatheringRef = useRef<boolean>(false);
  const washLastAudioMsRef = useRef<number>(0);
  const washLastHapticMsRef = useRef<number>(0);
  const washZCounterRef = useRef<number>(40);
  const [washPointerDots, setWashPointerDots] = useState<
    Array<{ id: number; x: number; y: number }>
  >([]);

  const registerPlacedCardControl = useCallback(
    (uid: string, ctrl: PlacedCardMotionControl | null) => {
      if (ctrl) {
        placedCardControlsRef.current.set(uid, ctrl);
      } else {
        placedCardControlsRef.current.delete(uid);
      }
    },
    []
  );

  const clearFlipDelays = useCallback(() => {
    if (hasFlipDelaysRef.current) {
      hasFlipDelaysRef.current = false;
      setFlipDelays({});
    }
  }, []);

  // Derived deck pools
  const usedCardIds = useMemo(
    () => new Set(placedCards.map((c) => c.cardId)),
    [placedCards]
  );

  const availableCardIds = useMemo(
    () => deckOrder.filter((id) => !usedCardIds.has(id)),
    [deckOrder, usedCardIds]
  );

  // Full remaining active pool in the silk ribbon (no artificial 32-card cap!)
  const ribbonCards = availableCardIds;

  // Dynamic physical stack thickness reflecting true remaining card count (2..16 slices)
  const stackVisualLayers = useMemo(() => {
    const sliceCount = clamp(
      Math.round(2 + (availableCardIds.length / 78) * 14),
      availableCardIds.length === 0 ? 0 : 2,
      16
    );
    return Array.from({ length: sliceCount }, (_, i) => i);
  }, [availableCardIds.length]);

  const revealedCount = useMemo(
    () => placedCards.filter((c) => c.revealed).length,
    [placedCards]
  );

  const unrevealedCount = placedCards.length - revealedCount;

  // Responsive deck aspect & card sizes
  const cardRatio = deckId === "mucha-hamster" ? 848 / 1264 : 7 / 12;
  const isCompactPhone = canvasSize.width < 560;
  const isTabletOrWide = canvasSize.width >= 768;

  // Face-down deck/wash/ribbon card pixel dimensions
  const deckCardHeight = useMemo(() => {
    const minDim = Math.min(canvasSize.width, canvasSize.height);
    if (isTabletOrWide) {
      return clamp(Math.round(minDim * 0.255), 156, 212);
    }
    return clamp(Math.round(minDim * 0.27), 116, 152);
  }, [canvasSize.height, canvasSize.width, isTabletOrWide]);

  const deckCardWidth = Math.round(deckCardHeight * cardRatio);

  const ribbonCardHeight = useMemo(() => {
    if (isTabletOrWide) {
      return clamp(Math.round(canvasSize.height * 0.185), 124, 160);
    }
    return clamp(Math.round(canvasSize.height * 0.145), 94, 122);
  }, [canvasSize.height, isTabletOrWide]);

  const ribbonCardWidth = Math.round(ribbonCardHeight * cardRatio);

  const washCardHeight = useMemo(() => {
    const isLargePool = washCardIds.length > 48;
    const minDim = Math.min(canvasSize.width, canvasSize.height);
    if (isTabletOrWide) {
      return isLargePool
        ? clamp(Math.round(minDim * 0.162), 108, 144)
        : clamp(Math.round(minDim * 0.185), 124, 162);
    }
    return isLargePool
      ? clamp(Math.round(minDim * 0.172), 74, 100)
      : clamp(Math.round(minDim * 0.205), 88, 118);
  }, [canvasSize.height, canvasSize.width, isTabletOrWide, washCardIds.length]);

  const washCardWidth = Math.round(washCardHeight * cardRatio);

  // Placed card TarotCard3D size + subtle responsive scale
  const { placedCardSize, placedCardScale } = useMemo<{
    placedCardSize: "xs" | "sm" | "md" | "lg";
    placedCardScale: number;
  }>(() => {
    const count = Math.max(placedCards.length, activeSpread?.cardCount ?? 1);
    const inFocus = phase === "focus";

    if (canvasSize.width >= 960 && canvasSize.height >= 640) {
      if (spreadId === "celtic-cross" || count >= 8) {
        return {
          placedCardSize: "sm",
          placedCardScale: inFocus
            ? clamp(canvasSize.height / 940, 0.74, 0.94)
            : clamp(canvasSize.height / 1140, 0.62, 0.78),
        };
      }
      if (spreadId === "single" || (spreadId === "free" && count <= 1)) {
        return {
          placedCardSize: inFocus ? "lg" : "md",
          placedCardScale: inFocus ? 1.04 : 0.96,
        };
      }
      if (count <= 3) {
        return {
          placedCardSize: "md",
          placedCardScale: inFocus ? 1.0 : 0.88,
        };
      }
      return {
        placedCardSize: inFocus ? "md" : "sm",
        placedCardScale: inFocus ? 0.86 : 0.86,
      };
    }

    if (canvasSize.width >= 600) {
      if (spreadId === "celtic-cross" || count >= 8) {
        return {
          placedCardSize: "xs",
          placedCardScale: inFocus ? 0.96 : 0.84,
        };
      }
      if (count <= 3) {
        return {
          placedCardSize: "md",
          placedCardScale: inFocus ? 0.9 : 0.78,
        };
      }
      return {
        placedCardSize: "sm",
        placedCardScale: inFocus ? 0.88 : 0.76,
      };
    }

    // Narrow mobile phone
    if (spreadId === "celtic-cross" || count >= 7) {
      return { placedCardSize: "xs", placedCardScale: inFocus ? 0.82 : 0.72 };
    }
    if (count <= 1) {
      return { placedCardSize: "md", placedCardScale: inFocus ? 0.96 : 0.84 };
    }
    if (count <= 3) {
      return { placedCardSize: "sm", placedCardScale: inFocus ? 0.9 : 0.78 };
    }
    return { placedCardSize: "xs", placedCardScale: inFocus ? 0.92 : 0.82 };
  }, [
    activeSpread?.cardCount,
    canvasSize.height,
    canvasSize.width,
    phase,
    placedCards.length,
    spreadId,
  ]);

  const placedCardDims = useMemo(
    () => getCardPixelDims(deckId, placedCardSize),
    [deckId, placedCardSize]
  );

  // Refs synced with latest responsive card/ribbon sizing for zero-rerender DOM transforms
  const placedCardDimsRef = useRef(placedCardDims);
  const placedCardScaleRef = useRef(placedCardScale);
  const ribbonCardsRef = useRef(ribbonCards);
  const ribbonCardWidthRef = useRef(ribbonCardWidth);
  const ribbonCardHeightRef = useRef(ribbonCardHeight);
  placedCardDimsRef.current = placedCardDims;
  placedCardScaleRef.current = placedCardScale;
  ribbonCardsRef.current = ribbonCards;
  ribbonCardWidthRef.current = ribbonCardWidth;
  ribbonCardHeightRef.current = ribbonCardHeight;

  useEffect(() => {
    if (ribbonCardElsRef.current.length > ribbonCards.length) {
      ribbonCardElsRef.current.length = ribbonCards.length;
    }
  }, [ribbonCards.length]);

  // Haptics helper (throttled >= 65ms to prevent vibration motor chatter / main-thread spam)
  const triggerHaptic = useCallback(
    (pattern: number | number[]) => {
      if (!hapticsEnabled || typeof navigator === "undefined") return;
      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      if (now - lastHapticMsRef.current < 65) return;
      lastHapticMsRef.current = now;
      try {
        navigator.vibrate?.(pattern);
      } catch {
        // Unsupported device
      }
    },
    [hapticsEnabled]
  );

  // Safe timer scheduling
  const scheduleTimer = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((t) => t !== id);
      fn();
    }, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  const stopRibbonAnim = useCallback(() => {
    if (ribbonAnimRafRef.current !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(ribbonAnimRafRef.current);
      ribbonAnimRafRef.current = null;
    }
    ribbonLiveDriveRef.current = false;
  }, []);

  // Client-mount cleanup
  useEffect(() => {
    return () => {
      stopRibbonAnim();
      if (washRafRef.current !== null) {
        window.cancelAnimationFrame(washRafRef.current);
      }
      for (const id of timersRef.current) {
        window.clearTimeout(id);
      }
      timersRef.current = [];
    };
  }, [stopRibbonAnim]);

  // Re-shuffle active pool whenever deck pool rules change (and on initial mount)
  useEffect(() => {
    const shuffled = fisherYates(activePoolCardIds);
    setDeckOrder(shuffled);
    setHoveredRibbonIdx(null);
    // Keep wash card pool synced immediately if user switched rules during wash
    const nextWash = shuffled.filter((id) => !usedCardIds.has(id));
    setWashCardIds(nextWash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolSignature]);

  // Measure tabletop bounds continuously with rAF-coalesced ResizeObserver
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof window === "undefined") return;

    let rafId: number | null = null;

    const applyBounds = () => {
      rafId = null;
      const rect = el.getBoundingClientRect();
      const nextW = Math.round(rect.width);
      const nextH = Math.round(rect.height);
      if (nextW > 0 && nextH > 0) {
        setCanvasSize((prev) =>
          prev.width === nextW && prev.height === nextH
            ? prev
            : { width: nextW, height: nextH }
        );
      }
    };

    const scheduleBoundsUpdate = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(applyBounds);
    };

    applyBounds();

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(scheduleBoundsUpdate);
      ro.observe(el);
      return () => {
        ro.disconnect();
        if (rafId !== null) {
          window.cancelAnimationFrame(rafId);
        }
      };
    }
    window.addEventListener("resize", scheduleBoundsUpdate, { passive: true });
    return () => {
      window.removeEventListener("resize", scheduleBoundsUpdate);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  // Sync maxZRef with incoming placedCards & detect external reset
  useEffect(() => {
    const highest = placedCards.reduce((acc, c) => Math.max(acc, c.zIndex), 20);
    if (highest > maxZRef.current) {
      maxZRef.current = highest;
    }

    if (prevPlacedLenRef.current > 0 && placedCards.length === 0) {
      stopRibbonAnim();
      clearFlipDelays();
      setSelectedCardUid(null);
      setRibbonGhost(null);
      dragHoverSlotIdxRef.current = null;
      setDragHoverSlotIdx(null);
      movedByUserRef.current.clear();
      const reshuffled = fisherYates(activePoolCardIds);
      setDeckOrder(reshuffled);
      setWashCardIds(reshuffled);
      spreadProgressRef.current = 0;
      ribbonDirectionRef.current = "ltr";
      lastSpreadUiStageRef.current = 0;
      setRibbonDirection("ltr");
      setSpreadProgress(0);
      setPhase("stack");
    }
    prevPlacedLenRef.current = placedCards.length;
  }, [activePoolCardIds, clearFlipDelays, placedCards, stopRibbonAnim]);

  // Compute ribbon geometry
  const ribbonGeom = useMemo(() => {
    const padX = Math.max(ribbonCardWidth * 0.65 + 22, canvasSize.width * 0.09);
    const startX = padX;
    const endX = Math.max(startX + 80, canvasSize.width - padX);
    const spanX = endX - startX;
    const bottomReserve = isCompactPhone ? 74 : 76;
    const baseY = canvasSize.height - bottomReserve - ribbonCardHeight * 0.48;
    const arcLift = clamp(canvasSize.height * 0.044, 16, 38);
    return { startX, endX, spanX, baseY, arcLift };
  }, [canvasSize.height, canvasSize.width, isCompactPhone, ribbonCardHeight, ribbonCardWidth]);

  const ribbonGeomRef = useRef(ribbonGeom);
  ribbonGeomRef.current = ribbonGeom;

  const getRibbonCardTransform = useCallback(
    (idx: number, total: number, progress: number, dir: "ltr" | "rtl") => {
      const t = total <= 1 ? 0.5 : idx / (total - 1);
      const u = dir === "ltr" ? t * progress : 1 - (1 - t) * progress;
      const x = ribbonGeom.startX + u * ribbonGeom.spanX;
      const arch = 4 * u * (1 - u);
      const stackLift = (1 - progress) * -Math.min(idx * 0.24, 18);
      const y = ribbonGeom.baseY - arch * ribbonGeom.arcLift + stackLift;
      const angle = (u - 0.5) * 26 * progress;
      return { x, y, angle, u };
    },
    [ribbonGeom]
  );

  // Batch-write all 68-78 ribbon card transforms directly to DOM (0 React re-renders/frame)
  const applyRibbonTransformsToDom = useCallback(
    (progress: number, dir: "ltr" | "rtl", disableTransition: boolean) => {
      const cardIds = ribbonCardsRef.current;
      const total = cardIds.length;
      if (total === 0) return;
      const geom = ribbonGeomRef.current;
      const halfW = ribbonCardWidthRef.current * 0.5;
      const halfH = ribbonCardHeightRef.current * 0.5;
      const els = ribbonCardElsRef.current;
      const focusedIdx =
        !disableTransition && progress > 0.35
          ? hoveredRibbonIdxRef.current
          : null;
      const pullingCardId = ribbonGhostCardIdRef.current;
      const transitionVal = disableTransition
        ? "none"
        : "transform 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 160ms ease";

      for (let i = 0; i < total; i++) {
        const el = els[i];
        if (!el) continue;
        const t = total <= 1 ? 0.5 : i / (total - 1);
        const u = dir === "ltr" ? t * progress : 1 - (1 - t) * progress;
        const x = geom.startX + u * geom.spanX;
        const arch = 4 * u * (1 - u);
        const stackLift = (1 - progress) * -Math.min(i * 0.24, 18);
        const y = geom.baseY - arch * geom.arcLift + stackLift;
        const angle = (u - 0.5) * 26 * progress;
        const isFocused = focusedIdx === i && cardIds[i] !== pullingCardId;

        el.style.transition = transitionVal;
        el.style.transform = `translate3d(${(x - halfW).toFixed(1)}px, ${(
          y -
          halfH -
          (isFocused ? 26 : 0)
        ).toFixed(1)}px, 0) rotate(${angle.toFixed(1)}deg)${
          isFocused ? " scale(1.1)" : ""
        }`;
      }
    },
    []
  );

  // Smoothly animate spreadProgress via direct DOM writes (only sync React state at UI thresholds / end)
  const animateSpreadProgress = useCallback(
    (target: number, durationMs = 640, onDone?: () => void) => {
      stopRibbonAnim();
      const from = spreadProgressRef.current;
      const startTs = performance.now();
      const totalCards = Math.max(1, ribbonCardsRef.current.length);
      ribbonLiveDriveRef.current = true;
      if (hoveredRibbonIdxRef.current !== null) {
        setHoveredRibbonIdx(null);
      }

      const tick = (now: number) => {
        const rawT = clamp((now - startTs) / durationMs, 0, 1);
        const eased = 1 - Math.pow(1 - rawT, 3);
        const nextVal = from + (target - from) * eased;
        spreadProgressRef.current = nextVal;

        const dir = ribbonDirectionRef.current;
        applyRibbonTransformsToDom(nextVal, dir, true);

        const bucket = Math.floor(nextVal * totalCards);
        if (bucket !== lastRibbonTickBucketRef.current) {
          lastRibbonTickBucketRef.current = bucket;
          soundEngine.playHoverTick(soundEnabled);
          if (bucket % 3 === 0) triggerHaptic(4);
        }

        if (rawT < 1) {
          const nextStage = getSpreadUiStage(nextVal);
          if (nextStage !== lastSpreadUiStageRef.current) {
            lastSpreadUiStageRef.current = nextStage;
            setSpreadProgress(nextVal);
          }
          ribbonAnimRafRef.current = window.requestAnimationFrame(tick);
        } else {
          ribbonAnimRafRef.current = null;
          ribbonLiveDriveRef.current = false;
          spreadProgressRef.current = target;
          lastSpreadUiStageRef.current = getSpreadUiStage(target);
          applyRibbonTransformsToDom(target, dir, false);
          setRibbonDirection(dir);
          setSpreadProgress(target);
          onDone?.();
        }
      };

      ribbonAnimRafRef.current = window.requestAnimationFrame(tick);
    },
    [applyRibbonTransformsToDom, soundEnabled, stopRibbonAnim, triggerHaptic]
  );

  // Reposition untouched spread cards gracefully when toggling ribbon vs focus
  const syncSpreadCardsForPhase = useCallback(
    (nextPhase: TablePhase) => {
      if (!activeSpread) return;
      const compactForRibbon = nextPhase !== "focus";
      onPlacedCardsChange((prev) => {
        if (prev.length === 0) return prev;
        let changed = false;
        const next = prev.map((card) => {
          if (movedByUserRef.current.has(card.uid)) return card;
          const slot = activeSpread.slots[card.slotIndex];
          if (!slot) return card;
          const mapped = mapSlotToTable(slot, compactForRibbon);
          if (
            Math.abs(card.xPct - mapped.xPct) > 0.2 ||
            Math.abs(card.yPct - mapped.yPct) > 0.2
          ) {
            changed = true;
            return {
              ...card,
              xPct: mapped.xPct,
              yPct: mapped.yPct,
              rotation: mapped.rotation,
            };
          }
          return card;
        });
        return changed ? next : prev;
      });
    },
    [activeSpread, onPlacedCardsChange]
  );

  const handleEnterFocus = useCallback(() => {
    stopRibbonAnim();
    soundEngine.playHoverTick(soundEnabled);
    triggerHaptic(10);
    setHoveredRibbonIdx(null);
    setRibbonGhost(null);
    dragHoverSlotIdxRef.current = null;
    setDragHoverSlotIdx(null);
    setPhase("focus");
    syncSpreadCardsForPhase("focus");
  }, [soundEnabled, stopRibbonAnim, syncSpreadCardsForPhase, triggerHaptic]);

  const handleEnterRibbon = useCallback(
    (autoSpread = false) => {
      if (deckAnim !== "idle") return;
      stopRibbonAnim();
      soundEngine.playCardDraw(soundEnabled);
      triggerHaptic(12);
      setSelectedCardUid(null);
      ribbonDirectionRef.current = "ltr";
      spreadProgressRef.current = 0;
      lastSpreadUiStageRef.current = 0;
      setRibbonDirection("ltr");
      setHoveredRibbonIdx(null);
      setSpreadProgress(0);
      setPhase("ribbon");
      syncSpreadCardsForPhase("ribbon");
      if (autoSpread) {
        scheduleTimer(() => animateSpreadProgress(1, 620), 60);
      }
    },
    [
      animateSpreadProgress,
      deckAnim,
      scheduleTimer,
      soundEnabled,
      stopRibbonAnim,
      syncSpreadCardsForPhase,
      triggerHaptic,
    ]
  );

  // =========================================================================
  // Phase A: Stack Actions (Riffle Shuffle & Cut)
  // =========================================================================
  const handleRiffleShuffle = useCallback(() => {
    if (deckAnim !== "idle") return;
    setDeckAnim("riffle");
    setDeckOrder((prev) => fisherYates(prev));
    setShuffleCount((c) => c + 1);
    soundEngine.playShuffle(soundEnabled);
    triggerHaptic([10, 32, 10]);

    scheduleTimer(() => {
      setDeckAnim("idle");
    }, 680);
  }, [deckAnim, scheduleTimer, soundEnabled, triggerHaptic]);

  const handleCutDeck = useCallback(() => {
    if (deckAnim !== "idle") return;
    setDeckAnim("cut");
    setDeckOrder((prev) => cutDeck(prev));
    soundEngine.playCut(soundEnabled);
    triggerHaptic(18);

    scheduleTimer(() => {
      setDeckAnim("idle");
    }, 640);
  }, [deckAnim, scheduleTimer, soundEnabled, triggerHaptic]);

  // =========================================================================
  // Phase B: 60fps 2D Physics Wash Shuffle (True Full Active Deck Count!)
  // =========================================================================
  const initWashBodies = useCallback(
    (cardIds: string[]) => {
      const count = cardIds.length;
      const cx = canvasSize.width * 0.5;
      const cy = canvasSize.height * 0.5;
      const spreadRx = Math.min(canvasSize.width * 0.36, 400);
      const spreadRy = Math.min(canvasSize.height * 0.28, 250);

      washCardElsRef.current = washCardElsRef.current.slice(0, count);
      washBodiesRef.current = cardIds.map((cardId, i) => {
        const goldenAngle = i * 2.399963229728653 + Math.random() * 0.35;
        const radialNorm = Math.sqrt((i + 0.5) / Math.max(1, count));
        const speed = 7 + radialNorm * 13 + Math.random() * 4;
        return {
          id: i,
          cardId,
          x: cx + Math.cos(goldenAngle) * spreadRx * (0.12 + radialNorm * 0.24),
          y: cy + Math.sin(goldenAngle) * spreadRy * (0.12 + radialNorm * 0.24),
          vx: Math.cos(goldenAngle) * speed + (Math.random() - 0.5) * 4,
          vy: Math.sin(goldenAngle) * speed + (Math.random() - 0.5) * 4,
          angle: (Math.random() - 0.5) * 340,
          vAngle: (Math.random() - 0.5) * 16,
          zIndex: i + 1,
        };
      });
      washZCounterRef.current = count + 8;
    },
    [canvasSize.height, canvasSize.width]
  );

  const handleEnterWash = useCallback(() => {
    if (availableCardIds.length === 0) return;
    stopRibbonAnim();
    setSelectedCardUid(null);
    setSpreadMenuOpen(false);
    washGatheringRef.current = false;
    setIsGatheringWash(false);
    washPointersRef.current.clear();
    setWashPointerDots([]);
    const snapshotIds = [...availableCardIds];
    setWashCardIds(snapshotIds);
    initWashBodies(snapshotIds);
    soundEngine.playShuffle(soundEnabled);
    triggerHaptic([12, 24, 12]);
    setPhase("wash");
  }, [availableCardIds, initWashBodies, soundEnabled, stopRibbonAnim, triggerHaptic]);

  const handleScatterWashAgain = useCallback(() => {
    if (washGatheringRef.current) return;
    const shuffledIds = fisherYates(washCardIds);
    setWashCardIds(shuffledIds);
    initWashBodies(shuffledIds);
    soundEngine.playShuffle(soundEnabled);
    triggerHaptic(12);
  }, [initWashBodies, soundEnabled, triggerHaptic, washCardIds]);

  const handleGatherWashToRibbon = useCallback(() => {
    if (washGatheringRef.current) return;
    washGatheringRef.current = true;
    setIsGatheringWash(true);
    washPointersRef.current.clear();
    setWashPointerDots([]);

    // Derive authentic order from physical washed z-stacking + spatial shuffle, plus gentle cut
    const bodies = washBodiesRef.current;
    if (bodies.length > 0) {
      const physicalOrder = [...bodies]
        .sort((a, b) => a.zIndex - b.zIndex || a.x - b.x)
        .map((b) => b.cardId);
      const placedIds = deckOrder.filter((id) => usedCardIds.has(id));
      const washedCut = cutDeck(physicalOrder);
      setDeckOrder([...washedCut, ...placedIds]);
    } else {
      setDeckOrder((prev) => fisherYates(prev));
    }

    setShuffleCount((c) => c + 1);
    soundEngine.playShuffle(soundEnabled);
    triggerHaptic([12, 28, 16]);

    scheduleTimer(() => {
      washGatheringRef.current = false;
      setIsGatheringWash(false);
      ribbonDirectionRef.current = "ltr";
      spreadProgressRef.current = 0;
      lastSpreadUiStageRef.current = 0;
      ribbonLiveDriveRef.current = false;
      setRibbonDirection("ltr");
      setSpreadProgress(0);
      setPhase("ribbon");
      syncSpreadCardsForPhase("ribbon");
    }, 580);
  }, [deckOrder, scheduleTimer, soundEnabled, syncSpreadCardsForPhase, triggerHaptic, usedCardIds]);

  // 60fps Wash Physics rAF Loop
  useEffect(() => {
    if (phase !== "wash") {
      if (washRafRef.current !== null) {
        window.cancelAnimationFrame(washRafRef.current);
        washRafRef.current = null;
      }
      return;
    }

    if (
      washBodiesRef.current.length !== washCardIds.length ||
      washBodiesRef.current.some((b, idx) => b.cardId !== washCardIds[idx])
    ) {
      initWashBodies(washCardIds);
    }

    let lastTime = performance.now();

    const stepPhysics = (now: number) => {
      const dt = clamp((now - lastTime) / 1000, 0.004, 0.04);
      lastTime = now;
      const step = dt * 60;
      const damping = Math.pow(0.905, step);
      const angDamping = Math.pow(0.89, step);

      const bodies = washBodiesRef.current;
      const pointers = Array.from(washPointersRef.current.values());
      const halfW = washCardWidth * 0.5;
      const halfH = washCardHeight * 0.5;
      const padLeft = halfW + 20;
      const padRight = canvasSize.width - halfW - 20;
      const padTop = halfH + 68;
      const padBottom = canvasSize.height - halfH - 92;
      const influenceR = Math.max(washCardHeight * 0.96, 122);
      const minPairDist = washCardWidth * (bodies.length > 50 ? 0.36 : 0.45);
      const gathering = washGatheringRef.current;

      let brushEnergy = 0;

      if (gathering) {
        const targetX = ribbonGeom.startX;
        const targetY = ribbonGeom.baseY;
        const pull = 1 - Math.pow(0.82, step);
        for (let i = 0; i < bodies.length; i++) {
          const c = bodies[i];
          const dx = targetX - c.x;
          const dy = targetY - c.y;
          c.x += dx * pull;
          c.y += dy * pull;
          c.vx *= 0.7;
          c.vy *= 0.7;
          // Normalize angle smoothly toward nearest 0 mod 360
          const normAngle = ((c.angle % 360) + 540) % 360 - 180;
          c.angle = normAngle * Math.pow(0.8, step);
        }
      } else {
        // Multi-touch finger impulses & realistic off-center torque spin
        for (let pIdx = 0; pIdx < pointers.length; pIdx++) {
          const p = pointers[pIdx];
          const fingerSpeed = Math.hypot(p.vx, p.vy);

          for (let i = 0; i < bodies.length; i++) {
            const c = bodies[i];
            const dx = c.x - p.x;
            const dy = c.y - p.y;
            const dist = Math.hypot(dx, dy);

            if (dist < influenceR) {
              const falloff = Math.pow(1 - dist / influenceR, 1.15);
              // Tangential velvet drag with finger
              c.vx += p.vx * falloff * 0.26 * step;
              c.vy += p.vy * falloff * 0.26 * step;

              // Radial parting push
              if (dist > 1) {
                const push = (1.55 + fingerSpeed * 0.14) * falloff * step;
                c.vx += (dx / dist) * push;
                c.vy += (dy / dist) * push;
              }

              // 2D cross-product torque spin
              const torque = (dx * p.vy - dy * p.vx) / (influenceR * 1.25);
              c.vAngle += torque * falloff * 0.75 * step;

              brushEnergy += fingerSpeed * falloff;

              if (dist < influenceR * 0.5 && fingerSpeed > 2.2) {
                washZCounterRef.current += 1;
                c.zIndex = washZCounterRef.current;
              }
            }
          }

          // Decay stored pointer velocity smoothly if finger pauses on felt
          p.vx *= Math.pow(0.76, step);
          p.vy *= Math.pow(0.76, step);
        }

        // Gentle card-to-card anti-clump spacing (561 pairs — negligible cost)
        for (let i = 0; i < bodies.length; i++) {
          const a = bodies[i];
          for (let j = i + 1; j < bodies.length; j++) {
            const b = bodies[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dSq = dx * dx + dy * dy;
            if (dSq > 0.2 && dSq < minPairDist * minPairDist) {
              const dist = Math.sqrt(dSq);
              const overlap = (minPairDist - dist) / minPairDist;
              const repulse = overlap * 0.32 * step;
              const nx = dx / dist;
              const ny = dy / dist;
              a.vx -= nx * repulse;
              a.vy -= ny * repulse;
              b.vx += nx * repulse;
              b.vy += ny * repulse;
            }
          }
        }

        // Integrate motion, apply velvet friction & soft altar border cushion bounce
        for (let i = 0; i < bodies.length; i++) {
          const c = bodies[i];
          c.x += c.vx * step;
          c.y += c.vy * step;
          c.angle += c.vAngle * step;

          c.vx *= damping;
          c.vy *= damping;
          c.vAngle *= angDamping;

          if (c.x < padLeft) {
            c.x = padLeft;
            c.vx = Math.abs(c.vx) * 0.52;
            c.vAngle += (Math.random() - 0.5) * 2;
          } else if (c.x > padRight) {
            c.x = padRight;
            c.vx = -Math.abs(c.vx) * 0.52;
            c.vAngle += (Math.random() - 0.5) * 2;
          }

          if (c.y < padTop) {
            c.y = padTop;
            c.vy = Math.abs(c.vy) * 0.52;
            c.vAngle += (Math.random() - 0.5) * 2;
          } else if (c.y > padBottom) {
            c.y = padBottom;
            c.vy = -Math.abs(c.vy) * 0.52;
            c.vAngle += (Math.random() - 0.5) * 2;
          }
        }
      }

      // Apply GPU transform directly to DOM nodes
      for (let i = 0; i < bodies.length; i++) {
        const el = washCardElsRef.current[i];
        if (!el) continue;
        const c = bodies[i];
        el.style.transform = `translate3d(${(c.x - halfW).toFixed(1)}px, ${(
          c.y - halfH
        ).toFixed(1)}px, 0) rotate(${c.angle.toFixed(1)}deg)`;
        el.style.zIndex = String(c.zIndex);
      }

      // Rate-limited papery felt brush audio & subtle haptics
      if (!gathering && brushEnergy > 10) {
        if (now - washLastAudioMsRef.current > 80) {
          washLastAudioMsRef.current = now;
          soundEngine.playHoverTick(soundEnabled);
        }
        if (now - washLastHapticMsRef.current > 155) {
          washLastHapticMsRef.current = now;
          triggerHaptic(4);
        }
      }

      washRafRef.current = window.requestAnimationFrame(stepPhysics);
    };

    washRafRef.current = window.requestAnimationFrame(stepPhysics);
    return () => {
      if (washRafRef.current !== null) {
        window.cancelAnimationFrame(washRafRef.current);
        washRafRef.current = null;
      }
    };
  }, [
    canvasSize.height,
    canvasSize.width,
    initWashBodies,
    phase,
    ribbonGeom.baseY,
    ribbonGeom.startX,
    soundEnabled,
    triggerHaptic,
    washCardHeight,
    washCardIds,
    washCardWidth,
  ]);

  const syncWashPointerDots = useCallback(() => {
    setWashPointerDots(
      Array.from(washPointersRef.current.values()).map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
      }))
    );
  }, []);

  const handleWashPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (washGatheringRef.current) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      washPointersRef.current.set(e.pointerId, {
        id: e.pointerId,
        x,
        y,
        vx: 0,
        vy: 0,
        lastTime: performance.now(),
      });
      syncWashPointerDots();
      soundEngine.playHoverTick(soundEnabled);
      triggerHaptic(5);
    },
    [soundEnabled, syncWashPointerDots, triggerHaptic]
  );

  const handleWashPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (washGatheringRef.current) return;
      const existing = washPointersRef.current.get(e.pointerId);
      if (!existing) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const now = performance.now();
      const dtScale = clamp(16.67 / Math.max(4, now - existing.lastTime), 0.35, 2.2);
      const rawVx = clamp((x - existing.x) * dtScale, -52, 52);
      const rawVy = clamp((y - existing.y) * dtScale, -52, 52);

      existing.vx = existing.vx * 0.35 + rawVx * 0.65;
      existing.vy = existing.vy * 0.35 + rawVy * 0.65;
      existing.x = x;
      existing.y = y;
      existing.lastTime = now;
      syncWashPointerDots();
    },
    [syncWashPointerDots]
  );

  const handleWashPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      washPointersRef.current.delete(e.pointerId);
      syncWashPointerDots();
    },
    [syncWashPointerDots]
  );

  // =========================================================================
  // Card Placement & Drawing Helpers
  // =========================================================================
  const findNearestEmptySlot = useCallback(
    (xPct: number, yPct: number, thresholdPct = 11): number | null => {
      if (!activeSpread) return null;
      const compactForRibbon = phase !== "focus";
      const occupied = new Set(placedCardsRef.current.map((c) => c.slotIndex));
      let bestIdx: number | null = null;
      let bestDist = thresholdPct;

      for (const slot of activeSpread.slots) {
        if (occupied.has(slot.index)) continue;
        const pos = mapSlotToTable(slot, compactForRibbon);
        const dist = Math.hypot(xPct - pos.xPct, yPct - pos.yPct);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = slot.index;
        }
      }
      return bestIdx;
    },
    [activeSpread, phase]
  );

  const formatGhostTransform = useCallback((x: number, y: number, vx: number) => {
    const halfW = (placedCardDimsRef.current.w * placedCardScaleRef.current) / 2;
    const halfH = (placedCardDimsRef.current.h * placedCardScaleRef.current) / 2;
    return `translate3d(${(x - halfW).toFixed(1)}px, ${(y - halfH).toFixed(
      1
    )}px, 0) rotate(${(vx * 0.55).toFixed(1)}deg) scale(1.06)`;
  }, []);

  const drawCardOntoTable = useCallback(
    (
      cardId: string,
      manualDrop?: { xPct: number; yPct: number; snapSlotIndex: number | null }
    ) => {
      const currentPlaced = placedCardsRef.current;
      if (currentPlaced.some((c) => c.cardId === cardId)) return;

      const compactForRibbon = phase !== "focus";
      let slotIndex = currentPlaced.length;
      let xPct = 50;
      let yPct = 42;
      let rotation = 0;
      let userManuallyPlaced = false;

      if (manualDrop && manualDrop.snapSlotIndex !== null && activeSpread) {
        const targetSlot = activeSpread.slots[manualDrop.snapSlotIndex];
        if (targetSlot) {
          const mapped = mapSlotToTable(targetSlot, compactForRibbon);
          slotIndex = targetSlot.index;
          xPct = mapped.xPct;
          yPct = mapped.yPct;
          rotation = mapped.rotation;
        }
      } else if (manualDrop) {
        // Dropped freely anywhere on the cloth
        const occupied = new Set(currentPlaced.map((c) => c.slotIndex));
        const nextUnusedPresetSlot = activeSpread?.slots.find(
          (s) => !occupied.has(s.index)
        );
        slotIndex = nextUnusedPresetSlot
          ? nextUnusedPresetSlot.index
          : currentPlaced.reduce((m, c) => Math.max(m, c.slotIndex), -1) + 1;
        xPct = clamp(manualDrop.xPct, 9, 91);
        yPct = clamp(manualDrop.yPct, 14, compactForRibbon ? 72 : 84);
        rotation = (Math.random() - 0.5) * 4;
        userManuallyPlaced = true;
      } else if (activeSpread) {
        // Auto-place into next empty spread slot (or clarifier free spot if full)
        const occupied = new Set(currentPlaced.map((c) => c.slotIndex));
        const nextSlot = activeSpread.slots.find((s) => !occupied.has(s.index));
        if (nextSlot) {
          const mapped = mapSlotToTable(nextSlot, compactForRibbon);
          slotIndex = nextSlot.index;
          xPct = mapped.xPct;
          yPct = mapped.yPct;
          rotation = mapped.rotation;
        } else {
          slotIndex =
            currentPlaced.reduce((m, c) => Math.max(m, c.slotIndex), -1) + 1;
          const freePos = computeFreeSlotPosition(
            currentPlaced.length,
            compactForRibbon
          );
          xPct = freePos.xPct;
          yPct = freePos.yPct;
          rotation = freePos.rotation;
          userManuallyPlaced = true;
        }
      } else {
        // Free mode tap draw
        slotIndex =
          currentPlaced.reduce((m, c) => Math.max(m, c.slotIndex), -1) + 1;
        const freePos = computeFreeSlotPosition(
          currentPlaced.length,
          compactForRibbon
        );
        xPct = freePos.xPct;
        yPct = freePos.yPct;
        rotation = freePos.rotation;
      }

      maxZRef.current += 1;
      const uid = `${cardId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const reversed = allowReversed ? Math.random() < 0.32 : false;

      if (userManuallyPlaced) {
        movedByUserRef.current.add(uid);
      }

      const nextCard: TablePlacedCard = {
        uid,
        cardId,
        slotIndex,
        reversed,
        revealed: false,
        xPct,
        yPct,
        rotation,
        zIndex: maxZRef.current,
      };

      soundEngine.playCardDraw(soundEnabled);
      triggerHaptic(14);

      onPlacedCardsChange((prev) => {
        const updated = [...prev, nextCard];
        if (
          activeSpread &&
          updated.length === activeSpread.cardCount &&
          activeSpread.slots.every((s) =>
            updated.some((c) => c.slotIndex === s.index)
          )
        ) {
          scheduleTimer(() => soundEngine.playChime(soundEnabled), 240);
        }
        return updated;
      });
    },
    [
      activeSpread,
      allowReversed,
      onPlacedCardsChange,
      phase,
      scheduleTimer,
      soundEnabled,
      triggerHaptic,
    ]
  );

  // =========================================================================
  // Phase C: Silk Ribbon Pointer Gestures (Sweep, Hover-Glide, Tap, Pull-Up)
  // =========================================================================
  const ribbonGestureRef = useRef<{
    active: boolean;
    pointerId: number | null;
    mode: "undecided" | "sweep" | "glide" | "pull";
    startX: number;
    startY: number;
    lastX: number;
    lastTime: number;
    velocityX: number;
    initialProgress: number;
    initialDir: "ltr" | "rtl";
    hitIdx: number | null;
    pullCardId: string | null;
  }>({
    active: false,
    pointerId: null,
    mode: "undecided",
    startX: 0,
    startY: 0,
    lastX: 0,
    lastTime: 0,
    velocityX: 0,
    initialProgress: 0,
    initialDir: "ltr",
    hitIdx: null,
    pullCardId: null,
  });

  const findRibbonCardAtPoint = useCallback(
    (localX: number, localY: number, progress: number, dir: "ltr" | "rtl"): number | null => {
      const total = ribbonCardsRef.current.length;
      if (total === 0) return null;
      const halfW = ribbonCardWidthRef.current * 0.56;
      const halfH = ribbonCardHeightRef.current * 0.62;

      // Check top-most z-order card first
      for (let i = total - 1; i >= 0; i--) {
        const pos = getRibbonCardTransform(i, total, progress, dir);
        if (
          Math.abs(localX - pos.x) <= halfW &&
          Math.abs(localY - pos.y) <= halfH + 26
        ) {
          return i;
        }
      }

      // Fallback nearest x if inside vertical ribbon corridor
      if (localY >= ribbonGeomRef.current.baseY - ribbonCardHeightRef.current && progress > 0.25) {
        let closestIdx = 0;
        let closestDist = Infinity;
        for (let i = 0; i < total; i++) {
          const pos = getRibbonCardTransform(i, total, progress, dir);
          const d = Math.abs(localX - pos.x);
          if (d < closestDist) {
            closestDist = d;
            closestIdx = i;
          }
        }
        return closestDist < ribbonCardWidthRef.current * 1.1 ? closestIdx : null;
      }
      return null;
    },
    [getRibbonCardTransform]
  );

  const handleRibbonPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (ribbonCardsRef.current.length === 0) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      stopRibbonAnim();
      e.currentTarget.setPointerCapture(e.pointerId);

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const currentProgress = spreadProgressRef.current;
      const currentDir = ribbonDirectionRef.current;
      const hitIdx = findRibbonCardAtPoint(x, y, currentProgress, currentDir);

      ribbonGestureRef.current = {
        active: true,
        pointerId: e.pointerId,
        mode: currentProgress < 0.36 ? "sweep" : "undecided",
        startX: x,
        startY: y,
        lastX: x,
        lastTime: performance.now(),
        velocityX: 0,
        initialProgress: currentProgress,
        initialDir: currentDir,
        hitIdx,
        pullCardId: null,
      };

      if (currentProgress >= 0.36 && hitIdx !== null) {
        setHoveredRibbonIdx(hitIdx);
        soundEngine.playHoverTick(soundEnabled);
      }
    },
    [findRibbonCardAtPoint, soundEnabled, stopRibbonAnim]
  );

  const handleRibbonPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const g = ribbonGestureRef.current;

      // Desktop mouse hover preview when not dragging
      if (!g.active) {
        if (spreadProgressRef.current > 0.35 && e.pointerType === "mouse") {
          const hoverIdx = findRibbonCardAtPoint(
            x,
            y,
            spreadProgressRef.current,
            ribbonDirectionRef.current
          );
          if (hoverIdx !== hoveredRibbonIdxRef.current) {
            setHoveredRibbonIdx(hoverIdx);
            if (hoverIdx !== null) {
              soundEngine.playHoverTick(soundEnabled);
            }
          }
        }
        return;
      }

      if (g.pointerId !== e.pointerId) return;

      const now = performance.now();
      const dt = Math.max(4, now - g.lastTime);
      const vx = ((x - g.lastX) / dt) * 16;
      g.velocityX = g.velocityX * 0.4 + vx * 0.6;
      g.lastX = x;
      g.lastTime = now;

      const dx = x - g.startX;
      const dy = y - g.startY;
      const dist = Math.hypot(dx, dy);

      // Classify undecided gesture once pointer travels > 10px
      if (g.mode === "undecided" && dist > 10) {
        if (dy < -14 && Math.abs(dy) >= Math.abs(dx) * 0.72 && g.hitIdx !== null) {
          const pickedId = ribbonCardsRef.current[g.hitIdx];
          if (pickedId) {
            g.mode = "pull";
            g.pullCardId = pickedId;
            ghostPosRef.current = { x, y, vx: clamp(g.velocityX, -22, 22) };
            setHoveredRibbonIdx(null);
            setRibbonGhost({ cardId: pickedId, ribbonIdx: g.hitIdx });
            soundEngine.playHoverTick(soundEnabled);
            triggerHaptic(8);
          }
        } else if (g.initialProgress < 0.88) {
          g.mode = "sweep";
        } else {
          g.mode = "glide";
        }
      }

      // Mode 1: Horizontal Silk Sweep — 0 re-renders/frame via direct DOM writes!
      if (g.mode === "sweep") {
        let dir = g.initialDir;
        let nextProgress = g.initialProgress;
        const effectiveSpan = Math.max(180, ribbonGeomRef.current.spanX * 0.76);

        if (g.initialProgress < 0.1) {
          if (dx < -10) {
            dir = "rtl";
            nextProgress = clamp(Math.abs(dx) / effectiveSpan, 0, 1);
          } else {
            dir = "ltr";
            nextProgress = clamp(dx / effectiveSpan, 0, 1);
          }
        } else if (dir === "ltr") {
          nextProgress = clamp(g.initialProgress + dx / effectiveSpan, 0, 1);
        } else {
          nextProgress = clamp(g.initialProgress - dx / effectiveSpan, 0, 1);
        }

        ribbonLiveDriveRef.current = true;
        spreadProgressRef.current = nextProgress;
        ribbonDirectionRef.current = dir;
        applyRibbonTransformsToDom(nextProgress, dir, true);

        const nextStage = getSpreadUiStage(nextProgress);
        if (nextStage !== lastSpreadUiStageRef.current) {
          lastSpreadUiStageRef.current = nextStage;
          setRibbonDirection(dir);
          setSpreadProgress(nextProgress);
        }

        const bucket = Math.floor(
          nextProgress * Math.max(1, ribbonCardsRef.current.length)
        );
        if (bucket !== lastRibbonTickBucketRef.current) {
          lastRibbonTickBucketRef.current = bucket;
          soundEngine.playHoverTick(soundEnabled);
          if (bucket % 2 === 0) triggerHaptic(4);
        }
        return;
      }

      // Mode 2: Finger-glide across fanned ribbon to feel each card — pull upward anytime to draw!
      if (g.mode === "glide") {
        const hoverIdx = findRibbonCardAtPoint(
          x,
          y,
          spreadProgressRef.current,
          ribbonDirectionRef.current
        );
        if (hoverIdx !== hoveredRibbonIdxRef.current) {
          setHoveredRibbonIdx(hoverIdx);
          if (hoverIdx !== null) {
            g.hitIdx = hoverIdx;
            soundEngine.playHoverTick(soundEnabled);
            triggerHaptic(4);
          }
        }

        // Pull upward while gliding -> seamlessly grab the focused card off the ribbon!
        if (
          y < ribbonGeomRef.current.baseY - ribbonCardHeightRef.current * 0.72 &&
          g.hitIdx !== null
        ) {
          const pickedId = ribbonCardsRef.current[g.hitIdx];
          if (pickedId) {
            g.mode = "pull";
            g.pullCardId = pickedId;
            ghostPosRef.current = { x, y, vx: clamp(g.velocityX, -22, 22) };
            setHoveredRibbonIdx(null);
            setRibbonGhost({ cardId: pickedId, ribbonIdx: g.hitIdx });
            soundEngine.playHoverTick(soundEnabled);
            triggerHaptic(8);
          }
        }
        return;
      }

      // Mode 3: Dragging a pulled ghost card across the velvet cloth — 0 re-renders/frame!
      if (g.mode === "pull" && g.pullCardId) {
        const clampedVx = clamp(g.velocityX, -22, 22);
        ghostPosRef.current.x = x;
        ghostPosRef.current.y = y;
        ghostPosRef.current.vx = clampedVx;

        if (ghostElRef.current) {
          ghostElRef.current.style.transform = formatGhostTransform(
            x,
            y,
            clampedVx
          );
        }

        const xPct = (x / Math.max(1, canvasSizeRef.current.width)) * 100;
        const yPct = (y / Math.max(1, canvasSizeRef.current.height)) * 100;
        const snapSlotIndex = findNearestEmptySlot(xPct, yPct, 11);
        if (snapSlotIndex !== dragHoverSlotIdxRef.current) {
          dragHoverSlotIdxRef.current = snapSlotIndex;
          setDragHoverSlotIdx(snapSlotIndex);
        }
      }
    },
    [
      applyRibbonTransformsToDom,
      findNearestEmptySlot,
      findRibbonCardAtPoint,
      formatGhostTransform,
      soundEnabled,
      triggerHaptic,
    ]
  );

  const handleRibbonPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const g = ribbonGestureRef.current;
      if (!g.active || g.pointerId !== e.pointerId) return;
      g.active = false;
      g.pointerId = null;

      const rect = canvasRef.current?.getBoundingClientRect();
      const x = rect ? e.clientX - rect.left : g.startX;
      const y = rect ? e.clientY - rect.top : g.startY;
      const moved = Math.hypot(x - g.startX, y - g.startY);

      if (g.mode === "sweep") {
        const cur = spreadProgressRef.current;
        const dir = ribbonDirectionRef.current;
        const speedMatch =
          (dir === "ltr" && g.velocityX > 8) ||
          (dir === "rtl" && g.velocityX < -8);
        if (cur > 0.52 || (cur > 0.2 && speedMatch)) {
          animateSpreadProgress(1, 420);
        } else if (cur < 0.16) {
          animateSpreadProgress(0, 260);
        } else {
          ribbonLiveDriveRef.current = false;
          lastSpreadUiStageRef.current = getSpreadUiStage(cur);
          applyRibbonTransformsToDom(cur, dir, false);
          setRibbonDirection(dir);
          setSpreadProgress(cur);
        }
        return;
      }

      if (g.mode === "pull" && g.pullCardId) {
        const xPct = (x / Math.max(1, canvasSizeRef.current.width)) * 100;
        const yPct = (y / Math.max(1, canvasSizeRef.current.height)) * 100;
        const pulledHighEnough =
          y < ribbonGeomRef.current.baseY - ribbonCardHeightRef.current * 0.45;
        setRibbonGhost(null);
        if (dragHoverSlotIdxRef.current !== null) {
          dragHoverSlotIdxRef.current = null;
          setDragHoverSlotIdx(null);
        }

        if (pulledHighEnough) {
          const snapSlot = findNearestEmptySlot(xPct, yPct, 12);
          drawCardOntoTable(g.pullCardId, {
            xPct,
            yPct,
            snapSlotIndex: snapSlot,
          });
        } else {
          // Released back into ribbon — cancel gently
          soundEngine.playHoverTick(soundEnabled);
        }
        return;
      }

      // Quick tap on a ribbon card when ribbon is spread -> auto-draw onto table!
      if (moved <= 10 && spreadProgressRef.current > 0.35 && g.hitIdx !== null) {
        const tappedCardId = ribbonCardsRef.current[g.hitIdx];
        if (tappedCardId) {
          setHoveredRibbonIdx(null);
          drawCardOntoTable(tappedCardId);
        }
        return;
      }

      setHoveredRibbonIdx(null);
    },
    [
      animateSpreadProgress,
      applyRibbonTransformsToDom,
      drawCardOntoTable,
      findNearestEmptySlot,
      soundEnabled,
    ]
  );

  // =========================================================================
  // Phase D & Persistent Tabletop: Zero-Rerender Placed Card Drag & Actions
  // =========================================================================
  const cardDragRef = useRef<{
    uid: string | null;
    pointerId: number | null;
    startX: number;
    startY: number;
    origXPct: number;
    origYPct: number;
    origZIndex: number;
    curXPct: number;
    curYPct: number;
    curPx: number;
    curPy: number;
    dragScale: number;
    dragRotate: number;
    elevatedZ: number;
    hasDragged: boolean;
    el: HTMLDivElement | null;
  }>({
    uid: null,
    pointerId: null,
    startX: 0,
    startY: 0,
    origXPct: 0,
    origYPct: 0,
    origZIndex: 20,
    curXPct: 0,
    curYPct: 0,
    curPx: 0,
    curPy: 0,
    dragScale: 1,
    dragRotate: 0,
    elevatedZ: 20,
    hasDragged: false,
    el: null,
  });

  const handlePlacedCardPointerDown = useCallback(
    (uid: string, e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      if (spreadMenuOpenRef.current) {
        setSpreadMenuOpen(false);
      }

      const card = placedCardsRef.current.find((c) => c.uid === uid);
      if (!card) return;

      const dims = placedCardDimsRef.current;
      const size = canvasSizeRef.current;
      const startPx = (card.xPct / 100) * size.width - dims.w / 2;
      const startPy = (card.yPct / 100) * size.height - dims.h / 2;
      const effectiveRot = card.rotation + (querentFacingRef.current ? 180 : 0);

      // Do NOT mutate zIndex / call onPlacedCardsChange on pointerdown — 0 renders on tap!
      cardDragRef.current = {
        uid: card.uid,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origXPct: card.xPct,
        origYPct: card.yPct,
        origZIndex: card.zIndex,
        curXPct: card.xPct,
        curYPct: card.yPct,
        curPx: startPx,
        curPy: startPy,
        dragScale: placedCardScaleRef.current * 1.06,
        dragRotate: effectiveRot + 2,
        elevatedZ: card.zIndex,
        hasDragged: false,
        el: e.currentTarget,
      };
    },
    []
  );

  const handlePlacedCardPointerMove = useCallback(
    (uid: string, e: React.PointerEvent<HTMLDivElement>) => {
      const drag = cardDragRef.current;
      if (drag.uid !== uid || drag.pointerId !== e.pointerId) return;

      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const dist = Math.hypot(dx, dy);

      let justStartedDrag = false;
      if (!drag.hasDragged && dist > 8) {
        drag.hasDragged = true;
        justStartedDrag = true;
        activeDraggingUidRef.current = uid;
        movedByUserRef.current.add(uid);
        maxZRef.current += 1;
        drag.elevatedZ = maxZRef.current;

        const ctrl = placedCardControlsRef.current.get(uid);
        ctrl?.stop();

        if (drag.el) {
          drag.el.style.zIndex = "900";
          drag.el.style.cursor = "grabbing";
        }
        if (selectedCardUidRef.current !== null) {
          setSelectedCardUid(null);
        }
        triggerHaptic(6);
      }

      if (drag.hasDragged) {
        const size = canvasSizeRef.current;
        const dims = placedCardDimsRef.current;
        const nextX = clamp(
          drag.origXPct + (dx / Math.max(1, size.width)) * 100,
          6,
          94
        );
        const nextY = clamp(
          drag.origYPct + (dy / Math.max(1, size.height)) * 100,
          10,
          90
        );
        const px = (nextX / 100) * size.width - dims.w / 2;
        const py = (nextY / 100) * size.height - dims.h / 2;

        drag.curXPct = nextX;
        drag.curYPct = nextY;
        drag.curPx = px;
        drag.curPy = py;

        // Keep Framer Motion MotionValues aligned on the initial drag frame (in case selection cleared)
        if (justStartedDrag) {
          placedCardControlsRef.current
            .get(uid)
            ?.jumpTo(px, py, drag.dragScale, drag.dragRotate);
        }

        // Direct GPU transform write — 0 React re-renders, 0 onPlacedCardsChange calls!
        if (drag.el) {
          drag.el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(
            1
          )}px, 0) scale(${drag.dragScale.toFixed(4)}) rotate(${drag.dragRotate.toFixed(
            1
          )}deg)`;
        }

        const nearSlot = findNearestEmptySlot(nextX, nextY, 5.5);
        if (nearSlot !== dragHoverSlotIdxRef.current) {
          dragHoverSlotIdxRef.current = nearSlot;
          setDragHoverSlotIdx(nearSlot);
        }
      }
    },
    [findNearestEmptySlot, triggerHaptic]
  );

  const handlePlacedCardPointerUp = useCallback(
    (uid: string, e: React.PointerEvent<HTMLDivElement>) => {
      const drag = cardDragRef.current;
      if (drag.uid !== uid || drag.pointerId !== e.pointerId) return;

      const wasDrag = drag.hasDragged;
      const finalXPct = drag.curXPct;
      const finalYPct = drag.curYPct;
      const finalPx = drag.curPx;
      const finalPy = drag.curPy;
      const dragScale = drag.dragScale;
      const dragRotate = drag.dragRotate;
      const elevatedZ = drag.elevatedZ;
      const el = drag.el;

      drag.uid = null;
      drag.pointerId = null;
      drag.hasDragged = false;
      drag.el = null;
      activeDraggingUidRef.current = null;

      if (wasDrag) {
        if (el) {
          el.style.cursor = "grab";
          el.style.zIndex = String(elevatedZ);
        }

        // Sync Framer MotionValues to exact drop coordinates before committing state
        placedCardControlsRef.current
          .get(uid)
          ?.jumpTo(finalPx, finalPy, dragScale, dragRotate);

        if (dragHoverSlotIdxRef.current !== null) {
          dragHoverSlotIdxRef.current = null;
          setDragHoverSlotIdx(null);
        }

        // Soft snap only if released very close to an empty spread slot
        const snapSlot = findNearestEmptySlot(finalXPct, finalYPct, 5);
        const slotDef =
          snapSlot !== null && activeSpread ? activeSpread.slots[snapSlot] : null;

        if (slotDef) {
          const mapped = mapSlotToTable(slotDef, phase !== "focus");
          movedByUserRef.current.delete(uid);
          // Single batched state commit on pointerup with snapped slot + elevated zIndex
          onPlacedCardsChange((prev) =>
            prev.map((c) =>
              c.uid === uid
                ? {
                    ...c,
                    slotIndex: slotDef.index,
                    xPct: mapped.xPct,
                    yPct: mapped.yPct,
                    rotation: mapped.rotation,
                    zIndex: elevatedZ,
                  }
                : c
            )
          );
        } else {
          // Single batched state commit on pointerup with final free position + elevated zIndex
          onPlacedCardsChange((prev) =>
            prev.map((c) =>
              c.uid === uid
                ? {
                    ...c,
                    xPct: finalXPct,
                    yPct: finalYPct,
                    zIndex: elevatedZ,
                  }
                : c
            )
          );
        }

        soundEngine.playHoverTick(soundEnabled);
        triggerHaptic(8);
        return;
      }

      // Tap interaction (<= 8px)
      const placed = placedCardsRef.current.find((c) => c.uid === uid);
      if (!placed) return;
      const tarotCard = getCardById(placed.cardId);
      if (!tarotCard) return;

      if (!placed.revealed) {
        // Flip face-down card right on the cloth and immediately focus it for bottom-right reading popup
        clearFlipDelays();
        triggerHaptic(16);
        setSelectedCardUid(placed.uid);
        setFloatReadingTab("general");
        onPlacedCardsChange((prev) =>
          prev.map((c) => (c.uid === placed.uid ? { ...c, revealed: true } : c))
        );
        return;
      }

      // Tap on face-up card: double-tap -> 360° Inspector; single-tap -> toggle mini action pill
      const now = performance.now();
      if (
        lastTapRef.current.uid === placed.uid &&
        now - lastTapRef.current.ts < 340
      ) {
        lastTapRef.current = { uid: "", ts: 0 };
        setSelectedCardUid(null);
        soundEngine.playHoverTick(soundEnabled);
        onInspectCard(tarotCard, placed.reversed);
      } else {
        lastTapRef.current = { uid: placed.uid, ts: now };
        soundEngine.playHoverTick(soundEnabled);
        setSelectedCardUid((cur) => (cur === placed.uid ? null : placed.uid));
      }
    },
    [
      activeSpread,
      clearFlipDelays,
      findNearestEmptySlot,
      onInspectCard,
      onPlacedCardsChange,
      phase,
      soundEnabled,
      triggerHaptic,
    ]
  );

  const handlePlacedCardPointerCancel = useCallback((uid: string) => {
    const drag = cardDragRef.current;
    if (drag.uid !== uid) return;

    const wasDrag = drag.hasDragged;
    const origZ = drag.origZIndex;
    const curPx = drag.curPx;
    const curPy = drag.curPy;
    const dragScale = drag.dragScale;
    const dragRotate = drag.dragRotate;
    const el = drag.el;

    drag.uid = null;
    drag.pointerId = null;
    drag.hasDragged = false;
    drag.el = null;
    activeDraggingUidRef.current = null;

    if (wasDrag) {
      if (el) {
        el.style.zIndex = String(origZ);
        el.style.cursor = "grab";
      }
      const ctrl = placedCardControlsRef.current.get(uid);
      ctrl?.jumpTo(curPx, curPy, dragScale, dragRotate);
      ctrl?.springBack();
    }

    if (dragHoverSlotIdxRef.current !== null) {
      dragHoverSlotIdxRef.current = null;
      setDragHoverSlotIdx(null);
    }
  }, []);

  const handlePlacedCardKeyDown = useCallback(
    (uid: string, e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      const placed = placedCardsRef.current.find((c) => c.uid === uid);
      if (!placed) return;
      if (!placed.revealed) {
        clearFlipDelays();
        onPlacedCardsChange((prev) =>
          prev.map((c) => (c.uid === uid ? { ...c, revealed: true } : c))
        );
      } else {
        setSelectedCardUid((cur) => (cur === uid ? null : uid));
      }
    },
    [clearFlipDelays, onPlacedCardsChange]
  );

  // Single-Batch Cascading Reveal All (1 React commit instead of N sequential commits!)
  const handleRevealAll = useCallback(() => {
    const unrevealedUids = placedCardsRef.current
      .filter((c) => !c.revealed)
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .map((c) => c.uid);

    if (unrevealedUids.length === 0) return;
    setSelectedCardUid(null);

    const nextDelays: Record<string, number> = {};
    unrevealedUids.forEach((uid, idx) => {
      nextDelays[uid] = Number((idx * 0.11).toFixed(2));
    });
    hasFlipDelaysRef.current = true;
    setFlipDelays(nextDelays);

    const revealSet = new Set(unrevealedUids);
    onPlacedCardsChange((prev) =>
      prev.map((c) => (revealSet.has(c.uid) ? { ...c, revealed: true } : c))
    );

    // Lightweight staggered sound & haptic schedule matching the 0.11s flip cascade
    unrevealedUids.forEach((_, idx) => {
      scheduleTimer(() => {
        soundEngine.playCardFlip(soundEnabled);
        triggerHaptic(10);
      }, idx * 115);
    });

    const chimeDelayMs = (unrevealedUids.length - 1) * 110 + 480;
    scheduleTimer(() => {
      soundEngine.playChime(soundEnabled);
      setSelectedCardUid(unrevealedUids[0] ?? null);
      setFloatReadingTab("general");
    }, chimeDelayMs);
  }, [onPlacedCardsChange, scheduleTimer, soundEnabled, triggerHaptic]);

  // Tidy / re-align cards into spread slots
  const handleAlignSpread = useCallback(() => {
    if (!activeSpread || placedCardsRef.current.length === 0) return;
    const compactForRibbon = phase !== "focus";
    movedByUserRef.current.clear();
    soundEngine.playCardDraw(soundEnabled);
    triggerHaptic(10);

    onPlacedCardsChange((prev) =>
      prev.map((c, idx) => {
        const slot = activeSpread.slots[c.slotIndex] ?? activeSpread.slots[idx];
        if (!slot) return c;
        const mapped = mapSlotToTable(slot, compactForRibbon);
        return {
          ...c,
          slotIndex: slot.index,
          xPct: mapped.xPct,
          yPct: mapped.yPct,
          rotation: mapped.rotation,
        };
      })
    );
  }, [activeSpread, onPlacedCardsChange, phase, soundEnabled, triggerHaptic]);

  // Card mini-action handlers
  const handleToggleCardReversed = useCallback(
    (uid: string) => {
      soundEngine.playHoverTick(soundEnabled);
      triggerHaptic(10);
      onPlacedCardsChange((prev) =>
        prev.map((c) => (c.uid === uid ? { ...c, reversed: !c.reversed } : c))
      );
    },
    [onPlacedCardsChange, soundEnabled, triggerHaptic]
  );

  const handleFlipCardBackDown = useCallback(
    (uid: string) => {
      clearFlipDelays();
      triggerHaptic(10);
      setSelectedCardUid(null);
      onPlacedCardsChange((prev) =>
        prev.map((c) => (c.uid === uid ? { ...c, revealed: false } : c))
      );
    },
    [clearFlipDelays, onPlacedCardsChange, triggerHaptic]
  );

  const handleRemoveCard = useCallback(
    (uid: string) => {
      soundEngine.playHoverTick(soundEnabled);
      triggerHaptic(10);
      setSelectedCardUid(null);
      movedByUserRef.current.delete(uid);
      onPlacedCardsChange((prev) => prev.filter((c) => c.uid !== uid));
    },
    [onPlacedCardsChange, soundEnabled, triggerHaptic]
  );

  const handleSelectSpread = useCallback(
    (nextSpread: TableSpreadId) => {
      soundEngine.playHoverTick(soundEnabled);
      triggerHaptic(8);
      setSpreadMenuOpen(false);
      onSpreadChange(nextSpread);

      // Gently re-align existing cards if user picks a preset spread and cards exist
      if (nextSpread !== "free" && placedCardsRef.current.length > 0) {
        const def = getSpreadById(nextSpread);
        const compactForRibbon = phase !== "focus";
        movedByUserRef.current.clear();
        onPlacedCardsChange((prev) =>
          prev.map((c, idx) => {
            const slot = def.slots[idx];
            if (!slot) return c;
            const mapped = mapSlotToTable(slot, compactForRibbon);
            return {
              ...c,
              slotIndex: slot.index,
              xPct: mapped.xPct,
              yPct: mapped.yPct,
              rotation: mapped.rotation,
            };
          })
        );
      }
    },
    [onPlacedCardsChange, onSpreadChange, phase, soundEnabled, triggerHaptic]
  );

  const handleResetAll = useCallback(() => {
    stopRibbonAnim();
    clearFlipDelays();
    soundEngine.playShuffle(soundEnabled);
    triggerHaptic(14);
    setSelectedCardUid(null);
    setSpreadMenuOpen(false);
    setRibbonGhost(null);
    dragHoverSlotIdxRef.current = null;
    setDragHoverSlotIdx(null);
    movedByUserRef.current.clear();
    const reshuffled = fisherYates(activePoolCardIds);
    setDeckOrder(reshuffled);
    setWashCardIds(reshuffled);
    spreadProgressRef.current = 0;
    ribbonDirectionRef.current = "ltr";
    lastSpreadUiStageRef.current = 0;
    setRibbonDirection("ltr");
    setSpreadProgress(0);
    setPhase("stack");
    onResetTable();
  }, [
    activePoolCardIds,
    clearFlipDelays,
    onResetTable,
    soundEnabled,
    stopRibbonAnim,
    triggerHaptic,
  ]);

  // Preset spread slots mapped to tabletop coordinates
  const mappedSlots = useMemo(() => {
    if (!activeSpread) return [];
    const compactForRibbon = phase !== "focus";
    const occupied = new Set(placedCards.map((c) => c.slotIndex));
    const nextEmptySlotIndex =
      activeSpread.slots.find((s) => !occupied.has(s.index))?.index ?? null;

    return activeSpread.slots.map((slot) => ({
      slot,
      ...mapSlotToTable(slot, compactForRibbon),
      occupied: occupied.has(slot.index),
      isNext: slot.index === nextEmptySlotIndex,
    }));
  }, [activeSpread, phase, placedCards]);

  const allSpreadSlotsFilled = Boolean(
    activeSpread &&
      activeSpread.slots.every((s) =>
        placedCards.some((c) => c.slotIndex === s.index)
      )
  );

  const selectedPlacedCard = useMemo(
    () => placedCards.find((c) => c.uid === selectedCardUid) ?? null,
    [placedCards, selectedCardUid]
  );
  const selectedTarotCard = useMemo(
    () => (selectedPlacedCard ? getCardById(selectedPlacedCard.cardId) ?? null : null),
    [selectedPlacedCard]
  );
  const revealedOrderedCards = useMemo(
    () =>
      placedCards
        .filter((c) => c.revealed)
        .sort((a, b) =>
          activeSpread
            ? a.slotIndex - b.slotIndex
            : a.xPct - b.xPct || a.yPct - b.yPct
        ),
    [activeSpread, placedCards]
  );
  const selectedRevealedIdx = useMemo(() => {
    if (!selectedPlacedCard) return -1;
    return revealedOrderedCards.findIndex((c) => c.uid === selectedPlacedCard.uid);
  }, [revealedOrderedCards, selectedPlacedCard]);
  const selectedSlotMeta = useMemo(() => {
    if (!selectedPlacedCard || !activeSpread) return null;
    return activeSpread.slots[selectedPlacedCard.slotIndex] ?? null;
  }, [activeSpread, selectedPlacedCard]);

  const handleCycleSelectedCard = useCallback(
    (delta: -1 | 1) => {
      if (revealedOrderedCards.length <= 1 || selectedRevealedIdx < 0) return;
      const nextIdx =
        (selectedRevealedIdx + delta + revealedOrderedCards.length) %
        revealedOrderedCards.length;
      const nextCard = revealedOrderedCards[nextIdx];
      if (!nextCard) return;
      soundEngine.playHoverTick(soundEnabled);
      setSelectedCardUid(nextCard.uid);
    },
    [revealedOrderedCards, selectedRevealedIdx, soundEnabled]
  );

  // Compute clamped position for floating mini action pill on selected card
  const selectedActionPos = useMemo(() => {
    if (!selectedPlacedCard) return null;
    const cardPxX = (selectedPlacedCard.xPct / 100) * canvasSize.width;
    const cardPxY = (selectedPlacedCard.yPct / 100) * canvasSize.height;
    const halfH = (placedCardDims.h * placedCardScale) / 2;
    const showAbove = cardPxY + halfH + 62 > canvasSize.height - 64;
    const y = showAbove
      ? clamp(cardPxY - halfH - 46, 68, canvasSize.height - 90)
      : clamp(cardPxY + halfH + 14, 72, canvasSize.height - 86);
    const x = clamp(cardPxX, 146, canvasSize.width - 146);
    return { x, y };
  }, [
    canvasSize.height,
    canvasSize.width,
    placedCardDims.h,
    placedCardScale,
    selectedPlacedCard,
  ]);

  // Stack position: dead center if table is empty, lower-center if cards are already laid out
  const stackCenterY =
    placedCards.length === 0 ? "50%" : isCompactPhone ? "74%" : "72%";

  return (
    <div
      ref={canvasRef}
      onPointerDown={() => {
        if (selectedCardUid) setSelectedCardUid(null);
        if (spreadMenuOpen) setSpreadMenuOpen(false);
      }}
      className="relative h-[100dvh] w-[100dvw] overflow-hidden select-none"
      style={{
        touchAction: "none",
        overscrollBehavior: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      {/* =====================================================================
          LAYER 0: Unified Photorealistic ClothStage renders persistently behind
          this transparent canvas (fabric weave, folds, embroidery, gold hem,
          candlelight, grazing sheen, particles & vignette).
         ===================================================================== */}

      {/* =====================================================================
          LAYER 1 (z-10): Etched Golden Spread Slot Outlines on Cloth (Pure GPU x/y)
         ===================================================================== */}
      {activeSpread && phase !== "wash" ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10"
        >
          {mappedSlots.map(({ slot, xPct, yPct, rotation, occupied, isNext }) => {
            const isDropHighlight = dragHoverSlotIdx === slot.index;
            const slotW = Math.round(placedCardDims.w * placedCardScale);
            const slotH = Math.round(placedCardDims.h * placedCardScale);
            const slotX = (xPct / 100) * canvasSize.width - slotW / 2;
            const slotY = (yPct / 100) * canvasSize.height - slotH / 2;

            return (
              <motion.div
                key={`slot-${activeSpread.id}-${slot.index}`}
                initial={false}
                animate={{
                  x: slotX,
                  y: slotY,
                  rotate: rotation + (querentFacing ? 180 : 0),
                  scale: isDropHighlight ? 1.07 : 1,
                  opacity: occupied ? 0.24 : isDropHighlight ? 1 : isNext ? 0.92 : 0.56,
                }}
                transition={{ type: "spring", stiffness: 260, damping: 28 }}
                className="absolute top-0 left-0 rounded-[11px]"
                style={{
                  width: slotW,
                  height: slotH,
                  border: `1.5px dashed ${
                    isDropHighlight || isNext ? accentStrong : accentColor
                  }`,
                  backgroundColor: isDropHighlight
                    ? `${accentColor}24`
                    : isNext
                      ? `${accentColor}12`
                      : "transparent",
                  boxShadow: isDropHighlight
                    ? `0 0 28px ${accentColor}66, inset 0 0 18px ${accentColor}30`
                    : isNext
                      ? `0 0 18px ${accentColor}30`
                      : "none",
                }}
              >
                <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center">
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold"
                    style={{
                      borderColor: `${accentColor}75`,
                      backgroundColor: `${accentColor}1c`,
                      color: accentStrong,
                    }}
                  >
                    {slot.index + 1}
                  </span>
                  <span
                    className="mt-1.5 line-clamp-2 font-serif text-[10px] font-medium tracking-wider sm:text-[11px]"
                    style={{
                      color: isDropHighlight || isNext ? accentStrong : "var(--text-secondary)",
                    }}
                  >
                    {slot.labelZh}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : null}

      {/* =====================================================================
          LAYER 2 (z-20): Placed Interactive 3D Tarot Cards on Velvet Cloth
         ===================================================================== */}
      <div
        className={`absolute inset-0 z-20 transition-opacity duration-300 ${
          phase === "wash" ? "pointer-events-none opacity-30" : "opacity-100"
        }`}
      >
        <AnimatePresence>
          {placedCards.map((placed) => {
            const tarotCard = getCardById(placed.cardId);
            if (!tarotCard) return null;

            const slotDef = activeSpread?.slots[placed.slotIndex];

            return (
              <PlacedTableCardItem
                key={placed.uid}
                placed={placed}
                tarotCard={tarotCard}
                deckId={deckId}
                themeId={themeId}
                isLightTheme={theme.isLight}
                accentColor={accentColor}
                accentStrong={accentStrong}
                placedCardSize={placedCardSize}
                placedCardScale={placedCardScale}
                cardWidth={placedCardDims.w}
                cardHeight={placedCardDims.h}
                canvasWidth={canvasSize.width}
                canvasHeight={canvasSize.height}
                querentFacing={querentFacing}
                cleanMode={cleanMode}
                gyroEnabled={gyroEnabled}
                soundEnabled={soundEnabled}
                isSelected={selectedCardUid === placed.uid}
                flipDelay={flipDelays[placed.uid] ?? 0}
                slotIndexLabel={slotDef?.index}
                slotLabelZh={slotDef?.labelZh}
                slotRotation={slotDef?.rotation}
                activeDraggingUidRef={activeDraggingUidRef}
                registerControl={registerPlacedCardControl}
                onPointerDown={handlePlacedCardPointerDown}
                onPointerMove={handlePlacedCardPointerMove}
                onPointerUp={handlePlacedCardPointerUp}
                onPointerCancel={handlePlacedCardPointerCancel}
                onKeyDown={handlePlacedCardKeyDown}
              />
            );
          })}
        </AnimatePresence>
      </div>

      {/* =====================================================================
          MINI FLOATING ACTION PILL FOR SELECTED FACE-UP CARD (z-38)
         ===================================================================== */}
      <AnimatePresence>
        {selectedPlacedCard &&
        selectedTarotCard &&
        selectedPlacedCard.revealed &&
        selectedActionPos &&
        phase !== "wash" ? (
          <motion.div
            key={`actions-${selectedPlacedCard.uid}`}
            initial={{ opacity: 0, scale: 0.9, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 4 }}
            transition={{ duration: 0.18 }}
            onPointerDown={(e) => e.stopPropagation()}
            className="uranai-glass-strong absolute z-[38] flex -translate-x-1/2 items-center gap-1 rounded-full px-1.5 py-1 shadow-2xl"
            style={{
              left: selectedActionPos.x,
              top: selectedActionPos.y,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setSelectedCardUid(null);
                onInspectCard(selectedTarotCard, selectedPlacedCard.reversed);
              }}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--accent-contrast)] transition hover:brightness-110 active:scale-95"
            >
              <Sparkles className="h-3 w-3" />
              360° 赏析
            </button>
            <button
              type="button"
              onClick={() => handleToggleCardReversed(selectedPlacedCard.uid)}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-primary)] transition hover:bg-[var(--accent-soft)] active:scale-95"
            >
              <RotateCw className="h-3 w-3 text-[var(--accent)]" />
              旋转正逆
            </button>
            <button
              type="button"
              onClick={() => handleFlipCardBackDown(selectedPlacedCard.uid)}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--text-primary)] active:scale-95"
            >
              <FlipHorizontal2 className="h-3 w-3" />
              盖回
            </button>
            <button
              type="button"
              onClick={() => handleRemoveCard(selectedPlacedCard.uid)}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-[11px] font-medium transition hover:bg-rose-500/20 active:scale-95 ${
                theme.isLight ? "text-rose-700" : "text-rose-300"
              }`}
              title="移出桌面"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* =====================================================================
          BOTTOM-RIGHT FLOATING BASIC INTERPRETATION POPUP FOR SELECTED CARD (z-42)
         ===================================================================== */}
      <AnimatePresence>
        {selectedPlacedCard &&
        selectedTarotCard &&
        selectedPlacedCard.revealed &&
        phase !== "wash" ? (
          <motion.aside
            key={`reading-float-${selectedPlacedCard.uid}`}
            initial={{ opacity: 0, y: 18, scale: 0.96, rotate: querentFacing ? 180 : 0 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: querentFacing ? 180 : 0 }}
            exit={{ opacity: 0, y: 14, scale: 0.96, rotate: querentFacing ? 180 : 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={`${selectedTarotCard.nameZh} 基础牌义浮窗`}
            style={{ position: "fixed" }}
            className={`uranai-glass-strong gold-shimmer-border pointer-events-auto fixed right-3 z-[42] flex w-[min(368px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl shadow-[0_18px_52px_rgba(0,0,0,0.55)] sm:right-5 ${
              phase === "ribbon"
                ? "bottom-[max(13.2rem,calc(env(safe-area-inset-bottom)+12.4rem))]"
                : "bottom-[max(4.5rem,calc(env(safe-area-inset-bottom)+3.75rem))] md:bottom-[max(1.25rem,env(safe-area-inset-bottom))]"
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 border-b border-[var(--border-subtle)] px-4 pt-3.5 pb-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent-strong)]">
                    {selectedSlotMeta
                      ? `${selectedPlacedCard.slotIndex + 1}. ${selectedSlotMeta.labelZh}`
                      : `第 ${selectedRevealedIdx >= 0 ? selectedRevealedIdx + 1 : 1} / ${revealedOrderedCards.length} 张`}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      selectedPlacedCard.reversed
                        ? theme.isLight
                          ? "border-amber-600/35 bg-amber-500/15 text-amber-900"
                          : "border-amber-400/35 bg-amber-400/15 text-amber-200"
                        : "border-emerald-400/35 bg-emerald-400/15 text-emerald-300"
                    }`}
                  >
                    {selectedPlacedCard.reversed ? "逆位" : "正位"}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {selectedTarotCard.element}
                    {selectedTarotCard.astrology ? ` · ${selectedTarotCard.astrology}` : ""}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <h3 className="font-display truncate text-base font-semibold tracking-wide text-[var(--text-primary)]">
                    {selectedTarotCard.romanNumeral
                      ? `${selectedTarotCard.romanNumeral} · `
                      : ""}
                    {selectedTarotCard.nameZh}
                  </h3>
                  <span className="truncate text-[11px] text-[var(--text-muted)]">
                    {selectedTarotCard.nameEn}
                  </span>
                </div>
                {selectedSlotMeta ? (
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--text-muted)]">
                    {selectedSlotMeta.description}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {revealedOrderedCards.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleCycleSelectedCard(-1)}
                      aria-label="上一张已翻牌"
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/75 text-[var(--text-secondary)] transition hover:border-[var(--border-accent)] hover:text-[var(--text-primary)] active:scale-95"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCycleSelectedCard(1)}
                      aria-label="下一张已翻牌"
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/75 text-[var(--text-secondary)] transition hover:border-[var(--border-accent)] hover:text-[var(--text-primary)] active:scale-95"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSelectedCardUid(null)}
                  aria-label="关闭基础解析浮窗"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/75 text-[var(--text-secondary)] transition hover:border-[var(--border-accent)] hover:text-[var(--text-primary)] active:scale-95"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Keywords */}
            <div className="flex flex-wrap gap-1.5 px-4 pt-2.5">
              {(selectedPlacedCard.reversed
                ? selectedTarotCard.keywordsReversed
                : selectedTarotCard.keywordsUpright
              ).map((kw) => (
                <span
                  key={kw}
                  className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/75 px-2.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]"
                >
                  {kw}
                </span>
              ))}
            </div>

            {/* Aspect Mini Tabs */}
            <div className="flex items-center gap-1 px-4 pt-2.5">
              {(
                [
                  { id: "general", label: "基础" },
                  { id: "love", label: "爱情" },
                  { id: "career", label: "事业" },
                  { id: "wealth", label: "财富" },
                  { id: "advice", label: "指引" },
                ] as const
              ).map((tab) => {
                const active = floatReadingTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playHoverTick(soundEnabled);
                      setFloatReadingTab(tab.id);
                    }}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                      active
                        ? "bg-[var(--accent)] text-[var(--accent-contrast)] shadow-sm"
                        : "bg-[var(--bg-surface)]/65 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Scrollable Meaning Body */}
            <div
              className="max-h-[168px] overflow-y-auto overscroll-contain px-4 py-2.5 text-xs leading-relaxed text-[var(--text-secondary)]"
              style={{ touchAction: "pan-y" }}
            >
              <p>
                {floatReadingTab === "general"
                  ? selectedPlacedCard.reversed
                    ? selectedTarotCard.meaningReversed
                    : selectedTarotCard.meaningUpright
                  : floatReadingTab === "love"
                    ? selectedPlacedCard.reversed
                      ? selectedTarotCard.loveReversed
                      : selectedTarotCard.loveUpright
                    : floatReadingTab === "career"
                      ? selectedPlacedCard.reversed
                        ? selectedTarotCard.careerReversed
                        : selectedTarotCard.careerUpright
                      : floatReadingTab === "wealth"
                        ? selectedPlacedCard.reversed
                          ? selectedTarotCard.wealthReversed
                          : selectedTarotCard.wealthUpright
                        : selectedPlacedCard.reversed
                          ? selectedTarotCard.adviceReversed
                          : selectedTarotCard.adviceUpright}
              </p>
              {floatReadingTab === "general" || floatReadingTab === "advice" ? (
                <p className="mt-2 border-l-2 border-[var(--border-accent)] pl-2.5 font-serif text-[11px] italic text-[var(--accent-strong)]">
                  “{selectedTarotCard.affirmation}”
                </p>
              ) : null}
            </div>

            {/* Footer Quick Actions */}
            <div className="flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]/50 px-3.5 py-2.5">
              <button
                type="button"
                onClick={() => {
                  onInspectCard(selectedTarotCard, selectedPlacedCard.reversed);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/80 px-3 py-1.5 text-[11px] font-medium text-[var(--text-primary)] transition hover:border-[var(--border-accent)] hover:bg-[var(--accent-soft)] active:scale-95"
              >
                <Orbit className="h-3.5 w-3.5 text-[var(--accent)]" />
                360° 赏析
              </button>
              <button
                type="button"
                onClick={onOpenDrawer}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-[11px] font-semibold text-[var(--accent-contrast)] shadow-[0_4px_16px_var(--cloth-glow)] transition hover:brightness-110 active:scale-95"
              >
                <BookOpen className="h-3.5 w-3.5" />
                AI 深度综合解牌
              </button>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>

      {/* =====================================================================
          PHASE A (z-28): Physical 3D Stacked Tarot Deck (Stack / Riffle / Cut)
         ===================================================================== */}
      <AnimatePresence>
        {phase === "stack" ? (
          <motion.div
            key="phase-stack"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.22 } }}
            onPointerDown={(e) => e.stopPropagation()}
            className="pointer-events-none absolute inset-0 z-[28]"
          >
            <div
              className="pointer-events-auto absolute left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ top: stackCenterY }}
            >
              {/* Ambient warm glow beneath physical stack (zero-filter radial gradient) */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  background: `radial-gradient(circle, ${clothGlow} 0%, transparent 70%)`,
                  opacity: 0.95,
                }}
              />

              {/* 3D Physical Thick Deck Stack */}
              <button
                type="button"
                onClick={handleRiffleShuffle}
                aria-label="点击交错洗牌"
                className="group relative cursor-pointer outline-none"
                style={{
                  width: deckCardWidth,
                  height: deckCardHeight,
                }}
              >
                {/* Ground velvet shadow */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-1 rounded-[12px]"
                  style={{
                    transform: "translate(6px, 14px)",
                    boxShadow: "0 22px 44px rgba(0,0,0,0.68)",
                  }}
                />

                {stackVisualLayers.map((layer) => {
                  const isUpperHalf = layer >= Math.floor(stackVisualLayers.length / 2);
                  const isTopCard = layer === stackVisualLayers.length - 1;
                  const baseShiftX = -layer * 0.42;
                  const baseShiftY = -layer * 0.9;

                  let animX: number | number[] = baseShiftX;
                  let animY: number | number[] = baseShiftY;
                  let animRot: number | number[] = 0;

                  if (deckAnim === "riffle") {
                    const side = layer % 2 === 0 ? -1 : 1;
                    const spreadDist = deckCardWidth * 0.62;
                    animX = [
                      baseShiftX,
                      side * spreadDist,
                      side * (spreadDist * 0.35),
                      baseShiftX,
                    ];
                    animY = [
                      baseShiftY,
                      baseShiftY - 8 - (layer % 3) * 3,
                      baseShiftY - 4,
                      baseShiftY,
                    ];
                    animRot = [0, side * 9, side * 3, 0];
                  } else if (deckAnim === "cut") {
                    const cutShift = deckCardWidth * 0.68;
                    animX = isUpperHalf
                      ? [baseShiftX, cutShift, cutShift * 0.9, baseShiftX]
                      : [baseShiftX, -cutShift * 0.65, -cutShift * 0.55, baseShiftX];
                    animY = isUpperHalf
                      ? [baseShiftY, baseShiftY - 16, baseShiftY + 4, baseShiftY]
                      : [baseShiftY, baseShiftY + 8, baseShiftY - 14, baseShiftY];
                    animRot = isUpperHalf ? [0, 5, 2, 0] : [0, -3, -1, 0];
                  }

                  return (
                    <motion.div
                      key={layer}
                      animate={{ x: animX, y: animY, rotate: animRot }}
                      transition={{
                        duration: deckAnim === "idle" ? 0.25 : 0.62,
                        ease: [0.22, 1, 0.36, 1],
                        delay: deckAnim === "riffle" ? layer * 0.012 : 0,
                      }}
                      className="absolute inset-0 overflow-hidden rounded-[11px]"
                      style={{
                        zIndex:
                          deckAnim === "cut" && !isUpperHalf
                            ? layer + stackVisualLayers.length + 4
                            : layer + 1,
                        border: `1px solid ${cardEdgeColor}${isTopCard ? "e6" : "99"}`,
                        backgroundColor: "#13111c",
                        boxShadow: isTopCard
                          ? "0 8px 24px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,250,225,0.28)"
                          : "0 1px 2px rgba(0,0,0,0.4)",
                      }}
                    >
                      {isTopCard || layer === stackVisualLayers.length - 2 ? (
                        <CardBackArtwork deckId={deckId} themeId={themeId} />
                      ) : (
                        <div
                          className="h-full w-full"
                          style={{
                            background: `linear-gradient(135deg, ${cardEdgeColor}88 0%, #2a2114 55%, ${cardEdgeColor}66 100%)`,
                          }}
                        />
                      )}
                    </motion.div>
                  );
                })}
              </button>

              {/* Subtle deck telemetry line */}
              {!cleanMode ? (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] tracking-wider text-[var(--text-secondary)]">
                  <span>
                    剩余 {availableCardIds.length} / {activePoolCardIds.length} 张
                  </span>
                  {onOpenDeckPoolModal ? (
                    <>
                      <span className="opacity-40">·</span>
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playHoverTick(soundEnabled);
                          onOpenDeckPoolModal();
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent-strong)] transition hover:brightness-110 active:scale-95"
                      >
                        <Filter className="h-2.5 w-2.5" />
                        <span>{deckPoolShortLabel}</span>
                      </button>
                    </>
                  ) : null}
                  {shuffleCount > 0 ? (
                    <>
                      <span className="opacity-40">·</span>
                      <span className="text-[var(--accent-strong)]">
                        已洗牌 {shuffleCount} 次
                      </span>
                    </>
                  ) : null}
                </div>
              ) : null}

              {/* Tactile Ritual Actions around the Stack */}
              {!cleanMode ? (
                <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2 px-3">
                  <button
                    type="button"
                    onClick={handleEnterWash}
                    className="uranai-pill-solid inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-accent)] hover:bg-[var(--accent-soft)] active:scale-95"
                  >
                    <Hand className="h-3.5 w-3.5 text-[var(--accent)]" />
                    桌布揉洗
                  </button>

                  <button
                    type="button"
                    onClick={handleRiffleShuffle}
                    disabled={deckAnim !== "idle"}
                    className="uranai-pill-solid inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-accent)] hover:bg-[var(--accent-soft)] active:scale-95 disabled:opacity-50"
                  >
                    <Shuffle className="h-3.5 w-3.5 text-[var(--accent)]" />
                    交错洗牌
                  </button>

                  <button
                    type="button"
                    onClick={handleCutDeck}
                    disabled={deckAnim !== "idle"}
                    className="uranai-pill-solid inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-accent)] hover:bg-[var(--accent-soft)] active:scale-95 disabled:opacity-50"
                  >
                    <Scissors className="h-3.5 w-3.5 text-[var(--accent)]" />
                    切牌
                  </button>

                  <button
                    type="button"
                    onClick={() => handleEnterRibbon(false)}
                    disabled={deckAnim !== "idle" || availableCardIds.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-accent)] bg-[var(--accent)] px-4 py-2 text-xs font-semibold tracking-wide text-[var(--accent-contrast)] shadow-[0_6px_24px_var(--cloth-glow)] transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                  >
                    <GalleryHorizontalEnd className="h-3.5 w-3.5" />
                    拂动摊牌
                  </button>
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* =====================================================================
          PHASE B (z-32): 60fps Multi-Touch 2D Physics Wash Shuffle on Cloth
         ===================================================================== */}
      {phase === "wash" ? (
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            handleWashPointerDown(e);
          }}
          onPointerMove={handleWashPointerMove}
          onPointerUp={handleWashPointerUp}
          onPointerCancel={handleWashPointerUp}
          className="absolute inset-0 z-[32] touch-none"
          style={{ cursor: "grab" }}
        >
          {/* Instructional floating ritual whisper */}
          {!cleanMode ? (
            <div className="pointer-events-none absolute top-[max(4.5rem,calc(env(safe-area-inset-top)+3.75rem))] left-1/2 z-[120] -translate-x-1/2">
              <div className="uranai-pill-solid flex items-center gap-2 rounded-full px-4 py-1.5 text-xs text-[var(--text-primary)]">
                <Orbit className="h-3.5 w-3.5 animate-spin text-[var(--accent)] [animation-duration:9s]" />
                <span className="whitespace-nowrap">
                  {isGatheringWash
                    ? `正在聚拢全部 ${washCardIds.length} 张牌并按揉洗顺序整牌…`
                    : `正在桌上揉洗全部 ${washCardIds.length} 张牌 · 单手或双手画圈搓揉`}
                </span>
              </div>
            </div>
          ) : null}

          {/* True Full-Pool GPU-accelerated face-down cards driven directly via rAF (isolated z-0 stacking context) */}
          <div className="pointer-events-none absolute inset-0 z-0 isolate">
            {washCardIds.map((cardId, idx) => (
              <div
                key={`wash-card-${cardId}`}
                ref={(el) => {
                  washCardElsRef.current[idx] = el;
                }}
                className="pointer-events-none absolute top-0 left-0 overflow-hidden rounded-[8px] will-change-transform"
                style={{
                  width: washCardWidth,
                  height: washCardHeight,
                  border: `1px solid ${cardEdgeColor}cc`,
                  boxShadow: "0 6px 16px rgba(0,0,0,0.44)",
                  transform: `translate3d(${(
                    canvasSize.width * 0.5 -
                    washCardWidth * 0.5
                  ).toFixed(1)}px, ${(
                    canvasSize.height * 0.5 -
                    washCardHeight * 0.5
                  ).toFixed(1)}px, 0)`,
                }}
              >
                <CardBackArtwork deckId={deckId} themeId={themeId} lightweight />
              </div>
            ))}
          </div>

          {/* Warm golden fingertip contact halos for multi-touch feedback */}
          {washPointerDots.map((dot) => (
            <div
              key={dot.id}
              aria-hidden="true"
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: dot.x,
                top: dot.y,
                width: 96,
                height: 96,
                background: `radial-gradient(circle, ${accentStrong}40 0%, ${accentColor}14 48%, transparent 72%)`,
                border: `1px solid ${accentColor}44`,
              }}
            />
          ))}

          {/* Floating Bottom Controls for Wash Phase */}
          {!cleanMode ? (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="pointer-events-auto absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[125] flex -translate-x-1/2 items-center gap-2.5"
            >
              <button
                type="button"
                onClick={handleScatterWashAgain}
                disabled={isGatheringWash}
                className="uranai-pill-solid inline-flex items-center gap-1.5 rounded-full px-3.5 py-2.5 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-accent)] active:scale-95 disabled:opacity-45"
              >
                <Shuffle className="h-3.5 w-3.5 text-[var(--accent)]" />
                重新打散
              </button>

              <button
                type="button"
                onClick={handleGatherWashToRibbon}
                disabled={isGatheringWash}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-accent)] bg-[var(--accent)] px-5 py-2.5 text-xs font-semibold tracking-wide text-[var(--accent-contrast)] shadow-[0_8px_28px_var(--cloth-glow)] transition hover:brightness-110 active:scale-95 disabled:opacity-60"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {isGatheringWash ? "正在聚拢整牌…" : "聚拢整牌并准备摊牌"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* =====================================================================
          PHASE C (z-30): Interactive Finger-Sweep Silk Ribbon Spread & Draw
         ===================================================================== */}
      <AnimatePresence>
        {phase === "ribbon" ? (
          <motion.div
            key="phase-ribbon"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40, transition: { duration: 0.24 } }}
            className="pointer-events-none absolute inset-0 z-30"
          >
            {/* Interactive Ribbon Touch Strip at Lower Cloth */}
            <div
              onPointerDown={(e) => {
                e.stopPropagation();
                handleRibbonPointerDown(e);
              }}
              onPointerMove={handleRibbonPointerMove}
              onPointerUp={handleRibbonPointerUp}
              onPointerCancel={handleRibbonPointerUp}
              onPointerLeave={() => {
                if (!ribbonGestureRef.current.active) {
                  setHoveredRibbonIdx(null);
                }
              }}
              className="pointer-events-auto absolute inset-x-0 bottom-0 touch-none"
              style={{
                height: Math.min(
                  canvasSize.height * 0.36,
                  ribbonCardHeight + 132
                ),
                cursor:
                  spreadProgress < 0.36
                    ? "ew-resize"
                    : ribbonGhost
                      ? "grabbing"
                      : "pointer",
              }}
            />

            {/* Inviting Golden Guide Trail before Ribbon is Fully Spread */}
            {spreadProgress < 0.32 && !cleanMode ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0"
                style={{
                  top: ribbonGeom.baseY - ribbonGeom.arcLift - 38,
                }}
              >
                <svg
                  viewBox={`0 0 ${Math.max(320, canvasSize.width)} 88`}
                  className="h-[88px] w-full overflow-visible"
                >
                  <defs>
                    <linearGradient id="ribbon-sweep-trail" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor={accentStrong} stopOpacity="0.1" />
                      <stop offset="45%" stopColor={accentStrong} stopOpacity="0.85" />
                      <stop offset="100%" stopColor={accentColor} stopOpacity="0.2" />
                    </linearGradient>
                  </defs>
                  <path
                    d={`M ${ribbonGeom.startX + ribbonCardWidth * 0.4} 58 Q ${
                      canvasSize.width * 0.5
                    } 12 ${ribbonGeom.endX} 58`}
                    fill="none"
                    stroke="url(#ribbon-sweep-trail)"
                    strokeWidth="2"
                    strokeDasharray="6 6"
                  />
                  {/* Traveling golden spark inviting right sweep */}
                  <motion.circle
                    r="5"
                    fill={accentStrong}
                    initial={{ cx: ribbonGeom.startX + 36, cy: 50, opacity: 0 }}
                    animate={{
                      cx: [
                        ribbonGeom.startX + 36,
                        canvasSize.width * 0.5,
                        ribbonGeom.endX - 18,
                      ],
                      cy: [50, 34, 50],
                      opacity: [0, 1, 0],
                    }}
                    transition={{
                      duration: 2.1,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                </svg>

                <div className="mt-1 flex justify-center px-4">
                  <span className="uranai-pill-solid rounded-full px-4 py-1.5 text-center text-[11px] font-medium tracking-wide text-[var(--accent-strong)] shadow-lg sm:text-xs">
                    ✦ 用手指沿桌布向右拂动，将牌如丝带般摊开
                  </span>
                </div>
              </div>
            ) : null}

            {/* Ribbon Instruction Pill once spread */}
            {spreadProgress >= 0.36 && !ribbonGhost && !cleanMode ? (
              <div
                className="pointer-events-none absolute left-1/2 z-[115] -translate-x-1/2"
                style={{
                  top: Math.max(
                    86,
                    ribbonGeom.baseY - ribbonCardHeight * 0.5 - ribbonGeom.arcLift - 42
                  ),
                }}
              >
                <span className="uranai-pill-solid inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1 text-[11px] text-[var(--text-secondary)]">
                  <Sparkles className="h-3 w-3 text-[var(--accent)]" />
                  {hoveredRibbonIdx !== null
                    ? `已指向第 ${hoveredRibbonIdx + 1} / ${ribbonCards.length} 张 · 轻点或上拖出牌`
                    : allSpreadSlotsFilled
                      ? `牌阵已满（牌扇余 ${ribbonCards.length} 张）· 可继续补牌或专注桌面`
                      : activeSpread
                        ? `共展开 ${ribbonCards.length} 张牌 · 下一牌位：${
                            mappedSlots.find((s) => s.isNext)?.slot.labelZh ?? "补牌"
                          }`
                        : `共展开 ${ribbonCards.length} 张牌 · 轻点或向上拖出至绒布任意位置`}
                </span>
              </div>
            ) : null}

            {/* Full-Pool Overlapping Curved Silk Ribbon Cards (Ref-driven 0-rerender sweep) */}
            {ribbonCards.map((cardId, idx) => {
              const isBeingPulled = ribbonGhost?.cardId === cardId;
              const isLiveDriving = ribbonLiveDriveRef.current;
              const renderProgress = isLiveDriving
                ? spreadProgressRef.current
                : spreadProgress;
              const renderDir = isLiveDriving
                ? ribbonDirectionRef.current
                : ribbonDirection;
              const { x, y, angle } = getRibbonCardTransform(
                idx,
                ribbonCards.length,
                renderProgress,
                renderDir
              );
              const isFocused =
                !isLiveDriving &&
                renderProgress > 0.35 &&
                hoveredRibbonIdx === idx &&
                !isBeingPulled;

              return (
                <div
                  key={cardId}
                  ref={(el) => {
                    ribbonCardElsRef.current[idx] = el;
                  }}
                  aria-hidden="true"
                  className="pointer-events-none absolute top-0 left-0 overflow-hidden rounded-[9px]"
                  style={{
                    width: ribbonCardWidth,
                    height: ribbonCardHeight,
                    zIndex: isFocused ? ribbonCards.length + 24 : idx + 1,
                    opacity: isBeingPulled ? 0 : 1,
                    transform: `translate3d(${(
                      x -
                      ribbonCardWidth * 0.5
                    ).toFixed(1)}px, ${(
                      y -
                      ribbonCardHeight * 0.5 -
                      (isFocused ? 26 : 0)
                    ).toFixed(1)}px, 0) rotate(${angle.toFixed(1)}deg)${
                      isFocused ? " scale(1.1)" : ""
                    }`,
                    transition: isLiveDriving
                      ? "none"
                      : "transform 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 160ms ease",
                    border: `1px solid ${
                      isFocused ? accentStrong : `${cardEdgeColor}cc`
                    }`,
                    boxShadow: isFocused
                      ? `0 18px 34px rgba(0,0,0,0.62), 0 0 22px ${accentColor}75`
                      : "0 2px 4px rgba(0,0,0,0.38)",
                  }}
                >
                  <CardBackArtwork deckId={deckId} themeId={themeId} lightweight />
                </div>
              );
            })}

            {/* Ribbon Bottom Action Bar */}
            {!cleanMode ? (
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className="pointer-events-auto absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-[125] flex max-w-[94vw] -translate-x-1/2 items-center gap-1.5 sm:gap-2"
              >
                {spreadProgress < 0.88 ? (
                  <button
                    type="button"
                    onClick={() => animateSpreadProgress(1, 650)}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--border-accent)] bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--accent-contrast)] shadow-[0_6px_22px_var(--cloth-glow)] transition hover:brightness-110 active:scale-95"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    一键丝带摊牌
                  </button>
                ) : null}

                {spreadProgress > 0.12 ? (
                  <button
                    type="button"
                    onClick={() =>
                      animateSpreadProgress(0, 420, () => {
                        setHoveredRibbonIdx(null);
                      })
                    }
                    className="uranai-pill-solid inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-accent)] active:scale-95"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-[var(--accent)]" />
                    收拢牌堆
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPhase("stack")}
                    className="uranai-pill-solid inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-accent)] active:scale-95"
                  >
                    <Layers className="h-3.5 w-3.5 text-[var(--accent)]" />
                    返回叠牌
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleEnterWash}
                  className="uranai-pill-solid inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-accent)] active:scale-95"
                >
                  <Hand className="h-3.5 w-3.5 text-[var(--accent)]" />
                  <span className="hidden sm:inline">桌布搓牌</span>
                  <span className="sm:hidden">搓牌</span>
                </button>

                {placedCards.length > 0 ? (
                  <button
                    type="button"
                    onClick={handleEnterFocus}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold transition active:scale-95 ${
                      allSpreadSlotsFilled
                        ? "border border-[var(--border-accent)] bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[0_6px_22px_var(--cloth-glow)] hover:brightness-110"
                        : "uranai-pill-solid border-[var(--border-accent)] text-[var(--accent-strong)] hover:brightness-110"
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    收起牌扇 · 专注桌面
                  </button>
                ) : null}
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* =====================================================================
          LIVE DRAGGED GHOST CARD PULLED OFF RIBBON (z-35, Ref-driven 0-rerender)
         ===================================================================== */}
      {ribbonGhost ? (
        <div
          ref={ghostElRef}
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 z-[35] overflow-hidden rounded-[10px] will-change-transform"
          style={{
            width: Math.round(placedCardDims.w * placedCardScale),
            height: Math.round(placedCardDims.h * placedCardScale),
            transform: formatGhostTransform(
              ghostPosRef.current.x,
              ghostPosRef.current.y,
              ghostPosRef.current.vx
            ),
            border: `1.5px solid ${accentStrong}`,
            boxShadow: `0 22px 38px rgba(0,0,0,0.62), 0 0 24px ${accentColor}70`,
          }}
        >
          <CardBackArtwork deckId={deckId} themeId={themeId} />
        </div>
      ) : null}

      {/* =====================================================================
          PHASE D (z-34): Focus Mode Slim Bottom Action Dock
         ===================================================================== */}
      <AnimatePresence>
        {phase === "focus" && !cleanMode ? (
          <motion.div
            key="focus-dock"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            onPointerDown={(e) => e.stopPropagation()}
            className="pointer-events-auto absolute bottom-[max(0.85rem,env(safe-area-inset-bottom))] left-1/2 z-[34] flex max-w-[94vw] -translate-x-1/2 items-center gap-1.5 sm:gap-2"
          >
            {unrevealedCount > 0 ? (
              <button
                type="button"
                onClick={handleRevealAll}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--border-accent)] bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--accent-contrast)] shadow-[0_6px_24px_var(--cloth-glow)] transition hover:brightness-110 active:scale-95"
              >
                <Sparkles className="h-3.5 w-3.5" />
                一键全翻 ({unrevealedCount})
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => handleEnterRibbon(true)}
              disabled={availableCardIds.length === 0}
              className="uranai-pill-solid inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-accent)] hover:bg-[var(--accent-soft)] active:scale-95 disabled:opacity-45"
            >
              <GalleryHorizontalEnd className="h-3.5 w-3.5 text-[var(--accent)]" />
              重新展开牌扇
            </button>

            {activeSpread && placedCards.length > 0 ? (
              <button
                type="button"
                onClick={handleAlignSpread}
                className="uranai-pill-solid hidden items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-accent)] hover:text-[var(--text-primary)] active:scale-95 sm:inline-flex"
              >
                <Layers className="h-3.5 w-3.5 text-[var(--accent)]" />
                对齐牌阵
              </button>
            ) : null}

            {placedCards.length > 0 ? (
              <button
                type="button"
                onClick={handleResetAll}
                className="uranai-pill-solid inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:border-rose-400/45 hover:text-rose-200 active:scale-95"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">清空重来</span>
              </button>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* =====================================================================
          LAYER 4 (z-40): Discreet Corner Floating Controls / Zero-Chrome Toggle
         ===================================================================== */}
      {cleanMode ? (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto fixed top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-40 sm:right-5"
        >
          <button
            type="button"
            onClick={() => {
              soundEngine.playHoverTick(soundEnabled);
              setCleanMode(false);
            }}
            aria-label="退出纯净视图"
            title="恢复桌面控制栏"
            className="uranai-pill-solid flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] opacity-45 transition hover:opacity-100 hover:text-[var(--accent-strong)] active:scale-95"
          >
            <Eye className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-start justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5"
        >
          {/* TOP-LEFT CLUSTER */}
          <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Exit Tabletop */}
            <button
              type="button"
              onClick={onExit}
              className="uranai-pill-solid inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-accent)] active:scale-95"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span className="hidden sm:inline">退出桌面</span>
            </button>

            {/* Compact Spread Selector Pill + Floating Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playHoverTick(soundEnabled);
                  setSpreadMenuOpen((o) => !o);
                }}
                className="uranai-pill-solid inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-accent)] active:scale-95"
              >
                <Layers className="h-3.5 w-3.5 text-[var(--accent)]" />
                <span className="max-w-[96px] truncate sm:max-w-[132px]">
                  {activeSpread ? activeSpread.nameZh : "自由排布"}
                </span>
                {activeSpread ? (
                  <span className="rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent-strong)]">
                    {placedCards.length}/{activeSpread.cardCount}
                  </span>
                ) : placedCards.length > 0 ? (
                  <span className="rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent-strong)]">
                    {placedCards.length}
                  </span>
                ) : null}
                <ChevronDown
                  className={`h-3.5 w-3.5 text-[var(--text-muted)] transition-transform ${
                    spreadMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Spread Selector Popover (retains .uranai-glass-strong) */}
              <AnimatePresence>
                {spreadMenuOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.16 }}
                    className="uranai-glass-strong absolute top-11 left-0 z-50 w-64 overflow-hidden rounded-2xl p-1.5 shadow-2xl sm:w-72"
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectSpread("free")}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${
                        spreadId === "free"
                          ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                          : "text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/60"
                      }`}
                    >
                      <div>
                        <div className="text-xs font-semibold">自由排布</div>
                        <div className="text-[10px] text-[var(--text-muted)]">
                          不限张数 · 随心放置与补牌
                        </div>
                      </div>
                      {spreadId === "free" ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                      ) : null}
                    </button>

                    <div className="gold-divider my-1 opacity-55" />

                    <div className="max-h-[54vh] space-y-0.5 overflow-y-auto">
                      {SPREADS.map((sp) => {
                        const active = spreadId === sp.id;
                        return (
                          <button
                            key={sp.id}
                            type="button"
                            onClick={() => handleSelectSpread(sp.id)}
                            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${
                              active
                                ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                                : "text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/60"
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-1.5 text-xs font-semibold">
                                <span>{sp.nameZh}</span>
                                <span className="rounded-full border border-[var(--border-subtle)] px-1.5 py-0.2 text-[9px] font-normal text-[var(--text-muted)]">
                                  {sp.cardCount} 张 · {sp.difficulty}
                                </span>
                              </div>
                              <div className="truncate text-[10px] text-[var(--text-muted)]">
                                {sp.summary}
                              </div>
                            </div>
                            {active ? (
                              <Check className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            {/* Deck Pool / Divination Rules Switch Pill */}
            {onOpenDeckPoolModal ? (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playHoverTick(soundEnabled);
                  setSpreadMenuOpen(false);
                  onOpenDeckPoolModal();
                }}
                className="uranai-pill-solid inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-accent)] active:scale-95 sm:px-3"
                title="设置参与洗牌的牌池范围（全牌 78 张 / 仅大阿卡纳 / 仅小牌 / 花色 / 单张剔除）"
              >
                <Filter className="h-3.5 w-3.5 text-[var(--accent)]" />
                <span className="whitespace-nowrap">{deckPoolShortLabel}</span>
              </button>
            ) : null}

            {/* Cloth Theme Switch Pill */}
            <button
              type="button"
              onClick={onOpenClothSheet}
              className="uranai-pill-solid inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-accent)] active:scale-95 sm:px-3"
              title={`切换桌布（当前：${theme.clothNameZh}）`}
            >
              <span
                className="h-3.5 w-3.5 rounded-full border border-white/30 shadow-inner"
                style={{
                  background: `linear-gradient(135deg, ${theme.swatches[1]} 0%, ${theme.swatches[2]} 100%)`,
                }}
              />
              <span className="hidden md:inline">换桌布</span>
            </button>

            {/* Deck Switch Pill */}
            <button
              type="button"
              onClick={onOpenDeckSheet}
              className="uranai-pill-solid inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-accent)] active:scale-95 sm:px-3"
              title={`切换卡组（当前：${deck.nameZh}）`}
            >
              <Palette className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span className="hidden sm:inline">
                {deckId === "mucha-hamster" ? "穆夏仓鼠" : "伟特"}
              </span>
            </button>
          </div>

          {/* TOP-RIGHT CLUSTER */}
          <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
            {/* Screen Wake Lock Indicator */}
            {wakeLockActive ? (
              <div
                title="屏幕常亮已开启，桌布不会自动息屏"
                className="uranai-pill-solid hidden h-9 items-center gap-1.5 rounded-full px-2.5 text-[11px] text-[var(--text-secondary)] md:inline-flex"
              >
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)]" />
                <span>常亮</span>
              </div>
            ) : null}

            {/* Querent-Facing 180° Toggle */}
            <button
              type="button"
              onClick={() => {
                soundEngine.playHoverTick(soundEnabled);
                triggerHaptic(10);
                onToggleQuerentFacing();
              }}
              title="对坐翻转：将桌面卡牌旋转 180° 面向桌对面来访者"
              className={`inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition active:scale-95 sm:px-3 ${
                querentFacing
                  ? "border border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[0_0_16px_var(--cloth-glow)]"
                  : "uranai-pill-solid text-[var(--text-primary)] hover:border-[var(--border-accent)]"
              }`}
            >
              <FlipVertical2 className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">
                {querentFacing ? "对坐 180°" : "对坐翻转"}
              </span>
            </button>

            {/* Fullscreen Toggle */}
            {canFullscreen ? (
              <button
                type="button"
                onClick={onToggleFullscreen}
                title={isFullscreen ? "退出全屏" : "全屏桌布模式"}
                className="uranai-pill-solid hidden h-9 w-9 items-center justify-center rounded-full text-[var(--text-primary)] transition hover:border-[var(--border-accent)] active:scale-95 sm:inline-flex"
              >
                {isFullscreen ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
              </button>
            ) : null}

            {/* Clean / Zero-Chrome Ritual View Toggle */}
            <button
              type="button"
              onClick={() => {
                soundEngine.playHoverTick(soundEnabled);
                setSelectedCardUid(null);
                setSpreadMenuOpen(false);
                setCleanMode(true);
              }}
              title="纯净视图：隐藏全部控制栏，专注沉浸式桌面仪式"
              className="uranai-pill-solid inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] transition hover:border-[var(--border-accent)] hover:text-[var(--text-primary)] active:scale-95"
            >
              <EyeOff className="h-3.5 w-3.5" />
            </button>

            {/* Prominent Golden Reading & AI Drawer CTA */}
            <button
              type="button"
              onClick={() => {
                soundEngine.playHoverTick(soundEnabled);
                onOpenDrawer();
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--border-accent)] bg-[var(--accent)] px-3.5 text-xs font-semibold tracking-wide text-[var(--accent-contrast)] shadow-[0_6px_22px_var(--cloth-glow)] transition hover:brightness-110 active:scale-95"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>解牌 & AI</span>
              <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[10px] font-bold">
                {revealedCount}/{placedCards.length}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Subtle Querent-Facing Indicator Pill (when active and not cleanMode) */}
      {querentFacing && !cleanMode ? (
        <div className="pointer-events-none fixed top-[max(3.6rem,calc(env(safe-area-inset-top)+2.85rem))] right-3 z-[36] sm:right-5">
          <span className="uranai-pill-solid inline-flex items-center gap-1.5 rounded-full border border-[var(--border-accent)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--accent-strong)]">
            <RotateCw className="h-2.5 w-2.5" />
            对坐视角 · 桌面牌面已翻转 180°
          </span>
        </div>
      ) : null}
    </div>
  );
});
