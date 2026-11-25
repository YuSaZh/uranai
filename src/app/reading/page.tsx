"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Eye,
  RotateCcw,
  Quote,
  Check,
  Layers,
  LayoutGrid,
  GalleryHorizontalEnd,
  Heart,
  Briefcase,
  Coins,
  BookOpen,
  Compass,
  Filter,
  Tablet,
  ScanSearch,
} from "lucide-react";
import { useUranai } from "@/context/UranaiProvider";
import {
  READING_CATEGORIES,
  SPREADS,
  getCategoryById,
  getSpreadById,
} from "@/data/spreads";
import { TAROT_CARDS, getCardById } from "@/data/tarot-cards";
import { getDeckPoolShortLabel, getPoolCardIds } from "@/lib/deck-pool";
import { getLocalDateKey } from "@/lib/storage";
import { soundEngine } from "@/lib/sound";
import { ShuffleAndDrawRitual } from "@/components/tarot/ShuffleAndDrawRitual";
import { DeckPoolModal } from "@/components/tarot/DeckPoolModal";
import { TarotCard3D } from "@/components/tarot/TarotCard3D";
import { CardInspectorModal } from "@/components/tarot/CardInspectorModal";
import {
  AiInterpretationPanel,
  type AiReadingCardInput,
} from "@/components/reading/AiInterpretationPanel";
import type {
  DrawnCard,
  ReadingCategoryId,
  ReadingRecord,
  SpreadDefinition,
  SpreadId,
  TarotCard,
} from "@/types/tarot";

type StepNumber = 1 | 2 | 3 | 4;

const STEP_LABELS: Array<{ num: StepNumber; label: string }> = [
  { num: 1, label: "提问" },
  { num: 2, label: "选阵" },
  { num: 3, label: "抽牌" },
  { num: 4, label: "解牌" },
];

function getDomainInterpretation(
  card: TarotCard,
  reversed: boolean,
  category: ReadingCategoryId
): { label: string; text: string; Icon: typeof Sparkles } {
  switch (category) {
    case "love":
      return {
        label: "情感羁绊详释",
        text: reversed ? card.loveReversed : card.loveUpright,
        Icon: Heart,
      };
    case "career":
      return {
        label: "事业前程详释",
        text: reversed ? card.careerReversed : card.careerUpright,
        Icon: Briefcase,
      };
    case "study":
      return {
        label: "学业进阶与成长指引",
        text: reversed ? card.careerReversed : card.careerUpright,
        Icon: BookOpen,
      };
    case "wealth":
      return {
        label: "财富丰盛详释",
        text: reversed ? card.wealthReversed : card.wealthUpright,
        Icon: Coins,
      };
    case "decision":
      return {
        label: "抉择破局视角",
        text: reversed ? card.adviceReversed : card.adviceUpright,
        Icon: Compass,
      };
    default:
      return {
        label: "综合运势启示",
        text: reversed ? card.adviceReversed : card.adviceUpright,
        Icon: Sparkles,
      };
  }
}

function SpreadMiniDiagram({ spread }: { spread: SpreadDefinition }) {
  return (
    <div
      aria-hidden="true"
      className="relative h-24 w-full overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/65"
    >
      {/* Subtle geometric altar circle */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--border-accent)] opacity-25" />
      {spread.slots.map((slot) => (
        <span
          key={slot.index}
          className="absolute flex h-5 w-3.5 items-center justify-center rounded-[3px] border border-[var(--accent)]/80 bg-[var(--accent-soft)] text-[7px] font-semibold text-[var(--accent-strong)] shadow-[0_0_8px_var(--cloth-glow)]"
          style={{
            left: `${slot.x}%`,
            top: `${slot.y}%`,
            transform: `translate(-50%, -50%) rotate(${slot.rotation ?? 0}deg)`,
          }}
        >
          {slot.index + 1}
        </span>
      ))}
    </div>
  );
}

