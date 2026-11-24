"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Scissors,
  Shuffle,
  Sparkles,
  Wand2,
  Zap,
} from "lucide-react";
import type { DeckId, DrawnCard, ThemeId } from "@/types/tarot";
import { TAROT_CARDS } from "@/data/tarot-cards";
import { getThemeById } from "@/data/themes";
import { soundEngine } from "@/lib/sound";
import { CardBackArtwork } from "./CardBackArtwork";

export interface ShuffleAndDrawRitualProps {
  requiredCount: number;
  spreadName: string;
  slotLabels: string[];
  deckId: DeckId;
  themeId: ThemeId;
  allowReversed: boolean;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  onComplete: (drawn: DrawnCard[]) => void;
  onBack?: () => void;
}

type RitualStage = "shuffle" | "draw";
type DeckMotionMode = "idle" | "shuffling" | "cutting";

interface FlyingCardAnim {
  id: string;
  slotIndex: number;
}

const STACK_LAYERS = Array.from({ length: 9 }, (_, i) => i);
const MAX_VISIBLE_FAN = 28;

function fisherYatesShuffle(source: number[]): number[] {
  const arr = [...source];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function cutIndices(source: number[]): number[] {
  if (source.length < 4) return [...source];
  const minCut = Math.floor(source.length * 0.28);
  const maxCut = Math.floor(source.length * 0.72);
  const cutPoint = minCut + Math.floor(Math.random() * (maxCut - minCut));
  return [...source.slice(cutPoint), ...source.slice(0, cutPoint)];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function ShuffleAndDrawRitual({
  requiredCount,
  spreadName,
  slotLabels,
  deckId,
  themeId,
  allowReversed,
  soundEnabled,
  hapticsEnabled,
  onComplete,
  onBack,
}: ShuffleAndDrawRitualProps) {
  const theme = getThemeById(themeId);
  const accentColor = theme.cssVars["--accent"] ?? "#d4af37";
  const cardEdgeColor = theme.cardEdgeColor ?? "#c9a24b";

  // SSR-safe deterministic initial order; client mount immediately Fisher-Yates shuffles
  const [deckIndices, setDeckIndices] = useState<number[]>(() =>
    Array.from({ length: TAROT_CARDS.length }, (_, i) => i)
  );
  const [stage, setStage] = useState<RitualStage>("shuffle");
  const [deckMotion, setDeckMotion] = useState<DeckMotionMode>("idle");
  const [shuffleCount, setShuffleCount] = useState(0);

  // Stage 2 draw state
  const [drawnCards, setDrawnCards] = useState<DrawnCard[]>([]);
  const [scrollPos, setScrollPos] = useState<number>(() =>
    Math.floor(TAROT_CARDS.length / 2)
  );
  const [flyingCards, setFlyingCards] = useState<FlyingCardAnim[]>([]);
  const [isQuickDrawing, setIsQuickDrawing] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // Refs for gesture inertia, timers, and double-completion protection
  const scrollPosRef = useRef(scrollPos);
  const lastFocusedIntRef = useRef(Math.round(scrollPos));
  const deckIndicesRef = useRef(deckIndices);
  const drawnCardsRef = useRef(drawnCards);
  const completedRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const inertiaRafRef = useRef<number | null>(null);
  const velocityRef = useRef(0);
  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    lastX: number;
    lastTime: number;
    movedPx: number;
    swipedUp: boolean;
  }>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastTime: 0,
    movedPx: 0,
    swipedUp: false,
  });

  useEffect(() => {
    scrollPosRef.current = scrollPos;
  }, [scrollPos]);

  useEffect(() => {
    deckIndicesRef.current = deckIndices;
  }, [deckIndices]);

  useEffect(() => {
    drawnCardsRef.current = drawnCards;
  }, [drawnCards]);

  const scheduleTimer = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((t) => t !== id);
      fn();
    }, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  const stopInertia = useCallback(() => {
    if (inertiaRafRef.current !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(inertiaRafRef.current);
      inertiaRafRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopInertia();
      for (const id of timersRef.current) {
        window.clearTimeout(id);
      }
      timersRef.current = [];
    };
  }, [stopInertia]);

  const triggerHaptic = useCallback(
    (pattern: number | number[]) => {
      if (!hapticsEnabled || typeof navigator === "undefined") return;
      try {
        navigator.vibrate?.(pattern);
      } catch {
        // Ignore unsupported devices
      }
    },
    [hapticsEnabled]
  );

  // Stage 1: Shuffle animation + Fisher-Yates randomization
  const runShuffle = useCallback(
    (playAudio = true) => {
      if (deckMotion !== "idle") return;
      setDeckMotion("shuffling");
      setDeckIndices((prev) => fisherYatesShuffle(prev));
      setShuffleCount((c) => c + 1);
      if (playAudio) {
        soundEngine.playShuffle(soundEnabled);
        triggerHaptic([10, 34, 10]);
      }

      scheduleTimer(() => {
        setDeckMotion("idle");
      }, 660);
    },
    [deckMotion, scheduleTimer, soundEnabled, triggerHaptic]
  );

  // Introductory shuffle automatically on mount
  const didIntroShuffleRef = useRef(false);
  useEffect(() => {
    if (didIntroShuffleRef.current) return;
    didIntroShuffleRef.current = true;
    const id = scheduleTimer(() => {
      setDeckMotion("shuffling");
      setDeckIndices((prev) => fisherYatesShuffle(prev));
      setShuffleCount(1);
      soundEngine.playShuffle(soundEnabled);
      scheduleTimer(() => {
        setDeckMotion("idle");
      }, 660);
    }, 220);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stage 1: Cut deck animation
  const runCutDeck = useCallback(() => {
    if (deckMotion !== "idle") return;
    setDeckMotion("cutting");
    setDeckIndices((prev) => cutIndices(prev));
    soundEngine.playCut(soundEnabled);
    triggerHaptic(16);

    scheduleTimer(() => {
      setDeckMotion("idle");
    }, 640);
  }, [deckMotion, scheduleTimer, soundEnabled, triggerHaptic]);

  // Transition Stage 1 -> Stage 2
  const handleEnterDrawStage = useCallback(() => {
    if (deckMotion !== "idle") return;
    soundEngine.playCardDraw(soundEnabled);
    triggerHaptic(12);
    const center = Math.floor(deckIndicesRef.current.length / 2);
    setScrollPos(center);
    scrollPosRef.current = center;
    lastFocusedIntRef.current = center;
    setStage("draw");
  }, [deckMotion, soundEnabled, triggerHaptic]);

  // Smoothly update scrollPos and fire subtle hover tick whenever crossing a new card
  const setScrollPosWithTick = useCallback(
    (nextPos: number, maxIndex: number) => {
      const clamped = clamp(nextPos, 0, Math.max(0, maxIndex));
      scrollPosRef.current = clamped;
      setScrollPos(clamped);

      const nextInt = Math.round(clamped);
      if (nextInt !== lastFocusedIntRef.current) {
        lastFocusedIntRef.current = nextInt;
        soundEngine.playHoverTick(soundEnabled);
        triggerHaptic(5);
      }
    },
    [soundEnabled, triggerHaptic]
  );

  // Smoothly glide scrollPos toward a target card index
  const animateScrollTo = useCallback(
    (targetIdx: number) => {
      stopInertia();
      const maxIdx = Math.max(0, deckIndicesRef.current.length - 1);
      const clampedTarget = clamp(targetIdx, 0, maxIdx);

      const step = () => {
        const cur = scrollPosRef.current;
        const diff = clampedTarget - cur;
        if (Math.abs(diff) < 0.04) {
          setScrollPosWithTick(clampedTarget, maxIdx);
          inertiaRafRef.current = null;
          return;
        }
        setScrollPosWithTick(cur + diff * 0.24, maxIdx);
        inertiaRafRef.current = window.requestAnimationFrame(step);
      };

      inertiaRafRef.current = window.requestAnimationFrame(step);
    },
    [setScrollPosWithTick, stopInertia]
  );

  // Draw one card from the remaining deck by index
  const drawCardAtIndex = useCallback(
    (indexInRemaining: number) => {
      if (completedRef.current || isCompleting) return;
      const currentDeck = deckIndicesRef.current;
      const currentDrawn = drawnCardsRef.current;
      if (currentDrawn.length >= requiredCount || currentDeck.length === 0) {
        return;
      }

      const safeIdx = clamp(indexInRemaining, 0, currentDeck.length - 1);
      const tarotIdx = currentDeck[safeIdx];
      const card = TAROT_CARDS[tarotIdx];
      if (!card) return;

      const slotIndex = currentDrawn.length;
      const newDrawnCard: DrawnCard = {
        cardId: card.id,
        slotIndex,
        reversed: allowReversed ? Math.random() < 0.3 : false,
        revealed: false,
      };

      const nextDeck = [
        ...currentDeck.slice(0, safeIdx),
        ...currentDeck.slice(safeIdx + 1),
      ];
      const nextDrawn = [...currentDrawn, newDrawnCard];

      deckIndicesRef.current = nextDeck;
      drawnCardsRef.current = nextDrawn;

      setDeckIndices(nextDeck);
      setDrawnCards(nextDrawn);

      // Keep scroll position clamped cleanly after removal
      const nextMax = Math.max(0, nextDeck.length - 1);
      const nextPos = clamp(scrollPosRef.current, 0, nextMax);
      scrollPosRef.current = nextPos;
      lastFocusedIntRef.current = Math.round(nextPos);
      setScrollPos(nextPos);

      // Flying card visual feedback
      const flyId = `fly-${card.id}-${slotIndex}-${Date.now()}`;
      setFlyingCards((prev) => [...prev, { id: flyId, slotIndex }]);
      scheduleTimer(() => {
        setFlyingCards((prev) => prev.filter((item) => item.id !== flyId));
      }, 460);

      soundEngine.playCardDraw(soundEnabled);
      triggerHaptic(18);

      // Complete ritual once all required cards are drawn
      if (nextDrawn.length >= requiredCount) {
        completedRef.current = true;
        setIsCompleting(true);
        setIsQuickDrawing(false);
        stopInertia();

        scheduleTimer(() => {
          soundEngine.playChime(soundEnabled);
          triggerHaptic([14, 42, 22]);
        }, 160);

        scheduleTimer(() => {
          onComplete(nextDrawn);
        }, 560);
      }
    },
    [
      allowReversed,
      isCompleting,
      onComplete,
      requiredCount,
      scheduleTimer,
      soundEnabled,
      stopInertia,
      triggerHaptic,
    ]
  );

  // Quick-draw all remaining slots smoothly for multi-card spreads (e.g. Celtic Cross)
  const handleQuickDrawRemaining = useCallback(() => {
    if (isQuickDrawing || isCompleting || completedRef.current) return;
    const remainingNeeded = requiredCount - drawnCardsRef.current.length;
    if (remainingNeeded <= 0) return;

    stopInertia();
    setIsQuickDrawing(true);

    for (let i = 0; i < remainingNeeded; i++) {
      scheduleTimer(() => {
        const len = deckIndicesRef.current.length;
        if (len === 0 || completedRef.current) return;
        const randomPick = Math.floor(Math.random() * len);
        setScrollPos(randomPick);
        scrollPosRef.current = randomPick;
        drawCardAtIndex(randomPick);
      }, i * 155);
    }
  }, [drawCardAtIndex, isCompleting, isQuickDrawing, requiredCount, scheduleTimer, stopInertia]);

  // Pointer drag / inertia / swipe-up gestures on the curved arc fan
  const handleFanPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isQuickDrawing || isCompleting) return;
    stopInertia();
    dragStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastTime: performance.now(),
      movedPx: 0,
      swipedUp: false,
    };
    velocityRef.current = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleFanPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;

    const now = performance.now();
    const dx = event.clientX - drag.lastX;
    const totalDx = event.clientX - drag.startX;
    const totalDy = event.clientY - drag.startY;
    drag.movedPx = Math.max(drag.movedPx, Math.hypot(totalDx, totalDy));

    // Upward swipe draws the focused card immediately
    if (
      !drag.swipedUp &&
      totalDy < -44 &&
      Math.abs(totalDy) > Math.abs(totalDx) * 1.2
    ) {
      drag.swipedUp = true;
      drag.active = false;
      const focused = clamp(
        Math.round(scrollPosRef.current),
        0,
        Math.max(0, deckIndicesRef.current.length - 1)
      );
      drawCardAtIndex(focused);
      return;
    }

    const dt = Math.max(1, now - drag.lastTime);
    const deltaCards = -dx / 23;
    const maxIdx = Math.max(0, deckIndicesRef.current.length - 1);
    setScrollPosWithTick(scrollPosRef.current + deltaCards, maxIdx);

    velocityRef.current = (deltaCards / dt) * 16;
    drag.lastX = event.clientX;
    drag.lastTime = now;
  };

  const handleFanPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    drag.active = false;
    drag.pointerId = null;

    const initialVelocity = velocityRef.current;
    const maxIdx = Math.max(0, deckIndicesRef.current.length - 1);

    if (Math.abs(initialVelocity) > 0.14) {
      const coast = () => {
        velocityRef.current *= 0.91;
        const next = scrollPosRef.current + velocityRef.current;
        if (next <= 0 || next >= maxIdx) {
          setScrollPosWithTick(clamp(next, 0, maxIdx), maxIdx);
          velocityRef.current = 0;
          inertiaRafRef.current = null;
          return;
        }
        setScrollPosWithTick(next, maxIdx);

        if (Math.abs(velocityRef.current) < 0.03) {
          inertiaRafRef.current = null;
          animateScrollTo(Math.round(scrollPosRef.current));
          return;
        }
        inertiaRafRef.current = window.requestAnimationFrame(coast);
      };
      inertiaRafRef.current = window.requestAnimationFrame(coast);
    } else if (drag.movedPx >= 10) {
      animateScrollTo(Math.round(scrollPosRef.current));
    }
  };

  // Compute the 28-card visible arc fan window
  const remainingCount = deckIndices.length;
  const focusedIndex = clamp(
    Math.round(scrollPos),
    0,
    Math.max(0, remainingCount - 1)
  );

  const visibleFanCards = useMemo(() => {
    if (remainingCount === 0) return [];
    const visibleCount = Math.min(MAX_VISIBLE_FAN, remainingCount);
    const half = Math.floor(visibleCount / 2);
    const start = clamp(
      focusedIndex - half,
      0,
      Math.max(0, remainingCount - visibleCount)
    );
    const end = Math.min(remainingCount - 1, start + visibleCount - 1);

    const items: Array<{ deckPos: number; tarotIdx: number; offset: number }> = [];
    for (let i = start; i <= end; i++) {
      items.push({
        deckPos: i,
        tarotIdx: deckIndices[i],
        offset: i - scrollPos,
      });
    }
    return items;
  }, [deckIndices, focusedIndex, remainingCount, scrollPos]);

  const activeSlotLabel =
    slotLabels[drawnCards.length] ??
    `第 ${Math.min(drawnCards.length + 1, requiredCount)} 张`;
  const isCompactSlots = requiredCount > 5;
  const sliderPercent =
    remainingCount > 1 ? (scrollPos / (remainingCount - 1)) * 100 : 50;

  return (
    <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center">
      {/* Top Ritual Header */}
      <div className="mb-3 flex w-full items-center justify-between gap-2 px-1">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition hover:opacity-90 active:scale-95"
            style={{
              borderColor: "var(--border-subtle, rgba(255,255,255,0.14))",
              backgroundColor: "var(--bg-glass, rgba(12,15,28,0.62))",
              color: "var(--text-secondary, #cbbca0)",
            }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回
          </button>
        ) : (
          <div className="w-14" />
        )}

        <div className="flex flex-col items-center text-center">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[11px] font-medium tracking-[0.14em]"
            style={{
              borderColor: "var(--border-accent, rgba(212,175,55,0.36))",
              backgroundColor: "var(--bg-glass, rgba(12,15,28,0.68))",
              color: "var(--accent-strong, #f3d98a)",
            }}
          >
            <Sparkles className="h-3 w-3" />
            {spreadName} · {requiredCount} 张牌阵
          </span>
        </div>

        <div className="w-14 text-right">
          {stage === "draw" ? (
            <button
              type="button"
              onClick={() => {
                if (drawnCards.length > 0 || isQuickDrawing) return;
                setStage("shuffle");
              }}
              disabled={drawnCards.length > 0 || isQuickDrawing}
              className="text-[11px] tracking-wider opacity-75 transition hover:opacity-100 disabled:pointer-events-none disabled:opacity-30"
              style={{ color: "var(--text-secondary, #cbbca0)" }}
            >
              重洗
            </button>
          ) : null}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {stage === "shuffle" ? (
          /* ===================== STAGE 1: TACTILE SHUFFLE & CUT ===================== */
          <motion.section
            key="ritual-stage-shuffle"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="flex w-full flex-col items-center py-2 sm:py-4"
          >
            <p
              className="mb-1 text-center font-serif text-base font-medium tracking-wider sm:text-lg"
              style={{ color: "var(--text-primary, #f5ead2)" }}
            >
              静心默念你的问题，轻触牌堆洗牌调频
            </p>
            <p
              className="mb-6 text-center text-xs tracking-[0.12em] opacity-75"
              style={{ color: "var(--text-secondary, #cbbca0)" }}
            >
              完整 78 张塔罗已就绪 · 已调频洗牌 {shuffleCount} 次
            </p>

            {/* 3D Physical Stacked Tarot Deck on Cloth */}
            <div
              role="button"
              tabIndex={0}
              aria-label="轻触牌堆执行洗牌"
              onClick={() => runShuffle(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  runShuffle(true);
                }
              }}
              className="group relative flex h-[288px] w-full max-w-[340px] cursor-pointer items-center justify-center outline-none select-none sm:h-[316px]"
              style={{ perspective: "1200px", WebkitTapHighlightColor: "transparent" }}
            >
              {/* Sacred altar ambient ring pulse under the deck */}
              <motion.div
                aria-hidden="true"
                animate={{
                  scale: deckMotion !== "idle" ? [1, 1.12, 1] : [1, 1.04, 1],
                  opacity: deckMotion !== "idle" ? [0.45, 0.78, 0.45] : [0.25, 0.42, 0.25],
                }}
                transition={{ duration: deckMotion !== "idle" ? 0.65 : 3.4, repeat: Infinity }}
                className="pointer-events-none absolute h-56 w-56 rounded-full blur-2xl"
                style={{
                  background: `radial-gradient(circle, ${accentColor}55 0%, transparent 70%)`,
                }}
              />

              {/* Subtle inlaid deck shadow pad */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute h-[238px] w-[142px] translate-y-4 rounded-[14px] bg-black/55 blur-xl sm:h-[268px] sm:w-[160px]"
              />

              {/* 9-Layer Stacked Physical 350gsm Cards */}
              <div className="relative h-[232px] w-[136px] sm:h-[266px] sm:w-[156px]">
                {STACK_LAYERS.map((layerIdx) => {
                  const isUpperHalf = layerIdx >= 4;
                  const isEven = layerIdx % 2 === 0;
                  const restOffsetY = -layerIdx * 1.9;
                  const restOffsetX = (layerIdx - 4) * 0.45;

                  let animX: number | number[] = restOffsetX;
                  let animY: number | number[] = restOffsetY;
                  let animRotate: number | number[] = 0;

                  if (deckMotion === "shuffling") {
                    const spreadDir = isEven ? -1 : 1;
                    const magnitude = 52 + (layerIdx % 3) * 14;
                    animX = [restOffsetX, spreadDir * magnitude, restOffsetX];
                    animY = [restOffsetY, restOffsetY - 12 - (layerIdx % 4) * 4, restOffsetY];
                    animRotate = [0, spreadDir * (8 + (layerIdx % 3) * 3), 0];
                  } else if (deckMotion === "cutting") {
                    const dir = isUpperHalf ? -1 : 1;
                    animX = [restOffsetX, dir * 68, dir * 64, restOffsetX];
                    animY = [
                      restOffsetY,
                      isUpperHalf ? restOffsetY - 16 : restOffsetY + 6,
                      isUpperHalf ? restOffsetY + 6 : restOffsetY - 14,
                      restOffsetY,
                    ];
                    animRotate = [0, dir * 8, dir * 4, 0];
                  }

                  return (
                    <motion.div
                      key={layerIdx}
                      animate={{
                        x: animX,
                        y: animY,
                        rotate: animRotate,
                      }}
                      transition={{
                        duration: deckMotion === "shuffling" ? 0.62 : 0.6,
                        delay:
                          deckMotion === "shuffling"
                            ? layerIdx * 0.022
                            : isUpperHalf
                              ? 0
                              : 0.04,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="absolute inset-0 overflow-hidden rounded-[12px]"
                      style={{
                        zIndex: layerIdx + 1,
                        border: `1.2px solid ${cardEdgeColor}cc`,
                        boxShadow:
                          layerIdx === STACK_LAYERS.length - 1
                            ? `0 10px 26px rgba(0,0,0,0.52), 0 0 0 1px ${cardEdgeColor}66, inset 0 1px 0 rgba(255,255,255,0.28)`
                            : `0 2px 6px rgba(0,0,0,0.45)`,
                      }}
                    >
                      <CardBackArtwork deckId={deckId} themeId={themeId} />
                    </motion.div>
                  );
                })}
              </div>

              {/* Subtle floating tap affordance */}
              <span
                className="pointer-events-none absolute -bottom-1 rounded-full border px-2.5 py-0.5 text-[10px] tracking-[0.16em] opacity-75 backdrop-blur-sm transition group-hover:opacity-100"
                style={{
                  borderColor: "var(--border-subtle, rgba(255,255,255,0.16))",
                  backgroundColor: "var(--bg-glass, rgba(9,11,20,0.65))",
                  color: "var(--text-secondary, #cbbca0)",
                }}
              >
                轻触牌堆可再次洗牌
              </span>
            </div>

            {/* Stage 1 Controls: Shuffle, Cut, and Glowing Gold Fan CTA */}
            <div className="mt-6 flex w-full max-w-sm flex-col gap-3 px-2">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={deckMotion !== "idle"}
                  onClick={() => runShuffle(true)}
                  className="flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium tracking-wider transition active:scale-[0.98] disabled:opacity-55"
                  style={{
                    borderColor: "var(--border-accent, rgba(212,175,55,0.35))",
                    backgroundColor: "var(--bg-glass, rgba(14,18,32,0.72))",
                    color: "var(--text-primary, #f5ead2)",
                  }}
                >
                  <Shuffle className="h-4 w-4" style={{ color: accentColor }} />
                  洗牌
                </button>

                <button
                  type="button"
                  disabled={deckMotion !== "idle"}
                  onClick={runCutDeck}
                  className="flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium tracking-wider transition active:scale-[0.98] disabled:opacity-55"
                  style={{
                    borderColor: "var(--border-accent, rgba(212,175,55,0.35))",
                    backgroundColor: "var(--bg-glass, rgba(14,18,32,0.72))",
                    color: "var(--text-primary, #f5ead2)",
                  }}
                >
                  <Scissors className="h-4 w-4" style={{ color: accentColor }} />
                  切牌
                </button>
              </div>

              <button
                type="button"
                disabled={deckMotion !== "idle"}
                onClick={handleEnterDrawStage}
                className="relative flex items-center justify-center gap-2 overflow-hidden rounded-2xl px-6 py-3.5 text-sm font-semibold tracking-[0.16em] text-[#141008] shadow-[0_8px_28px_rgba(212,175,55,0.38)] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
                style={{
                  background:
                    "linear-gradient(135deg, #f8e4a0 0%, #d9b44a 48%, #c2952e 100%)",
                }}
              >
                <Wand2 className="h-4 w-4" />
                展开扇面抽牌
              </button>
            </div>
          </motion.section>
        ) : (
          /* ===================== STAGE 2: CURVED MOBILE ARC FAN ===================== */
          <motion.section
            key="ritual-stage-draw"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
            className="flex w-full flex-col items-center"
          >
            {/* Top Glowing Slot Tray */}
            <div
              className="w-full rounded-2xl border px-3 py-3 backdrop-blur-md sm:px-4"
              style={{
                borderColor: "var(--border-subtle, rgba(255,255,255,0.12))",
                backgroundColor: "var(--bg-glass, rgba(12,15,28,0.68))",
              }}
            >
              <div className="mb-2.5 flex items-center justify-between gap-2 text-xs">
                <span
                  className="font-medium tracking-wider"
                  style={{ color: "var(--accent-strong, #f3d98a)" }}
                >
                  已抽 {drawnCards.length} / {requiredCount} 张
                </span>
                <span
                  className="truncate text-[11px] tracking-wide opacity-80"
                  style={{ color: "var(--text-secondary, #cbbca0)" }}
                >
                  {drawnCards.length < requiredCount
                    ? `下一牌位：${activeSlotLabel}`
                    : "全部牌位已落定"}
                </span>
              </div>

              {/* Miniature Spread Slots Strip */}
              <div
                className={`flex items-start gap-2 ${
                  isCompactSlots
                    ? "overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:justify-center"
                    : "flex-wrap justify-center gap-3"
                }`}
              >
                {Array.from({ length: requiredCount }, (_, slotIdx) => {
                  const filled = slotIdx < drawnCards.length;
                  const isNext = slotIdx === drawnCards.length;
                  const label = slotLabels[slotIdx] ?? `牌位 ${slotIdx + 1}`;

                  return (
                    <div
                      key={slotIdx}
                      className={`flex shrink-0 flex-col items-center gap-1 ${
                        isCompactSlots ? "w-11" : "w-14"
                      }`}
                    >
                      <div
                        className={`relative flex items-center justify-center overflow-hidden rounded-[6px] transition-all duration-300 ${
                          isCompactSlots ? "h-[54px] w-[32px]" : "h-[68px] w-[40px]"
                        }`}
                        style={{
                          border: filled
                            ? `1.2px solid ${cardEdgeColor}`
                            : isNext
                              ? `1.2px dashed ${accentColor}`
                              : "1px dashed rgba(255,255,255,0.22)",
                          boxShadow: filled
                            ? `0 0 14px ${accentColor}55`
                            : isNext
                              ? `0 0 10px ${accentColor}30`
                              : undefined,
                          backgroundColor: filled
                            ? "transparent"
                            : "rgba(255,255,255,0.03)",
                        }}
                      >
                        {filled ? (
                          <motion.div
                            initial={{ scale: 0.45, opacity: 0, y: 18 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            transition={{
                              type: "spring",
                              stiffness: 340,
                              damping: 24,
                            }}
                            className="h-full w-full"
                          >
                            <CardBackArtwork deckId={deckId} themeId={themeId} />
                          </motion.div>
                        ) : (
                          <span
                            className="font-serif text-[10px] font-medium"
                            style={{
                              color: isNext
                                ? accentColor
                                : "var(--text-muted, rgba(200,190,170,0.45))",
                            }}
                          >
                            {slotIdx + 1}
                          </span>
                        )}
                      </div>
                      <span
                        className="w-full truncate text-center text-[10px] leading-tight"
                        style={{
                          color: isNext
                            ? "var(--accent-strong, #f3d98a)"
                            : "var(--text-muted, rgba(200,190,170,0.68))",
                        }}
                        title={label}
                      >
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Curved Mobile-First Arc Fan Arena */}
            <div className="relative mt-2 w-full">
              {/* Completion Overlay Pulse */}
              <AnimatePresence>
                {isCompleting ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center"
                  >
                    <div
                      className="flex items-center gap-2 rounded-full border px-5 py-2.5 text-xs font-medium tracking-[0.16em] shadow-2xl backdrop-blur-xl"
                      style={{
                        borderColor: `${accentColor}88`,
                        backgroundColor: "rgba(9,11,20,0.88)",
                        color: "#f8e4a0",
                      }}
                    >
                      <Sparkles className="h-4 w-4 animate-pulse text-[#f3d98a]" />
                      牌阵已成 · 正在为您铺展牌面
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {/* Flying Cards Launched into Slots */}
              <AnimatePresence>
                {flyingCards.map((fly) => (
                  <motion.div
                    key={fly.id}
                    initial={{ opacity: 1, y: 0, scale: 1.04, rotate: 0 }}
                    animate={{ opacity: 0, y: -175, scale: 0.42, rotate: -6 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                    className="pointer-events-none absolute left-1/2 top-1/2 z-[60] -ml-[46px] -mt-[79px] h-[158px] w-[92px] overflow-hidden rounded-[9px]"
                    style={{
                      border: `1.4px solid ${cardEdgeColor}`,
                      boxShadow: `0 0 28px ${accentColor}99`,
                    }}
                  >
                    <CardBackArtwork deckId={deckId} themeId={themeId} />
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Interactive Fan Gesture Container */}
              <div
                onPointerDown={handleFanPointerDown}
                onPointerMove={handleFanPointerMove}
                onPointerUp={handleFanPointerUp}
                onPointerCancel={handleFanPointerUp}
                className="relative mx-auto h-[252px] w-full overflow-hidden select-none sm:h-[282px]"
                style={{
                  touchAction: "none",
                  cursor: "grab",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {/* Soft central candlelight behind focused card */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 top-[48%] h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-35 blur-3xl"
                  style={{
                    background: `radial-gradient(circle, ${accentColor} 0%, transparent 70%)`,
                  }}
                />

                {/* 28 Visible Cards Curved Along an Arc */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {visibleFanCards.map(({ deckPos, tarotIdx, offset }) => {
                    const absOffset = Math.abs(offset);
                    const focusWeight = Math.max(0, 1 - absOffset);
                    const isFocused = deckPos === focusedIndex;

                    const angle = offset * 4.2;
                    const translateX = offset * 22;
                    const translateY = offset * offset * 1.48 - focusWeight * 28 + 20;
                    const scale = 1 + focusWeight * 0.1;
                    const zIndex = 40 - Math.round(absOffset * 2);
                    const edgeFade = clamp(1.18 - absOffset * 0.055, 0.35, 1);

                    return (
                      <div
                        key={tarotIdx}
                        role="button"
                        tabIndex={isFocused ? 0 : -1}
                        aria-label={
                          isFocused
                            ? `抽取第 ${deckPos + 1} 张牌`
                            : `选择第 ${deckPos + 1} 张牌`
                        }
                        onClick={() => {
                          if (dragStateRef.current.movedPx >= 10) return;
                          if (isQuickDrawing || isCompleting) return;
                          if (isFocused) {
                            drawCardAtIndex(deckPos);
                          } else {
                            animateScrollTo(deckPos);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (!isFocused) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            drawCardAtIndex(deckPos);
                          }
                        }}
                        className="absolute h-[158px] w-[92px] overflow-hidden rounded-[9px] outline-none sm:h-[185px] sm:w-[108px]"
                        style={{
                          transform: `translate3d(${translateX}px, ${translateY}px, 0) rotate(${angle}deg) scale(${scale})`,
                          zIndex,
                          opacity: edgeFade,
                          border: isFocused
                            ? `1.6px solid ${cardEdgeColor}`
                            : `1px solid ${cardEdgeColor}88`,
                          boxShadow: isFocused
                            ? `0 18px 34px rgba(0,0,0,0.62), 0 0 24px ${accentColor}75, 0 0 0 1px rgba(255,245,205,0.55)`
                            : "0 8px 18px rgba(0,0,0,0.48)",
                          willChange: "transform",
                        }}
                      >
                        <CardBackArtwork deckId={deckId} themeId={themeId} />

                        {/* Focused card warm top rim shimmer */}
                        {isFocused ? (
                          <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0"
                            style={{
                              background:
                                "linear-gradient(155deg, rgba(255,244,200,0.22) 0%, transparent 45%, rgba(212,175,55,0.14) 100%)",
                            }}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {/* Focused swipe-up / tap micro hint */}
                {!isCompleting && remainingCount > 0 ? (
                  <div className="pointer-events-none absolute bottom-1.5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-black/45 px-2.5 py-0.5 text-[10px] tracking-[0.14em] text-[#f3e7cb]/85 backdrop-blur-md">
                    <ArrowUp className="h-3 w-3 text-[#f3d98a]" />
                    左右滑选 · 轻点或上滑抽牌
                  </div>
                ) : null}
              </div>
            </div>

            {/* Lunar Slider Bar for Effortless Thumb Scrubbing Across All 78 Cards */}
            <div className="mt-2 flex w-full max-w-md items-center gap-2.5 px-2">
              <button
                type="button"
                aria-label="向左切换一张"
                disabled={focusedIndex <= 0 || isQuickDrawing || isCompleting}
                onClick={() => animateScrollTo(focusedIndex - 1)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition active:scale-90 disabled:opacity-35"
                style={{
                  borderColor: "var(--border-subtle, rgba(255,255,255,0.16))",
                  backgroundColor: "var(--bg-glass, rgba(12,15,28,0.65))",
                  color: "var(--text-primary, #f5ead2)",
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="relative flex flex-1 flex-col items-center">
                <div className="relative flex h-7 w-full items-center">
                  {/* Sculpted Lunar Track */}
                  <div
                    className="h-[3px] w-full overflow-hidden rounded-full"
                    style={{
                      backgroundColor: "var(--border-subtle, rgba(255,255,255,0.16))",
                    }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${sliderPercent}%`,
                        background: `linear-gradient(90deg, ${accentColor}66 0%, ${accentColor} 100%)`,
                      }}
                    />
                  </div>

                  {/* Luminous Lunar Orb Indicator */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#fff4cc]"
                    style={{
                      left: `${sliderPercent}%`,
                      background: `radial-gradient(circle at 35% 35%, #fff7db 0%, ${accentColor} 70%)`,
                      boxShadow: `0 0 12px ${accentColor}`,
                    }}
                  />

                  {/* Accessible Native Range Input */}
                  <input
                    type="range"
                    aria-label="滑动浏览剩余塔罗牌阵"
                    min={0}
                    max={Math.max(0, remainingCount - 1)}
                    step={0.05}
                    value={clamp(scrollPos, 0, Math.max(0, remainingCount - 1))}
                    disabled={isQuickDrawing || isCompleting || remainingCount <= 1}
                    onChange={(e) => {
                      stopInertia();
                      setScrollPosWithTick(
                        Number(e.target.value),
                        Math.max(0, remainingCount - 1)
                      );
                    }}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </div>
                <span
                  className="text-[10px] tracking-[0.16em] opacity-75"
                  style={{ color: "var(--text-secondary, #cbbca0)" }}
                >
                  第 {Math.min(focusedIndex + 1, remainingCount)} / {remainingCount} 张待选
                </span>
              </div>

              <button
                type="button"
                aria-label="向右切换一张"
                disabled={
                  focusedIndex >= remainingCount - 1 || isQuickDrawing || isCompleting
                }
                onClick={() => animateScrollTo(focusedIndex + 1)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition active:scale-90 disabled:opacity-35"
                style={{
                  borderColor: "var(--border-subtle, rgba(255,255,255,0.16))",
                  backgroundColor: "var(--bg-glass, rgba(12,15,28,0.65))",
                  color: "var(--text-primary, #f5ead2)",
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Bottom Action Buttons: Draw Focused Card + Quick Draw Remaining */}
            <div className="mt-4 flex w-full max-w-md gap-2.5 px-2">
              <button
                type="button"
                disabled={isQuickDrawing || isCompleting || remainingCount === 0}
                onClick={() => drawCardAtIndex(focusedIndex)}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold tracking-[0.14em] text-[#141008] shadow-[0_6px_24px_rgba(212,175,55,0.34)] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
                style={{
                  background:
                    "linear-gradient(135deg, #f8e4a0 0%, #d9b44a 48%, #c2952e 100%)",
                }}
              >
                <Sparkles className="h-4 w-4" />
                抽取此牌
              </button>

              {requiredCount - drawnCards.length > 1 ? (
                <button
                  type="button"
                  disabled={isQuickDrawing || isCompleting}
                  onClick={handleQuickDrawRemaining}
                  className="flex shrink-0 items-center justify-center gap-1.5 rounded-2xl border px-3.5 py-3 text-xs font-medium tracking-wider transition active:scale-[0.98] disabled:opacity-45 sm:px-4"
                  style={{
                    borderColor: "var(--border-accent, rgba(212,175,55,0.38))",
                    backgroundColor: "var(--bg-glass, rgba(12,15,28,0.72))",
                    color: "var(--accent-strong, #f3d98a)",
                  }}
                >
                  <Zap className="h-3.5 w-3.5" />
                  随缘快抽剩余
                </button>
              ) : null}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
