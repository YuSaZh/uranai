"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
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
  SpreadSlot,
  TarotCard,
  ThemeId,
} from "@/types/tarot";
import { TAROT_CARDS, getCardById } from "@/data/tarot-cards";
import { SPREADS, getSpreadById } from "@/data/spreads";
import { getThemeById } from "@/data/themes";
import { getDeckById } from "@/data/decks";
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

interface RibbonDragGhost {
  cardId: string;
  ribbonIdx: number;
  x: number;
  y: number;
  vx: number;
  snapSlotIndex: number | null;
}

type DeckAnimState = "idle" | "riffle" | "cut";

const WASH_CARD_COUNT = 34;
const RIBBON_MAX_CARDS = 32;
const STACK_VISUAL_LAYERS = Array.from({ length: 11 }, (_, i) => i);

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

export function VirtualTableCanvas({
  deckId,
  themeId,
  spreadId,
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

  // Shuffled 78-card deck order (deterministic initial for SSR, immediately Fisher-Yates shuffled on mount)
  const [deckOrder, setDeckOrder] = useState<string[]>(() =>
    TAROT_CARDS.map((c) => c.id)
  );

  // Ribbon phase states
  const [spreadProgress, setSpreadProgress] = useState<number>(0);
  const [ribbonDirection, setRibbonDirection] = useState<"ltr" | "rtl">("ltr");
  const [hoveredRibbonIdx, setHoveredRibbonIdx] = useState<number | null>(null);
  const [ribbonGhost, setRibbonGhost] = useState<RibbonDragGhost | null>(null);

  // Placed card interaction states
  const [selectedCardUid, setSelectedCardUid] = useState<string | null>(null);
  const [floatReadingTab, setFloatReadingTab] = useState<
    "general" | "love" | "career" | "wealth" | "advice"
  >("general");
  const [draggingCardUid, setDraggingCardUid] = useState<string | null>(null);
  const [dragHoverSlotIdx, setDragHoverSlotIdx] = useState<number | null>(null);
  const [isGatheringWash, setIsGatheringWash] = useState<boolean>(false);

  // Refs for physics, gestures, timers, and latest state
  const maxZRef = useRef<number>(20);
  const movedByUserRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<number[]>([]);
  const ribbonAnimRafRef = useRef<number | null>(null);
  const spreadProgressRef = useRef<number>(spreadProgress);
  const lastRibbonTickBucketRef = useRef<number>(0);
  const lastTapRef = useRef<{ uid: string; ts: number }>({ uid: "", ts: 0 });
  const prevPlacedLenRef = useRef<number>(placedCards.length);

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

  spreadProgressRef.current = spreadProgress;

  // Derived deck pools
  const usedCardIds = useMemo(
    () => new Set(placedCards.map((c) => c.cardId)),
    [placedCards]
  );

  const availableCardIds = useMemo(
    () => deckOrder.filter((id) => !usedCardIds.has(id)),
    [deckOrder, usedCardIds]
  );

  const ribbonCards = useMemo(
    () => availableCardIds.slice(0, RIBBON_MAX_CARDS),
    [availableCardIds]
  );

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
    if (isTabletOrWide) {
      return clamp(Math.round(Math.min(canvasSize.width, canvasSize.height) * 0.185), 126, 162);
    }
    return clamp(Math.round(Math.min(canvasSize.width, canvasSize.height) * 0.21), 90, 118);
  }, [canvasSize.height, canvasSize.width, isTabletOrWide]);

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

  // Haptics helper
  const triggerHaptic = useCallback(
    (pattern: number | number[]) => {
      if (!hapticsEnabled || typeof navigator === "undefined") return;
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
  }, []);

  // Client-mount initial shuffle & cleanup
  useEffect(() => {
    setDeckOrder(fisherYates(TAROT_CARDS.map((c) => c.id)));
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

  // Measure tabletop bounds continuously with ResizeObserver
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof window === "undefined") return;

    const updateBounds = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setCanvasSize({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    };

    updateBounds();

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(updateBounds);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", updateBounds, { passive: true });
    return () => window.removeEventListener("resize", updateBounds);
  }, []);

  // Sync maxZRef with incoming placedCards & detect external reset
  useEffect(() => {
    const highest = placedCards.reduce((acc, c) => Math.max(acc, c.zIndex), 20);
    if (highest > maxZRef.current) {
      maxZRef.current = highest;
    }

    if (prevPlacedLenRef.current > 0 && placedCards.length === 0) {
      setSelectedCardUid(null);
      movedByUserRef.current.clear();
      setDeckOrder(fisherYates(TAROT_CARDS.map((c) => c.id)));
      setSpreadProgress(0);
      setPhase("stack");
    }
    prevPlacedLenRef.current = placedCards.length;
  }, [placedCards]);

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

  const getRibbonCardTransform = useCallback(
    (idx: number, total: number, progress: number, dir: "ltr" | "rtl") => {
      const t = total <= 1 ? 0.5 : idx / (total - 1);
      const u = dir === "ltr" ? t * progress : 1 - (1 - t) * progress;
      const x = ribbonGeom.startX + u * ribbonGeom.spanX;
      const arch = 4 * u * (1 - u);
      const stackLift = (1 - progress) * (idx * -0.34);
      const y = ribbonGeom.baseY - arch * ribbonGeom.arcLift + stackLift;
      const angle = (u - 0.5) * 26 * progress;
      return { x, y, angle, u };
    },
    [ribbonGeom]
  );

  // Smoothly animate spreadProgress from current value to target
  const animateSpreadProgress = useCallback(
    (target: number, durationMs = 640, onDone?: () => void) => {
      stopRibbonAnim();
      const from = spreadProgressRef.current;
      const startTs = performance.now();
      const totalCards = Math.max(1, ribbonCards.length);

      const tick = (now: number) => {
        const rawT = clamp((now - startTs) / durationMs, 0, 1);
        const eased = 1 - Math.pow(1 - rawT, 3);
        const nextVal = from + (target - from) * eased;
        setSpreadProgress(nextVal);

        const bucket = Math.floor(nextVal * totalCards);
        if (bucket !== lastRibbonTickBucketRef.current) {
          lastRibbonTickBucketRef.current = bucket;
          soundEngine.playHoverTick(soundEnabled);
          if (bucket % 3 === 0) triggerHaptic(4);
        }

        if (rawT < 1) {
          ribbonAnimRafRef.current = window.requestAnimationFrame(tick);
        } else {
          ribbonAnimRafRef.current = null;
          onDone?.();
        }
      };

      ribbonAnimRafRef.current = window.requestAnimationFrame(tick);
    },
    [ribbonCards.length, soundEnabled, stopRibbonAnim, triggerHaptic]
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
    setPhase("focus");
    syncSpreadCardsForPhase("focus");
  }, [soundEnabled, stopRibbonAnim, syncSpreadCardsForPhase, triggerHaptic]);

  const handleEnterRibbon = useCallback(
    (autoSpread = false) => {
      if (deckAnim !== "idle") return;
      soundEngine.playCardDraw(soundEnabled);
      triggerHaptic(12);
      setSelectedCardUid(null);
      setRibbonDirection("ltr");
      setHoveredRibbonIdx(null);
      setPhase("ribbon");
      syncSpreadCardsForPhase("ribbon");
      if (autoSpread) {
        setSpreadProgress(0);
        scheduleTimer(() => animateSpreadProgress(1, 620), 60);
      } else {
        setSpreadProgress(0);
      }
    },
    [
      animateSpreadProgress,
      deckAnim,
      scheduleTimer,
      soundEnabled,
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
  // Phase B: 60fps 2D Physics Wash Shuffle
  // =========================================================================
  const initWashBodies = useCallback(() => {
    const cx = canvasSize.width * 0.5;
    const cy = canvasSize.height * 0.5;
    const spreadRx = Math.min(canvasSize.width * 0.3, 280);
    const spreadRy = Math.min(canvasSize.height * 0.24, 190);

    washBodiesRef.current = Array.from({ length: WASH_CARD_COUNT }, (_, i) => {
      const theta = (i / WASH_CARD_COUNT) * Math.PI * 2 + Math.random() * 0.5;
      const distFactor = 0.25 + Math.random() * 0.75;
      const speed = 7 + Math.random() * 11;
      return {
        id: i,
        x: cx + Math.cos(theta) * spreadRx * 0.14,
        y: cy + Math.sin(theta) * spreadRy * 0.14,
        vx: Math.cos(theta) * speed * distFactor + (Math.random() - 0.5) * 3,
        vy: Math.sin(theta) * speed * distFactor + (Math.random() - 0.5) * 3,
        angle: (Math.random() - 0.5) * 320,
        vAngle: (Math.random() - 0.5) * 14,
        zIndex: i + 1,
      };
    });
    washZCounterRef.current = WASH_CARD_COUNT + 5;
  }, [canvasSize.height, canvasSize.width]);

  const handleEnterWash = useCallback(() => {
    stopRibbonAnim();
    setSelectedCardUid(null);
    setSpreadMenuOpen(false);
    washGatheringRef.current = false;
    setIsGatheringWash(false);
    washPointersRef.current.clear();
    setWashPointerDots([]);
    initWashBodies();
    soundEngine.playShuffle(soundEnabled);
    triggerHaptic([12, 24, 12]);
    setPhase("wash");
  }, [initWashBodies, soundEnabled, stopRibbonAnim, triggerHaptic]);

  const handleScatterWashAgain = useCallback(() => {
    if (washGatheringRef.current) return;
    initWashBodies();
    soundEngine.playShuffle(soundEnabled);
    triggerHaptic(12);
  }, [initWashBodies, soundEnabled, triggerHaptic]);

  const handleGatherWashToRibbon = useCallback(() => {
    if (washGatheringRef.current) return;
    washGatheringRef.current = true;
    setIsGatheringWash(true);
    washPointersRef.current.clear();
    setWashPointerDots([]);

    // Fresh true Fisher-Yates shuffle across all 78 cards
    setDeckOrder((prev) => fisherYates(prev));
    setShuffleCount((c) => c + 1);
    soundEngine.playShuffle(soundEnabled);
    triggerHaptic([12, 28, 16]);

    scheduleTimer(() => {
      washGatheringRef.current = false;
      setIsGatheringWash(false);
      setRibbonDirection("ltr");
      setSpreadProgress(0);
      setPhase("ribbon");
      syncSpreadCardsForPhase("ribbon");
    }, 580);
  }, [scheduleTimer, soundEnabled, syncSpreadCardsForPhase, triggerHaptic]);

  // 60fps Wash Physics rAF Loop
  useEffect(() => {
    if (phase !== "wash") {
      if (washRafRef.current !== null) {
        window.cancelAnimationFrame(washRafRef.current);
        washRafRef.current = null;
      }
      return;
    }

    if (washBodiesRef.current.length !== WASH_CARD_COUNT) {
      initWashBodies();
    }

    let lastTime = performance.now();

    const stepPhysics = (now: number) => {
      const dt = clamp((now - lastTime) / 1000, 0.004, 0.04);
      lastTime = now;
      const step = dt * 60;
      const damping = Math.pow(0.9, step);
      const angDamping = Math.pow(0.89, step);

      const bodies = washBodiesRef.current;
      const pointers = Array.from(washPointersRef.current.values());
      const halfW = washCardWidth * 0.5;
      const halfH = washCardHeight * 0.5;
      const padLeft = halfW + 22;
      const padRight = canvasSize.width - halfW - 22;
      const padTop = halfH + 70;
      const padBottom = canvasSize.height - halfH - 96;
      const influenceR = Math.max(washCardHeight * 0.92, 118);
      const minPairDist = washCardWidth * 0.44;
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
      const occupied = new Set(placedCards.map((c) => c.slotIndex));
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
    [activeSpread, phase, placedCards]
  );

  const drawCardOntoTable = useCallback(
    (
      cardId: string,
      manualDrop?: { xPct: number; yPct: number; snapSlotIndex: number | null }
    ) => {
      if (usedCardIds.has(cardId)) return;

      const compactForRibbon = phase !== "focus";
      let slotIndex = placedCards.length;
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
        const occupied = new Set(placedCards.map((c) => c.slotIndex));
        const nextUnusedPresetSlot = activeSpread?.slots.find(
          (s) => !occupied.has(s.index)
        );
        slotIndex = nextUnusedPresetSlot
          ? nextUnusedPresetSlot.index
          : placedCards.reduce((m, c) => Math.max(m, c.slotIndex), -1) + 1;
        xPct = clamp(manualDrop.xPct, 9, 91);
        yPct = clamp(manualDrop.yPct, 14, compactForRibbon ? 72 : 84);
        rotation = (Math.random() - 0.5) * 4;
        userManuallyPlaced = true;
      } else if (activeSpread) {
        // Auto-place into next empty spread slot (or clarifier free spot if full)
        const occupied = new Set(placedCards.map((c) => c.slotIndex));
        const nextSlot = activeSpread.slots.find((s) => !occupied.has(s.index));
        if (nextSlot) {
          const mapped = mapSlotToTable(nextSlot, compactForRibbon);
          slotIndex = nextSlot.index;
          xPct = mapped.xPct;
          yPct = mapped.yPct;
          rotation = mapped.rotation;
        } else {
          slotIndex =
            placedCards.reduce((m, c) => Math.max(m, c.slotIndex), -1) + 1;
          const freePos = computeFreeSlotPosition(
            placedCards.length,
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
          placedCards.reduce((m, c) => Math.max(m, c.slotIndex), -1) + 1;
        const freePos = computeFreeSlotPosition(
          placedCards.length,
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
      placedCards,
      scheduleTimer,
      soundEnabled,
      triggerHaptic,
      usedCardIds,
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
      const total = ribbonCards.length;
      if (total === 0) return null;
      const halfW = ribbonCardWidth * 0.56;
      const halfH = ribbonCardHeight * 0.62;

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
      if (localY >= ribbonGeom.baseY - ribbonCardHeight && progress > 0.25) {
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
        return closestDist < ribbonCardWidth * 1.1 ? closestIdx : null;
      }
      return null;
    },
    [
      getRibbonCardTransform,
      ribbonCardHeight,
      ribbonCardWidth,
      ribbonCards.length,
      ribbonGeom.baseY,
    ]
  );

  const handleRibbonPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (ribbonCards.length === 0) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      stopRibbonAnim();
      e.currentTarget.setPointerCapture(e.pointerId);

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const currentProgress = spreadProgressRef.current;
      const hitIdx = findRibbonCardAtPoint(x, y, currentProgress, ribbonDirection);

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
        initialDir: ribbonDirection,
        hitIdx,
        pullCardId: null,
      };

      if (currentProgress >= 0.36 && hitIdx !== null) {
        setHoveredRibbonIdx(hitIdx);
        soundEngine.playHoverTick(soundEnabled);
      }
    },
    [
      findRibbonCardAtPoint,
      ribbonCards.length,
      ribbonDirection,
      soundEnabled,
      stopRibbonAnim,
    ]
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
            ribbonDirection
          );
          if (hoverIdx !== hoveredRibbonIdx) {
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
          const pickedId = ribbonCards[g.hitIdx];
          if (pickedId) {
            g.mode = "pull";
            g.pullCardId = pickedId;
            setHoveredRibbonIdx(null);
            soundEngine.playHoverTick(soundEnabled);
            triggerHaptic(8);
          }
        } else if (g.initialProgress < 0.88) {
          g.mode = "sweep";
        } else {
          g.mode = "glide";
        }
      }

      // Mode 1: Horizontal Silk Sweep (supports BOTH left→right AND right→left!)
      if (g.mode === "sweep") {
        let dir = g.initialDir;
        let nextProgress = g.initialProgress;
        const effectiveSpan = Math.max(180, ribbonGeom.spanX * 0.76);

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

        if (dir !== ribbonDirection) {
          setRibbonDirection(dir);
        }
        setSpreadProgress(nextProgress);

        const bucket = Math.floor(nextProgress * Math.max(1, ribbonCards.length));
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
          ribbonDirection
        );
        if (hoverIdx !== hoveredRibbonIdx) {
          setHoveredRibbonIdx(hoverIdx);
          if (hoverIdx !== null) {
            g.hitIdx = hoverIdx;
            soundEngine.playHoverTick(soundEnabled);
            triggerHaptic(4);
          }
        }

        // Pull upward while gliding -> seamlessly grab the focused card off the ribbon!
        if (y < ribbonGeom.baseY - ribbonCardHeight * 0.72 && g.hitIdx !== null) {
          const pickedId = ribbonCards[g.hitIdx];
          if (pickedId) {
            g.mode = "pull";
            g.pullCardId = pickedId;
            setHoveredRibbonIdx(null);
            soundEngine.playHoverTick(soundEnabled);
            triggerHaptic(8);
          }
        }
        return;
      }

      // Mode 3: Dragging a pulled card across the velvet cloth
      if (g.mode === "pull" && g.pullCardId) {
        const xPct = (x / canvasSize.width) * 100;
        const yPct = (y / canvasSize.height) * 100;
        const snapSlotIndex = findNearestEmptySlot(xPct, yPct, 11);
        setDragHoverSlotIdx(snapSlotIndex);
        setRibbonGhost({
          cardId: g.pullCardId,
          ribbonIdx: g.hitIdx ?? 0,
          x,
          y,
          vx: clamp(g.velocityX, -22, 22),
          snapSlotIndex,
        });
      }
    },
    [
      canvasSize.height,
      canvasSize.width,
      findNearestEmptySlot,
      findRibbonCardAtPoint,
      hoveredRibbonIdx,
      ribbonCardHeight,
      ribbonCards,
      ribbonDirection,
      ribbonGeom.baseY,
      ribbonGeom.spanX,
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
        const speedMatch =
          (ribbonDirection === "ltr" && g.velocityX > 8) ||
          (ribbonDirection === "rtl" && g.velocityX < -8);
        if (cur > 0.52 || (cur > 0.2 && speedMatch)) {
          animateSpreadProgress(1, 420);
        } else if (cur < 0.16) {
          animateSpreadProgress(0, 260);
        }
        return;
      }

      if (g.mode === "pull" && g.pullCardId) {
        const xPct = (x / canvasSize.width) * 100;
        const yPct = (y / canvasSize.height) * 100;
        const pulledHighEnough = y < ribbonGeom.baseY - ribbonCardHeight * 0.45;
        setRibbonGhost(null);
        setDragHoverSlotIdx(null);

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
        const tappedCardId = ribbonCards[g.hitIdx];
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
      canvasSize.height,
      canvasSize.width,
      drawCardOntoTable,
      findNearestEmptySlot,
      ribbonCardHeight,
      ribbonCards,
      ribbonDirection,
      ribbonGeom.baseY,
      soundEnabled,
    ]
  );

  // =========================================================================
  // Phase D & Persistent Tabletop: Placed Card Drag, Tap-Flip, Double-Tap, Actions
  // =========================================================================
  const cardDragRef = useRef<{
    uid: string | null;
    pointerId: number | null;
    startX: number;
    startY: number;
    origXPct: number;
    origYPct: number;
    hasDragged: boolean;
  }>({
    uid: null,
    pointerId: null,
    startX: 0,
    startY: 0,
    origXPct: 0,
    origYPct: 0,
    hasDragged: false,
  });

  const handlePlacedCardPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, card: TablePlacedCard) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      setSpreadMenuOpen(false);

      maxZRef.current += 1;
      const elevatedZ = maxZRef.current;

      cardDragRef.current = {
        uid: card.uid,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origXPct: card.xPct,
        origYPct: card.yPct,
        hasDragged: false,
      };

      onPlacedCardsChange((prev) =>
        prev.map((c) => (c.uid === card.uid ? { ...c, zIndex: elevatedZ } : c))
      );
    },
    [onPlacedCardsChange]
  );

  const handlePlacedCardPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, card: TablePlacedCard) => {
      const drag = cardDragRef.current;
      if (drag.uid !== card.uid || drag.pointerId !== e.pointerId) return;

      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const dist = Math.hypot(dx, dy);

      if (!drag.hasDragged && dist > 8) {
        drag.hasDragged = true;
        setDraggingCardUid(card.uid);
        setSelectedCardUid(null);
        movedByUserRef.current.add(card.uid);
        triggerHaptic(6);
      }

      if (drag.hasDragged) {
        const nextX = clamp(
          drag.origXPct + (dx / Math.max(1, canvasSize.width)) * 100,
          6,
          94
        );
        const nextY = clamp(
          drag.origYPct + (dy / Math.max(1, canvasSize.height)) * 100,
          10,
          90
        );

        const nearSlot = findNearestEmptySlot(nextX, nextY, 5.5);
        setDragHoverSlotIdx(nearSlot);

        onPlacedCardsChange((prev) =>
          prev.map((c) =>
            c.uid === card.uid ? { ...c, xPct: nextX, yPct: nextY } : c
          )
        );
      }
    },
    [
      canvasSize.height,
      canvasSize.width,
      findNearestEmptySlot,
      onPlacedCardsChange,
      triggerHaptic,
    ]
  );

  const handlePlacedCardPointerUp = useCallback(
    (
      e: React.PointerEvent<HTMLDivElement>,
      placed: TablePlacedCard,
      tarotCard: TarotCard
    ) => {
      const drag = cardDragRef.current;
      if (drag.uid !== placed.uid || drag.pointerId !== e.pointerId) return;
      const wasDrag = drag.hasDragged;
      drag.uid = null;
      drag.pointerId = null;
      drag.hasDragged = false;

      if (wasDrag) {
        setDraggingCardUid(null);
        setDragHoverSlotIdx(null);

        // Soft snap only if released very close to an empty spread slot
        const snapSlot = findNearestEmptySlot(placed.xPct, placed.yPct, 5);
        if (snapSlot !== null && activeSpread) {
          const slotDef = activeSpread.slots[snapSlot];
          if (slotDef) {
            const mapped = mapSlotToTable(slotDef, phase !== "focus");
            movedByUserRef.current.delete(placed.uid);
            onPlacedCardsChange((prev) =>
              prev.map((c) =>
                c.uid === placed.uid
                  ? {
                      ...c,
                      slotIndex: slotDef.index,
                      xPct: mapped.xPct,
                      yPct: mapped.yPct,
                      rotation: mapped.rotation,
                    }
                  : c
              )
            );
          }
        }
        soundEngine.playHoverTick(soundEnabled);
        triggerHaptic(8);
        return;
      }

      // Tap interaction (<= 8px)
      if (!placed.revealed) {
        // Flip face-down card right on the cloth and immediately focus it for bottom-right reading popup
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
      findNearestEmptySlot,
      onInspectCard,
      onPlacedCardsChange,
      phase,
      soundEnabled,
      triggerHaptic,
    ]
  );

  // Cascading Reveal All
  const handleRevealAll = useCallback(() => {
    const unrevealedUids = placedCards
      .filter((c) => !c.revealed)
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .map((c) => c.uid);

    if (unrevealedUids.length === 0) return;
    setSelectedCardUid(null);

    unrevealedUids.forEach((uid, order) => {
      scheduleTimer(() => {
        triggerHaptic(11);
        onPlacedCardsChange((prev) =>
          prev.map((c) => (c.uid === uid ? { ...c, revealed: true } : c))
        );
        if (order === unrevealedUids.length - 1) {
          scheduleTimer(() => {
            soundEngine.playChime(soundEnabled);
            setSelectedCardUid(unrevealedUids[0] ?? null);
            setFloatReadingTab("general");
          }, 360);
        }
      }, order * 155);
    });
  }, [
    onPlacedCardsChange,
    placedCards,
    scheduleTimer,
    soundEnabled,
    triggerHaptic,
  ]);

  // Tidy / re-align cards into spread slots
  const handleAlignSpread = useCallback(() => {
    if (!activeSpread || placedCards.length === 0) return;
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
  }, [activeSpread, onPlacedCardsChange, phase, placedCards.length, soundEnabled, triggerHaptic]);

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
      triggerHaptic(10);
      setSelectedCardUid(null);
      onPlacedCardsChange((prev) =>
        prev.map((c) => (c.uid === uid ? { ...c, revealed: false } : c))
      );
    },
    [onPlacedCardsChange, triggerHaptic]
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
      if (nextSpread !== "free" && placedCards.length > 0) {
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
    [onPlacedCardsChange, onSpreadChange, phase, placedCards.length, soundEnabled, triggerHaptic]
  );

  const handleResetAll = useCallback(() => {
    stopRibbonAnim();
    soundEngine.playShuffle(soundEnabled);
    triggerHaptic(14);
    setSelectedCardUid(null);
    setSpreadMenuOpen(false);
    movedByUserRef.current.clear();
    setDeckOrder(fisherYates(TAROT_CARDS.map((c) => c.id)));
    setSpreadProgress(0);
    setPhase("stack");
    onResetTable();
  }, [onResetTable, soundEnabled, stopRibbonAnim, triggerHaptic]);

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
        .sort((a, b) => a.slotIndex - b.slotIndex),
    [placedCards]
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
          LAYER 1 (z-10): Etched Golden Spread Slot Outlines on Cloth
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

            return (
              <motion.div
                key={`slot-${activeSpread.id}-${slot.index}`}
                initial={false}
                animate={{
                  left: `${xPct}%`,
                  top: `${yPct}%`,
                  rotate: rotation + (querentFacing ? 180 : 0),
                  scale: isDropHighlight ? 1.07 : 1,
                  opacity: occupied ? 0.24 : isDropHighlight ? 1 : isNext ? 0.92 : 0.56,
                }}
                transition={{ type: "spring", stiffness: 260, damping: 28 }}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-[11px]"
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

            const isDragging = draggingCardUid === placed.uid;
            const isSelected = selectedCardUid === placed.uid;
            const slotDef = activeSpread?.slots[placed.slotIndex];
            const effectiveRotation =
              placed.rotation + (querentFacing ? 180 : 0);

            return (
              <motion.div
                key={placed.uid}
                initial={{
                  left: `${placed.xPct}%`,
                  top: `${Math.min(92, placed.yPct + 12)}%`,
                  scale: placedCardScale * 0.72,
                  opacity: 0,
                  rotate: effectiveRotation - 8,
                }}
                animate={{
                  left: `${placed.xPct}%`,
                  top: `${placed.yPct}%`,
                  scale: isDragging
                    ? placedCardScale * 1.07
                    : isSelected
                      ? placedCardScale * 1.03
                      : placedCardScale,
                  opacity: 1,
                  rotate: isDragging ? effectiveRotation + 2 : effectiveRotation,
                }}
                exit={{ scale: 0.68, opacity: 0, transition: { duration: 0.22 } }}
                transition={
                  isDragging
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 280, damping: 28 }
                }
                role="button"
                tabIndex={0}
                aria-label={
                  placed.revealed
                    ? `${tarotCard.nameZh} ${placed.reversed ? "逆位" : "正位"}`
                    : "点击翻开塔罗牌"
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (!placed.revealed) {
                      onPlacedCardsChange((prev) =>
                        prev.map((c) =>
                          c.uid === placed.uid ? { ...c, revealed: true } : c
                        )
                      );
                    } else {
                      setSelectedCardUid((cur) =>
                        cur === placed.uid ? null : placed.uid
                      );
                    }
                  }
                }}
                onPointerDown={(e) => handlePlacedCardPointerDown(e, placed)}
                onPointerMove={(e) => handlePlacedCardPointerMove(e, placed)}
                onPointerUp={(e) =>
                  handlePlacedCardPointerUp(e, placed, tarotCard)
                }
                onPointerCancel={() => {
                  if (cardDragRef.current.uid === placed.uid) {
                    cardDragRef.current.uid = null;
                    cardDragRef.current.pointerId = null;
                    setDraggingCardUid(null);
                    setDragHoverSlotIdx(null);
                  }
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 touch-none outline-none"
                style={{
                  zIndex: isDragging ? 900 : placed.zIndex,
                  cursor: isDragging ? "grabbing" : "grab",
                  filter: isDragging
                    ? "drop-shadow(0 24px 36px rgba(0,0,0,0.62))"
                    : undefined,
                }}
              >
                <div className="relative flex flex-col items-center">
                  {/* Subtle slot pill above card (only when not cleanMode and not crossing 90deg overlap) */}
                  {!cleanMode && slotDef && (slotDef.rotation ?? 0) === 0 ? (
                    <span
                      className="pointer-events-none mb-1.5 max-w-[130px] truncate rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wider backdrop-blur-md"
                      style={{
                        borderColor: `${accentColor}52`,
                        backgroundColor: "var(--bg-glass)",
                        color: accentStrong,
                      }}
                    >
                      {slotDef.index + 1}. {slotDef.labelZh}
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
                    tiltEnabled={!isDragging}
                    gyroEnabled={gyroEnabled}
                    soundEnabled={soundEnabled}
                    glowActive={isSelected || isDragging}
                    maxTilt={14}
                    className="touch-none"
                  />

                  {/* Compact card name pill once flipped */}
                  {placed.revealed && !cleanMode && placedCardSize !== "xs" ? (
                    <div
                      className="pointer-events-none mt-1.5 flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] backdrop-blur-md"
                      style={{
                        borderColor: "var(--border-subtle)",
                        backgroundColor: "var(--bg-glass)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <span className="font-serif font-medium tracking-wide">
                        {tarotCard.nameZh}
                      </span>
                      <span
                        className={
                          placed.reversed
                            ? theme.isLight
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
            className={`uranai-glass-strong gold-shimmer-border pointer-events-auto fixed right-3 z-[42] flex w-[min(352px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl shadow-[0_18px_52px_rgba(0,0,0,0.55)] sm:right-5 ${
              phase === "ribbon"
                ? "bottom-[max(13.2rem,calc(env(safe-area-inset-bottom)+12.4rem))]"
                : "bottom-[max(4.5rem,calc(env(safe-area-inset-bottom)+3.75rem))] md:bottom-[max(1.1rem,env(safe-area-inset-bottom))]"
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 border-b border-[var(--border-subtle)] px-4 pt-3.5 pb-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent-strong)]">
                    {selectedSlotMeta
                      ? `${selectedPlacedCard.slotIndex + 1}. ${selectedSlotMeta.labelZh}`
                      : `第 ${selectedRevealedIdx >= 0 ? selectedRevealedIdx + 1 : 1} 张`}
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
              {/* Ambient warm glow beneath physical stack */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
                style={{ background: clothGlow, opacity: 0.9 }}
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

                {STACK_VISUAL_LAYERS.map((layer) => {
                  const isUpperHalf = layer >= Math.floor(STACK_VISUAL_LAYERS.length / 2);
                  const isTopCard = layer === STACK_VISUAL_LAYERS.length - 1;
                  const baseShiftX = -layer * 0.45;
                  const baseShiftY = -layer * 0.95;

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
                        delay: deckAnim === "riffle" ? layer * 0.014 : 0,
                      }}
                      className="absolute inset-0 overflow-hidden rounded-[11px]"
                      style={{
                        zIndex:
                          deckAnim === "cut" && !isUpperHalf
                            ? layer + 14
                            : layer + 1,
                        border: `1px solid ${cardEdgeColor}${isTopCard ? "e6" : "99"}`,
                        backgroundColor: "#13111c",
                        boxShadow: isTopCard
                          ? "0 8px 24px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,250,225,0.28)"
                          : "0 1px 2px rgba(0,0,0,0.4)",
                      }}
                    >
                      {isTopCard || layer === STACK_VISUAL_LAYERS.length - 2 ? (
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
                <div className="mt-4 flex items-center gap-2 text-[11px] tracking-wider text-[var(--text-secondary)]">
                  <span>剩余 {availableCardIds.length} 张牌</span>
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
                    className="uranai-glass inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-accent)] hover:bg-[var(--accent-soft)] active:scale-95"
                  >
                    <Hand className="h-3.5 w-3.5 text-[var(--accent)]" />
                    桌布揉洗
                  </button>

                  <button
                    type="button"
                    onClick={handleRiffleShuffle}
                    disabled={deckAnim !== "idle"}
                    className="uranai-glass inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-accent)] hover:bg-[var(--accent-soft)] active:scale-95 disabled:opacity-50"
                  >
                    <Shuffle className="h-3.5 w-3.5 text-[var(--accent)]" />
                    交错洗牌
                  </button>

                  <button
                    type="button"
                    onClick={handleCutDeck}
                    disabled={deckAnim !== "idle"}
                    className="uranai-glass inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-accent)] hover:bg-[var(--accent-soft)] active:scale-95 disabled:opacity-50"
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
            <div className="pointer-events-none absolute top-[max(4.5rem,calc(env(safe-area-inset-top)+3.75rem))] left-1/2 z-[34] -translate-x-1/2">
              <div className="uranai-glass flex items-center gap-2 rounded-full px-4 py-1.5 text-xs text-[var(--text-primary)]">
                <Orbit className="h-3.5 w-3.5 animate-spin text-[var(--accent)] [animation-duration:9s]" />
                <span className="whitespace-nowrap">
                  {isGatheringWash
                    ? "正在聚拢牌堆并完成 78 张真随机洗牌…"
                    : "用单手或双手在绒布上画圈搓揉洗牌"}
                </span>
              </div>
            </div>
          ) : null}

          {/* 34 GPU-accelerated face-down cards driven directly via rAF */}
          {Array.from({ length: WASH_CARD_COUNT }, (_, idx) => (
            <div
              key={`wash-card-${idx}`}
              ref={(el) => {
                washCardElsRef.current[idx] = el;
              }}
              className="pointer-events-none absolute top-0 left-0 overflow-hidden rounded-[9px] will-change-transform"
              style={{
                width: washCardWidth,
                height: washCardHeight,
                border: `1px solid ${cardEdgeColor}cc`,
                boxShadow: "0 8px 20px rgba(0,0,0,0.46)",
                transform: `translate3d(${(
                  canvasSize.width * 0.5 -
                  washCardWidth * 0.5
                ).toFixed(1)}px, ${(
                  canvasSize.height * 0.5 -
                  washCardHeight * 0.5
                ).toFixed(1)}px, 0)`,
              }}
            >
              <CardBackArtwork deckId={deckId} themeId={themeId} />
            </div>
          ))}

          {/* Warm golden fingertip contact halos for multi-touch feedback */}
          {washPointerDots.map((dot) => (
            <div
              key={dot.id}
              aria-hidden="true"
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
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
              className="pointer-events-auto absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[36] flex -translate-x-1/2 items-center gap-2.5"
            >
              <button
                type="button"
                onClick={handleScatterWashAgain}
                disabled={isGatheringWash}
                className="uranai-glass inline-flex items-center gap-1.5 rounded-full px-3.5 py-2.5 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-accent)] active:scale-95 disabled:opacity-45"
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
                  <span className="uranai-glass rounded-full px-4 py-1.5 text-center text-[11px] font-medium tracking-wide text-[var(--accent-strong)] shadow-lg sm:text-xs">
                    ✦ 用手指沿桌布向右拂动，将牌如丝带般摊开
                  </span>
                </div>
              </div>
            ) : null}

            {/* Ribbon Instruction Pill once spread */}
            {spreadProgress >= 0.36 && !ribbonGhost && !cleanMode ? (
              <div
                className="pointer-events-none absolute left-1/2 -translate-x-1/2"
                style={{
                  top: Math.max(
                    86,
                    ribbonGeom.baseY - ribbonCardHeight * 0.5 - ribbonGeom.arcLift - 42
                  ),
                }}
              >
                <span className="uranai-glass inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1 text-[11px] text-[var(--text-secondary)]">
                  <Sparkles className="h-3 w-3 text-[var(--accent)]" />
                  {allSpreadSlotsFilled
                    ? "牌阵已满 · 可继续抽补牌或收起牌扇专注桌面"
                    : activeSpread
                      ? `轻点或向上拖出卡牌 · 下一牌位：${
                          mappedSlots.find((s) => s.isNext)?.slot.labelZh ?? "补牌"
                        }`
                      : "轻点或向上拖出卡牌，自由落于绒布任意位置"}
                </span>
              </div>
            ) : null}

            {/* 32 Overlapping Curved Silk Ribbon Cards */}
            {ribbonCards.map((cardId, idx) => {
              const isBeingPulled = ribbonGhost?.cardId === cardId;
              const { x, y, angle } = getRibbonCardTransform(
                idx,
                ribbonCards.length,
                spreadProgress,
                ribbonDirection
              );
              const isFocused =
                spreadProgress > 0.35 && hoveredRibbonIdx === idx && !isBeingPulled;

              return (
                <div
                  key={cardId}
                  aria-hidden="true"
                  className="pointer-events-none absolute top-0 left-0 overflow-hidden rounded-[9px]"
                  style={{
                    width: ribbonCardWidth,
                    height: ribbonCardHeight,
                    zIndex: isFocused ? 60 : idx + 1,
                    opacity: isBeingPulled ? 0 : 1,
                    transform: `translate3d(${(
                      x -
                      ribbonCardWidth * 0.5
                    ).toFixed(1)}px, ${(
                      y -
                      ribbonCardHeight * 0.5 -
                      (isFocused ? 24 : 0)
                    ).toFixed(1)}px, 0) rotate(${angle.toFixed(1)}deg) scale(${
                      isFocused ? 1.09 : 1
                    })`,
                    transition: ribbonGestureRef.current.active
                      ? "transform 80ms ease-out, box-shadow 140ms ease"
                      : "transform 200ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms ease",
                    border: `1px solid ${
                      isFocused ? accentStrong : `${cardEdgeColor}cc`
                    }`,
                    boxShadow: isFocused
                      ? `0 18px 34px rgba(0,0,0,0.62), 0 0 22px ${accentColor}75`
                      : "0 8px 18px rgba(0,0,0,0.45)",
                  }}
                >
                  <CardBackArtwork deckId={deckId} themeId={themeId} />
                </div>
              );
            })}

            {/* Ribbon Bottom Action Bar */}
            {!cleanMode ? (
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className="pointer-events-auto absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-[70] flex max-w-[94vw] -translate-x-1/2 items-center gap-1.5 sm:gap-2"
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
                    className="uranai-glass inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-accent)] active:scale-95"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-[var(--accent)]" />
                    收拢牌堆
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPhase("stack")}
                    className="uranai-glass inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-accent)] active:scale-95"
                  >
                    <Layers className="h-3.5 w-3.5 text-[var(--accent)]" />
                    返回叠牌
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleEnterWash}
                  className="uranai-glass inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-accent)] active:scale-95"
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
                        : "uranai-glass-strong text-[var(--accent-strong)] hover:brightness-110"
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
          LIVE DRAGGED GHOST CARD PULLED OFF RIBBON (z-35)
         ===================================================================== */}
      {ribbonGhost ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 z-[35] overflow-hidden rounded-[10px]"
          style={{
            width: Math.round(placedCardDims.w * placedCardScale),
            height: Math.round(placedCardDims.h * placedCardScale),
            transform: `translate3d(${(
              ribbonGhost.x -
              (placedCardDims.w * placedCardScale) / 2
            ).toFixed(1)}px, ${(
              ribbonGhost.y -
              (placedCardDims.h * placedCardScale) / 2
            ).toFixed(1)}px, 0) rotate(${(ribbonGhost.vx * 0.55).toFixed(1)}deg) scale(1.06)`,
            border: `1.5px solid ${accentStrong}`,
            boxShadow: `0 26px 46px rgba(0,0,0,0.68), 0 0 28px ${accentColor}75`,
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
              className="uranai-glass inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-accent)] hover:bg-[var(--accent-soft)] active:scale-95 disabled:opacity-45"
            >
              <GalleryHorizontalEnd className="h-3.5 w-3.5 text-[var(--accent)]" />
              重新展开牌扇
            </button>

            {activeSpread && placedCards.length > 0 ? (
              <button
                type="button"
                onClick={handleAlignSpread}
                className="uranai-glass hidden items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-accent)] hover:text-[var(--text-primary)] active:scale-95 sm:inline-flex"
              >
                <Layers className="h-3.5 w-3.5 text-[var(--accent)]" />
                对齐牌阵
              </button>
            ) : null}

            {placedCards.length > 0 ? (
              <button
                type="button"
                onClick={handleResetAll}
                className="uranai-glass inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:border-rose-400/45 hover:text-rose-200 active:scale-95"
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
            className="uranai-glass flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] opacity-45 transition hover:opacity-100 hover:text-[var(--accent-strong)] active:scale-95"
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
              className="uranai-glass inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-accent)] active:scale-95"
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
                className="uranai-glass inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-accent)] active:scale-95"
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

              {/* Spread Selector Popover */}
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

            {/* Cloth Theme Switch Pill */}
            <button
              type="button"
              onClick={onOpenClothSheet}
              className="uranai-glass inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-accent)] active:scale-95 sm:px-3"
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
              className="uranai-glass inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-accent)] active:scale-95 sm:px-3"
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
                className="uranai-glass hidden h-9 items-center gap-1.5 rounded-full px-2.5 text-[11px] text-[var(--text-secondary)] md:inline-flex"
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
                  : "uranai-glass text-[var(--text-primary)] hover:border-[var(--border-accent)]"
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
                className="uranai-glass hidden h-9 w-9 items-center justify-center rounded-full text-[var(--text-primary)] transition hover:border-[var(--border-accent)] active:scale-95 sm:inline-flex"
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
              className="uranai-glass inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] transition hover:border-[var(--border-accent)] hover:text-[var(--text-primary)] active:scale-95"
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
          <span className="uranai-glass inline-flex items-center gap-1.5 rounded-full border border-[var(--border-accent)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--accent-strong)]">
            <RotateCw className="h-2.5 w-2.5" />
            对坐视角 · 桌面牌面已翻转 180°
          </span>
        </div>
      ) : null}
    </div>
  );
}