export default function ReadingPage() {
  const {
    prefs,
    theme,
    deck,
    aiConfig,
    addReading,
    updateReading,
    setDeckId,
    updateDeckPool,
  } = useUranai();

  const [step, setStep] = useState<StepNumber>(1);
  const [categoryId, setCategoryId] = useState<ReadingCategoryId>("love");
  const [question, setQuestion] = useState<string>("");
  const [spreadId, setSpreadId] = useState<SpreadId>("time-flow");
  const [deckPoolOpen, setDeckPoolOpen] = useState<boolean>(false);

  const [drawnCards, setDrawnCards] = useState<DrawnCard[]>([]);
  const [currentReadingId, setCurrentReadingId] = useState<string | null>(null);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number>(0);
  const [savedAiText, setSavedAiText] = useState<string>("");
  const [largeSpreadView, setLargeSpreadView] = useState<"spatial" | "focus">(
    "spatial"
  );

  const [inspectTarget, setInspectTarget] = useState<{
    card: TarotCard;
    reversed: boolean;
  } | null>(null);

  const revealTimersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      revealTimersRef.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const activeCategory = useMemo(
    () => getCategoryById(categoryId),
    [categoryId]
  );
  const activeSpread = useMemo(() => getSpreadById(spreadId), [spreadId]);

  const activePoolCardIds = useMemo(
    () => getPoolCardIds(prefs.deckPool, TAROT_CARDS),
    [prefs.deckPool]
  );
  const poolShortLabel = useMemo(
    () => getDeckPoolShortLabel(prefs.deckPool, activePoolCardIds.length),
    [activePoolCardIds.length, prefs.deckPool]
  );
  const poolTooSmallForSpread = activePoolCardIds.length < activeSpread.cardCount;

  const effectiveQuestion = useMemo(() => {
    const trimmed = question.trim();
    return trimmed || `关于「${activeCategory.nameZh}」的${activeSpread.nameZh}启示`;
  }, [activeCategory.nameZh, activeSpread.nameZh, question]);

  const revealedCount = useMemo(
    () => drawnCards.filter((c) => c.revealed).length,
    [drawnCards]
  );
  const allRevealed =
    drawnCards.length > 0 && revealedCount === drawnCards.length;

  const triggerHaptic = useCallback(
    (pattern: number | number[]) => {
      if (
        prefs.hapticsEnabled &&
        typeof navigator !== "undefined" &&
        "vibrate" in navigator
      ) {
        navigator.vibrate(pattern);
      }
    },
    [prefs.hapticsEnabled]
  );

  const handleSelectCategory = (nextCat: ReadingCategoryId) => {
    soundEngine.playHoverTick(prefs.soundEnabled);
    setCategoryId(nextCat);
    // Smartly pre-highlight a recommended spread if current isn't recommended
    const currentSpread = getSpreadById(spreadId);
    if (!currentSpread.recommendedFor.includes(nextCat)) {
      const recommended = SPREADS.find((s) => s.recommendedFor.includes(nextCat));
      if (recommended) {
        setSpreadId(recommended.id);
      }
    }
  };

  const handleDrawComplete = useCallback(
    (drawn: DrawnCard[]) => {
      const nowIso = new Date().toISOString();
      const readingId = `spread-${Date.now()}`;
      const record: ReadingRecord = {
        id: readingId,
        mode: "spread",
        dateKey: getLocalDateKey(),
        category: categoryId,
        question: effectiveQuestion,
        spreadId: activeSpread.id,
        deckId: deck.id,
        themeId: theme.id,
        cards: drawn,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      setDrawnCards(drawn);
      setCurrentReadingId(readingId);
      setActiveSlotIndex(0);
      setSavedAiText("");
      setLargeSpreadView(drawn.length >= 6 ? "spatial" : "spatial");
      addReading(record);
      setStep(4);
    },
    [activeSpread.id, addReading, categoryId, deck.id, effectiveQuestion, theme.id]
  );

  const handleCardInteract = useCallback(
    (slotIndex: number) => {
      const target = drawnCards[slotIndex];
      if (!target) return;
      const card = getCardById(target.cardId);
      if (!card) return;

      setActiveSlotIndex(slotIndex);

      if (!target.revealed) {
        soundEngine.playCardFlip(prefs.soundEnabled);
        triggerHaptic(16);

        const nextCards = drawnCards.map((item, idx) =>
          idx === slotIndex ? { ...item, revealed: true } : item
        );
        setDrawnCards(nextCards);
        if (currentReadingId) {
          updateReading(currentReadingId, { cards: nextCards });
        }
      } else {
        soundEngine.playHoverTick(prefs.soundEnabled);
        setInspectTarget({ card, reversed: target.reversed });
      }
    },
    [
      currentReadingId,
      drawnCards,
      prefs.soundEnabled,
      triggerHaptic,
      updateReading,
    ]
  );

  const handleRevealAll = useCallback(() => {
    const unrevealedIndices = drawnCards
      .map((item, idx) => (item.revealed ? -1 : idx))
      .filter((idx) => idx >= 0);

    if (unrevealedIndices.length === 0) return;

    revealTimersRef.current.forEach((id) => window.clearTimeout(id));
    revealTimersRef.current = [];

    unrevealedIndices.forEach((slotIdx, order) => {
      const timerId = window.setTimeout(() => {
        soundEngine.playCardFlip(prefs.soundEnabled);
        triggerHaptic(12);
        setDrawnCards((prev) => {
          const next = prev.map((item, idx) =>
            idx === slotIdx ? { ...item, revealed: true } : item
          );
          if (order === unrevealedIndices.length - 1 && currentReadingId) {
            updateReading(currentReadingId, { cards: next });
          }
          return next;
        });
      }, order * 140);
      revealTimersRef.current.push(timerId);
    });
  }, [
    currentReadingId,
    drawnCards,
    prefs.soundEnabled,
    triggerHaptic,
    updateReading,
  ]);

  const handleStartNewReading = () => {
    revealTimersRef.current.forEach((id) => window.clearTimeout(id));
    revealTimersRef.current = [];
    soundEngine.playShuffle(prefs.soundEnabled);
    setDrawnCards([]);
    setCurrentReadingId(null);
    setSavedAiText("");
    setActiveSlotIndex(0);
    setStep(1);
  };

  // Build AI reading card payload once drawn
  const aiCardsPayload = useMemo<AiReadingCardInput[]>(() => {
    return drawnCards.flatMap((dc): AiReadingCardInput[] => {
      const card = getCardById(dc.cardId);
      const slot = activeSpread.slots[dc.slotIndex];
      if (!card || !slot) return [];
      return [
        {
          slotLabel: `${dc.slotIndex + 1}. ${slot.labelZh}`,
          slotDescription: slot.description,
          nameZh: card.nameZh,
          nameEn: card.nameEn,
          reversed: dc.reversed,
          keywords: dc.reversed ? card.keywordsReversed : card.keywordsUpright,
          meaning: dc.reversed ? card.meaningReversed : card.meaningUpright,
        },
      ];
    });
  }, [activeSpread.slots, drawnCards]);

  const activeDrawn = drawnCards[activeSlotIndex];
  const activeCard = activeDrawn ? getCardById(activeDrawn.cardId) : undefined;
  const activeSlot = activeSpread.slots[activeSlotIndex];

  const renderSpreadTableCard = (
    slotIndex: number,
    size: "xs" | "sm" | "md" | "lg",
    extraClass = ""
  ) => {
    const dc = drawnCards[slotIndex];
    const slot = activeSpread.slots[slotIndex];
    if (!dc || !slot) return null;
    const card = getCardById(dc.cardId);
    if (!card) return null;

    const isFocused = activeSlotIndex === slotIndex;

    return (
      <div
        key={`${dc.cardId}-${slotIndex}`}
        className={`flex flex-col items-center gap-1.5 ${extraClass}`}
      >
        <TarotCard3D
          card={card}
          deckId={deck.id}
          themeId={theme.id}
          flipped={dc.revealed}
          reversed={dc.reversed}
          size={size}
          interactive
          tiltEnabled={dc.revealed}
          gyroEnabled={false}
          soundEnabled={prefs.soundEnabled}
          glowActive={isFocused || !dc.revealed}
          onClick={() => handleCardInteract(slotIndex)}
        />
        <button
          type="button"
          onClick={() => setActiveSlotIndex(slotIndex)}
          className={`max-w-[96px] truncate rounded-full border px-2 py-0.5 text-[10px] font-medium transition sm:max-w-[130px] ${
            isFocused
              ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
              : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 text-[var(--text-secondary)]"
          }`}
        >
          {slotIndex + 1}. {slot.labelZh}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header + Elegant 4-Step Progress Stepper */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="font-display text-xs tracking-[0.26em] text-[var(--accent)] uppercase">
              Custom Spread Reading
            </p>
            <h1 className="font-display mt-0.5 text-2xl font-semibold tracking-wide text-[var(--text-primary)] sm:text-3xl">
              定制问题牌阵占卜
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/assist"
              onClick={() => soundEngine.playHoverTick(prefs.soundEnabled)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/75 px-3.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] backdrop-blur-md transition hover:border-[var(--border-accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)] active:scale-95"
            >
              <ScanSearch className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span>实体牌辅助</span>
            </Link>
            <Link
              href="/table"
              onClick={() => soundEngine.playHoverTick(prefs.soundEnabled)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-accent)] bg-[var(--bg-surface)]/75 px-3.5 py-1.5 text-xs font-medium text-[var(--accent-strong)] backdrop-blur-md transition hover:bg-[var(--accent-soft)] hover:brightness-110 active:scale-95"
            >
              <Tablet className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span>切换虚拟桌面模式 (iPad)</span>
            </Link>
            {step === 4 && (
              <button
                type="button"
                onClick={handleStartNewReading}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-3.5 py-1.5 text-xs font-medium text-[var(--accent-strong)] transition hover:brightness-110 active:scale-95"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                开启新的占卜
              </button>
            )}
          </div>
        </div>

        {/* 4-Step Progress Stepper */}
        <nav aria-label="占卜进度" className="uranai-glass rounded-2xl px-3 py-2.5 sm:px-5">
          <ol className="flex items-center justify-between gap-1 sm:gap-2">
            {STEP_LABELS.map((item, idx) => {
              const isCurrent = step === item.num;
              const isDone = step > item.num;
              const canJumpBack =
                (item.num === 1 && step === 2) ||
                (item.num === 2 && step === 3) ||
                (item.num === 1 && step === 3);

              return (
                <React.Fragment key={item.num}>
                  <li className="flex items-center gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      disabled={!canJumpBack}
                      onClick={() => {
                        if (canJumpBack) {
                          soundEngine.playHoverTick(prefs.soundEnabled);
                          setStep(item.num);
                        }
                      }}
                      className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition ${
                        canJumpBack ? "cursor-pointer hover:opacity-90" : "cursor-default"
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold transition ${
                          isCurrent
                            ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[0_0_16px_var(--cloth-glow)]"
                            : isDone
                              ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                              : "border-[var(--border-subtle)] text-[var(--text-muted)]"
                        }`}
                      >
                        {isDone ? <Check className="h-3.5 w-3.5" /> : item.num}
                      </span>
                      <span
                        className={
                          isCurrent
                            ? "font-semibold text-[var(--text-primary)]"
                            : isDone
                              ? "text-[var(--accent-strong)]"
                              : "text-[var(--text-muted)]"
                        }
                      >
                        {item.label}
                      </span>
                    </button>
                  </li>
                  {idx < STEP_LABELS.length - 1 && (
                    <li
                      aria-hidden="true"
                      className={`h-[1px] flex-1 transition-colors ${
                        step > item.num
                          ? "bg-[var(--accent)]"
                          : "bg-[var(--border-subtle)]"
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </ol>
        </nav>
      </header>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        {/* ================================================================
            STEP 1: Category & Question
           ================================================================ */}
        {step === 1 && (
          <motion.section
            key="step-1"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="uranai-glass gold-shimmer-border space-y-6 rounded-3xl p-5 sm:p-6"
          >
            {/* 6 Category Pills */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
                  选择占卜领域
                </h2>
                <span className="text-xs text-[var(--text-muted)]">
                  {activeCategory.nameEn}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {READING_CATEGORIES.map((cat) => {
                  const active = cat.id === categoryId;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleSelectCategory(cat.id)}
                      className={`flex items-center gap-2.5 rounded-2xl border px-3.5 py-3 text-left transition active:scale-[0.98] ${
                        active
                          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text-primary)] shadow-[0_0_20px_var(--cloth-glow)]"
                          : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 text-[var(--text-secondary)] hover:border-[var(--border-accent)]"
                      }`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--border-accent)] bg-[var(--bg-base)]/50 text-base text-[var(--accent)]">
                        {cat.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--text-primary)]">
                          {cat.nameZh}
                        </div>
                        <div className="truncate text-[10px] text-[var(--text-muted)]">
                          {cat.nameEn}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Golden-bordered Question Textarea */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="reading-question"
                  className="font-display text-base font-semibold text-[var(--text-primary)]"
                >
                  默念并写下你的问题
                </label>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {question.length} / 200
                </span>
              </div>

              <textarea
                id="reading-question"
                rows={3}
                maxLength={200}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={`例如：${activeCategory.sampleQuestions[0]}`}
                className="w-full resize-none rounded-2xl border border-[var(--border-accent)] bg-[var(--bg-base)]/65 px-4 py-3.5 text-sm leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-muted)] shadow-inner focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/40 focus:outline-none"
              />
            </div>

            {/* Clickable Sample Questions */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--text-muted)]">
                ✦ 灵感参考问题（轻触直接填入）
              </p>
              <div className="flex flex-wrap gap-2">
                {activeCategory.sampleQuestions.map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => {
                      soundEngine.playHoverTick(prefs.soundEnabled);
                      setQuestion(sample);
                    }}
                    className={`rounded-2xl border px-3 py-2 text-left text-xs leading-snug transition active:scale-[0.98] ${
                      question === sample
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text-primary)]"
                        : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 text-[var(--text-secondary)] hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playHoverTick(prefs.soundEnabled);
                  setStep(2);
                }}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-[var(--accent-contrast)] shadow-[0_8px_28px_var(--cloth-glow)] transition hover:brightness-110 active:scale-95"
              >
                下一步：选择牌阵
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </motion.section>
        )}

        {/* ================================================================
            STEP 2: Spread Selection with Live Mini Slot Diagrams
           ================================================================ */}
        {step === 2 && (
          <motion.section
            key="step-2"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            {/* Question Preview Pill */}
            <div className="uranai-glass flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-2.5 py-0.5 font-medium text-[var(--accent-strong)]">
                  {activeCategory.icon} {activeCategory.nameZh}
                </span>
                <span className="text-[var(--text-primary)]">
                  {effectiveQuestion}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-[var(--accent)] hover:underline"
              >
                修改问题
              </button>
            </div>

            {/* 6 Spread Cards */}
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {SPREADS.map((spread) => {
                const isSelected = spread.id === spreadId;
                const isRecommended = spread.recommendedFor.includes(categoryId);

                return (
                  <button
                    key={spread.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playHoverTick(prefs.soundEnabled);
                      setSpreadId(spread.id);
                    }}
                    className={`group flex flex-col justify-between rounded-3xl border p-4 text-left transition active:scale-[0.99] ${
                      isSelected
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]/60 shadow-[0_0_26px_var(--cloth-glow)]"
                        : "uranai-glass hover:border-[var(--border-accent)]"
                    }`}
                  >
                    <div className="space-y-3">
                      <SpreadMiniDiagram spread={spread} />

                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-display text-base font-semibold text-[var(--text-primary)]">
                            {spread.nameZh}
                          </h3>
                          <span className="rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-strong)]">
                            {spread.cardCount} 张
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[var(--text-muted)]">
                            {spread.difficulty}
                          </span>
                          {isRecommended && (
                            <span className="rounded-full border border-[var(--border-accent)] bg-[var(--accent)]/15 px-2 py-0.5 font-medium text-[var(--accent-strong)]">
                              ✦ 契合{activeCategory.nameZh}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                          {spread.summary}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1 border-t border-[var(--border-subtle)] pt-2.5">
                      {spread.slots.slice(0, 4).map((slot) => (
                        <span
                          key={slot.index}
                          className="rounded-md bg-[var(--bg-surface)]/70 px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]"
                        >
                          {slot.index + 1}.{slot.labelZh}
                        </span>
                      ))}
                      {spread.slots.length > 4 && (
                        <span className="rounded-md bg-[var(--bg-surface)]/70 px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                          +{spread.slots.length - 4} 牌位
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Deck Pool / Divination Rules Banner in Step 2 */}
            <div className="uranai-glass flex flex-wrap items-center justify-between gap-2.5 rounded-2xl px-4 py-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
                  <Filter className="h-3.5 w-3.5 text-[var(--accent)]" />
                  洗牌牌池规则
                </span>
                <span className="rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-2.5 py-0.5 font-semibold text-[var(--accent-strong)]">
                  {poolShortLabel}
                </span>
                {poolTooSmallForSpread ? (
                  <span className="text-amber-300">
                    当前牌池少于该牌阵所需的 {activeSpread.cardCount} 张，请扩充牌池
                  </span>
                ) : (
                  <span className="text-[var(--text-muted)]">
                    支持仅大阿卡纳、仅小牌、花色筛选或单张剔除
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playHoverTick(prefs.soundEnabled);
                  setDeckPoolOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--accent-strong)] transition hover:brightness-110 active:scale-95"
              >
                <Filter className="h-3.5 w-3.5" />
                自定义洗牌规则
              </button>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-glass)] px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)] backdrop-blur-md transition hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]"
              >
                <ArrowLeft className="h-4 w-4" />
                返回提问
              </button>

              <button
                type="button"
                disabled={poolTooSmallForSpread}
                onClick={() => {
                  soundEngine.playShuffle(prefs.soundEnabled);
                  setStep(3);
                }}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-[var(--accent-contrast)] shadow-[0_8px_28px_var(--cloth-glow)] transition hover:brightness-110 active:scale-95 disabled:opacity-45"
              >
                <Layers className="h-4 w-4" />
                进入洗牌与抽牌（{activeSpread.cardCount} 张）
              </button>
            </div>
          </motion.section>
        )}

        {/* ================================================================
            STEP 3: Shuffle & Arc Fan Draw Ritual directly on the Cloth
           ================================================================ */}
        {step === 3 && (
          <motion.section
            key="step-3"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <div className="uranai-glass flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-2.5 py-0.5 font-medium text-[var(--accent-strong)]">
                  {activeSpread.nameZh} · {activeSpread.cardCount} 张
                </span>
                <span className="text-[var(--text-primary)]">
                  {effectiveQuestion}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playHoverTick(prefs.soundEnabled);
                  setDeckPoolOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/75 px-3 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-accent)] hover:text-[var(--accent-strong)]"
              >
                <Filter className="h-3 w-3 text-[var(--accent)]" />
                <span>{poolShortLabel}</span>
              </button>
            </div>

            <ShuffleAndDrawRitual
              requiredCount={activeSpread.cardCount}
              spreadName={activeSpread.nameZh}
              slotLabels={activeSpread.slots.map((s) => s.labelZh)}
              deckId={deck.id}
              themeId={theme.id}
              poolCardIds={activePoolCardIds}
              poolLabel={poolShortLabel}
              onOpenPoolModal={() => setDeckPoolOpen(true)}
              allowReversed={prefs.allowReversed}
              soundEnabled={prefs.soundEnabled}
              hapticsEnabled={prefs.hapticsEnabled}
              onComplete={handleDrawComplete}
              onBack={() => setStep(2)}
            />
          </motion.section>
        )}

        {/* ================================================================
            STEP 4: Spread Table & Dual Interpretation
           ================================================================ */}
        {step === 4 && (
          <motion.section
            key="step-4"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="space-y-5"
          >
            {/* Spread Table Panel */}
            <div className="uranai-glass gold-shimmer-border rounded-[2rem] p-4 sm:p-6">
              {/* Top Reading Metadata & Reveal All Button */}
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-2.5 py-0.5 font-medium text-[var(--accent-strong)]">
                      {activeSpread.nameZh}
                    </span>
                    <span className="rounded-full border border-[var(--border-subtle)] px-2.5 py-0.5 text-[var(--text-secondary)]">
                      {activeCategory.icon} {activeCategory.nameZh}
                    </span>
                    <span className="text-[var(--text-muted)]">
                      已揭晓 {revealedCount} / {drawnCards.length} 张
                    </span>
                  </div>
                  <h2 className="font-display text-base font-semibold text-[var(--text-primary)] sm:text-lg">
                    {effectiveQuestion}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {drawnCards.length >= 6 && (
                    <div className="inline-flex rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/80 p-0.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setLargeSpreadView("spatial")}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition ${
                          largeSpreadView === "spatial"
                            ? "bg-[var(--accent)] font-semibold text-[var(--accent-contrast)]"
                            : "text-[var(--text-secondary)]"
                        }`}
                      >
                        <LayoutGrid className="h-3 w-3" />
                        总览
                      </button>
                      <button
                        type="button"
                        onClick={() => setLargeSpreadView("focus")}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition ${
                          largeSpreadView === "focus"
                            ? "bg-[var(--accent)] font-semibold text-[var(--accent-contrast)]"
                            : "text-[var(--text-secondary)]"
                        }`}
                      >
                        <GalleryHorizontalEnd className="h-3 w-3" />
                        聚焦
                      </button>
                    </div>
                  )}

                  {!allRevealed && (
                    <button
                      type="button"
                      onClick={handleRevealAll}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--accent-contrast)] shadow-[0_6px_22px_var(--cloth-glow)] transition hover:brightness-110 active:scale-95"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      一键展开全部牌面
                    </button>
                  )}
                </div>
              </div>

              {/* Instruction cue */}
              <p className="mb-4 text-center text-xs text-[var(--text-muted)]">
                {allRevealed
                  ? "轻触任意牌面开启 3D 追光鉴赏，或切换下方牌位细读解析"
                  : "轻触每一张背面牌依次翻开，感受牌阵能量的层层显化"}
              </p>

              {/* Responsive Spatial Spread Arrangements */}
              {activeSpread.cardCount === 1 && (
                <div className="flex justify-center py-3">
                  {renderSpreadTableCard(0, "lg")}
                </div>
              )}

              {activeSpread.cardCount === 3 && (
                <div className="flex flex-wrap items-start justify-center gap-2.5 py-2 sm:gap-6">
                  {drawnCards.map((_, idx) =>
                    renderSpreadTableCard(
                      idx,
                      "sm",
                      idx === 1 && activeSpread.id === "time-flow"
                        ? "sm:-translate-y-3"
                        : ""
                    )
                  )}
                </div>
              )}

              {activeSpread.cardCount === 5 && (
                /* Authentic Five-Card Cross spatial grid */
                <div className="mx-auto grid max-w-md grid-cols-3 place-items-center gap-y-3 py-2 sm:max-w-lg sm:gap-y-4">
                  <div />
                  <div>{renderSpreadTableCard(3, "xs")}</div>
                  <div />

                  <div>{renderSpreadTableCard(1, "xs")}</div>
                  <div>{renderSpreadTableCard(0, "xs")}</div>
                  <div>{renderSpreadTableCard(4, "xs")}</div>

                  <div />
                  <div>{renderSpreadTableCard(2, "xs")}</div>
                  <div />
                </div>
              )}

              {activeSpread.cardCount === 6 &&
                (largeSpreadView === "spatial" ? (
                  /* Mirror of Love symmetrical 3-column altar */
                  <div className="mx-auto grid max-w-xl grid-cols-3 place-items-center gap-x-2 gap-y-4 py-2 sm:gap-x-6">
                    <div>{renderSpreadTableCard(0, "xs")}</div>
                    <div>{renderSpreadTableCard(4, "xs")}</div>
                    <div>{renderSpreadTableCard(1, "xs")}</div>

                    <div>{renderSpreadTableCard(2, "xs")}</div>
                    <div>{renderSpreadTableCard(5, "xs")}</div>
                    <div>{renderSpreadTableCard(3, "xs")}</div>
                  </div>
                ) : (
                  <div className="flex gap-3.5 overflow-x-auto px-2 py-3 snap-x no-scrollbar">
                    {drawnCards.map((_, idx) => (
                      <div key={idx} className="shrink-0 snap-center">
                        {renderSpreadTableCard(idx, "md")}
                      </div>
                    ))}
                  </div>
                ))}

              {activeSpread.cardCount === 10 &&
                (largeSpreadView === "spatial" ? (
                  /* Celtic Cross: Cross section + Staff section responsive */
                  <div className="space-y-5 py-2">
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-[1.4fr_0.9fr] md:items-center">
                      {/* Left: 6-card Cross Core */}
                      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/45 p-3">
                        <div className="mb-2.5 text-center text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
                          十字核心 · 1–6
                        </div>
                        <div className="grid grid-cols-3 place-items-center gap-x-1.5 gap-y-3">
                          <div />
                          <div>{renderSpreadTableCard(2, "xs")}</div>
                          <div />

                          <div>{renderSpreadTableCard(4, "xs")}</div>
                          <div className="flex flex-col items-center gap-2">
                            {renderSpreadTableCard(0, "xs")}
                            <div className="rounded-xl border border-[var(--border-accent)] bg-[var(--accent-soft)]/60 p-1">
                              {renderSpreadTableCard(1, "xs")}
                            </div>
                          </div>
                          <div>{renderSpreadTableCard(5, "xs")}</div>

                          <div />
                          <div>{renderSpreadTableCard(3, "xs")}</div>
                          <div />
                        </div>
                      </div>

                      {/* Right: 4-card Staff Column (10 down to 7) */}
                      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/45 p-3">
                        <div className="mb-2.5 text-center text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
                          命运权杖 · 7–10
                        </div>
                        <div className="grid grid-cols-2 place-items-center gap-3 md:grid-cols-1">
                          <div>{renderSpreadTableCard(9, "xs")}</div>
                          <div>{renderSpreadTableCard(8, "xs")}</div>
                          <div>{renderSpreadTableCard(7, "xs")}</div>
                          <div>{renderSpreadTableCard(6, "xs")}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3.5 overflow-x-auto px-2 py-3 snap-x no-scrollbar">
                    {drawnCards.map((_, idx) => (
                      <div key={idx} className="shrink-0 snap-center">
                        {renderSpreadTableCard(idx, "md")}
                      </div>
                    ))}
                  </div>
                ))}
            </div>

            {/* ============================================================
                Dual Interpretation Part 1: Slot-by-Slot Base Meanings
               ============================================================ */}
            <section className="uranai-glass rounded-3xl p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-semibold tracking-wide text-[var(--text-primary)]">
                    基础牌义逐位解析
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    切换牌位查阅对应正逆位含义、{activeCategory.nameZh}专解与行动建议
                  </p>
                </div>
              </div>

              {/* Interactive Slot Switcher Pills */}
              <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {activeSpread.slots.map((slot) => {
                  const dc = drawnCards[slot.index];
                  const isFocused = activeSlotIndex === slot.index;
                  return (
                    <button
                      key={slot.index}
                      type="button"
                      onClick={() => {
                        soundEngine.playHoverTick(prefs.soundEnabled);
                        setActiveSlotIndex(slot.index);
                      }}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition active:scale-95 ${
                        isFocused
                          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]"
                          : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/75 text-[var(--text-secondary)] hover:border-[var(--border-accent)]"
                      }`}
                    >
                      <span>
                        {slot.index + 1}. {slot.labelZh}
                      </span>
                      {dc?.revealed && (
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isFocused
                              ? "bg-[var(--accent-contrast)]"
                              : "bg-[var(--accent)]"
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Active Slot Interpretation Card */}
              {activeSlot && activeDrawn && activeCard && (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 p-4 sm:p-5">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
                    <div>
                      <span className="font-display text-xs tracking-[0.18em] text-[var(--accent)] uppercase">
                        牌位 {activeSlot.index + 1} · {activeSlot.labelZh} ({activeSlot.labelEn})
                      </span>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {activeSlot.description}
                      </p>
                    </div>

                    {activeDrawn.revealed && (
                      <button
                        type="button"
                        onClick={() =>
                          setInspectTarget({
                            card: activeCard,
                            reversed: activeDrawn.reversed,
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-medium text-[var(--accent-strong)] transition hover:brightness-110"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        3D 鉴赏此牌
                      </button>
                    )}
                  </div>

                  {!activeDrawn.revealed ? (
                    <div className="flex flex-col items-center py-6 text-center">
                      <p className="text-sm text-[var(--text-secondary)]">
                        此牌位尚未揭晓，轻触翻开查看牌面启示。
                      </p>
                      <button
                        type="button"
                        onClick={() => handleCardInteract(activeSlot.index)}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-5 py-2 text-xs font-semibold text-[var(--accent-contrast)] transition hover:brightness-110 active:scale-95"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        翻开「{activeSlot.labelZh}」
                      </button>
                    </div>
                  ) : (
                    (() => {
                      const isRev = activeDrawn.reversed;
                      const keywords = isRev
                        ? activeCard.keywordsReversed
                        : activeCard.keywordsUpright;
                      const baseMeaning = isRev
                        ? activeCard.meaningReversed
                        : activeCard.meaningUpright;
                      const advice = isRev
                        ? activeCard.adviceReversed
                        : activeCard.adviceUpright;
                      const domain = getDomainInterpretation(
                        activeCard,
                        isRev,
                        categoryId
                      );
                      const DomainIcon = domain.Icon;

                      return (
                        <div className="space-y-4">
                          {/* Card Header */}
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-display text-xl font-semibold text-[var(--text-primary)]">
                              {activeCard.nameZh}
                            </h4>
                            <span className="text-xs text-[var(--text-muted)]">
                              {activeCard.nameEn}
                            </span>
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                                isRev
                                  ? "border-rose-400/45 bg-rose-500/15 text-rose-300"
                                  : "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                              }`}
                            >
                              {isRev ? "逆位 · Reversed" : "正位 · Upright"}
                            </span>
                          </div>

                          {/* Keywords */}
                          <div className="flex flex-wrap gap-1.5">
                            {keywords.map((kw) => (
                              <span
                                key={kw}
                                className="rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-2.5 py-0.5 text-[11px] text-[var(--accent-strong)]"
                              >
                                {kw}
                              </span>
                            ))}
                          </div>

                          {/* General Meaning */}
                          <p className="text-sm leading-[1.82] text-[var(--text-primary)]/95">
                            {baseMeaning}
                          </p>

                          {/* Category-Matched Interpretation */}
                          <div className="rounded-xl border border-[var(--border-accent)] bg-[var(--accent-soft)]/60 p-3.5">
                            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-strong)]">
                              <DomainIcon className="h-3.5 w-3.5" />
                              {domain.label}
                            </div>
                            <p className="text-xs leading-relaxed text-[var(--text-primary)]/90 sm:text-sm">
                              {domain.text}
                            </p>
                          </div>

                          {/* Action Advice & Affirmation */}
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/45 p-3.5">
                              <div className="text-[11px] font-semibold tracking-wider text-[var(--accent)]">
                                ✦ 行动指引
                              </div>
                              <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                                {advice}
                              </p>
                            </div>

                            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/45 p-3.5">
                              <div className="flex items-center gap-1 text-[11px] font-semibold tracking-wider text-[var(--accent)]">
                                <Quote className="h-3 w-3" />
                                心灵肯定语
                              </div>
                              <p className="font-display mt-1.5 text-xs leading-relaxed text-[var(--text-primary)] italic">
                                「{activeCard.affirmation}」
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              )}
            </section>

            {/* ============================================================
                Dual Interpretation Part 2: AI Comprehensive Synthesis
               ============================================================ */}
            <AiInterpretationPanel
              mode="spread"
              question={effectiveQuestion}
              category={activeCategory.nameZh}
              spreadName={`${activeSpread.nameZh}（${activeSpread.cardCount} 张）`}
              cards={aiCardsPayload}
              initialInterpretation={savedAiText}
              customAi={aiConfig}
              disabled={!allRevealed}
              disabledHint="翻开全部牌面后即可开启 AI 综合推理解读（可点击上方「一键展开全部牌面」）"
              onInterpretationComplete={(fullText) => {
                setSavedAiText(fullText);
                if (currentReadingId) {
                  updateReading(currentReadingId, {
                    aiInterpretation: fullText,
                  });
                }
              }}
            />

            {/* Bottom Start New Reading CTA */}
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleStartNewReading}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-accent)] bg-[var(--bg-glass)] px-6 py-2.5 text-xs font-medium text-[var(--text-primary)] backdrop-blur-md transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] active:scale-95"
              >
                <RotateCcw className="h-3.5 w-3.5 text-[var(--accent)]" />
                开启新的占卜
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Full 3D Card Inspector Modal */}
      <CardInspectorModal
        card={inspectTarget?.card ?? null}
        reversed={inspectTarget?.reversed ?? false}
        deckId={deck.id}
        themeId={theme.id}
        gyroEnabled={prefs.gyroEnabled}
        soundEnabled={prefs.soundEnabled}
        onDeckChange={setDeckId}
        onClose={() => setInspectTarget(null)}
      />

      {/* Deck Pool / Divination Rules Modal */}
      <DeckPoolModal
        open={deckPoolOpen}
        value={prefs.deckPool}
        minRequiredCards={activeSpread.cardCount}
        spreadLabel={activeSpread.nameZh}
        soundEnabled={prefs.soundEnabled}
        onApply={updateDeckPool}
        onClose={() => setDeckPoolOpen(false)}
      />
    </div>
  );
}
