"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  BookOpen,
  BookmarkCheck,
  BookmarkPlus,
  Briefcase,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Coins,
  Compass,
  Heart,
  Layers,
  Orbit,
  PencilLine,
  Plus,
  Quote,
  RotateCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type {
  AssistReadingTab,
  AssistSelectedCard,
  AssistSpreadId,
} from "@/components/assist/types";
import type {
  AiConfig,
  DeckDefinition,
  ReadingCategoryId,
  SuitType,
  TarotCard,
} from "@/types/tarot";
import {
  READING_CATEGORIES,
  SPREADS,
  getCategoryById,
  getSpreadById,
} from "@/data/spreads";
import { getCardById } from "@/data/tarot-cards";
import { getCardImagePath, getCardThumbPath } from "@/data/decks";
import {
  AiInterpretationPanel,
  type AiReadingCardInput,
} from "@/components/reading/AiInterpretationPanel";
import { soundEngine } from "@/lib/sound";

export interface AssistReadingPanelProps {
  selectedCards: AssistSelectedCard[];
  spreadId: AssistSpreadId;
  categoryId: ReadingCategoryId;
  question: string;
  deck: DeckDefinition;
  aiConfig: AiConfig;
  soundEnabled: boolean;
  savedRecordId: string | null;
  aiInterpretation: string;
  onSpreadChange: (spreadId: AssistSpreadId) => void;
  onCategoryChange: (categoryId: ReadingCategoryId) => void;
  onQuestionChange: (question: string) => void;
  onToggleReversed: (uid: string) => void;
  onMoveCard: (uid: string, direction: -1 | 1) => void;
  onRemoveCard: (uid: string) => void;
  onRenameSlot: (uid: string, label: string) => void;
  onClearAll: () => void;
  onQuickLookup: (
    card: TarotCard,
    reversed: boolean,
    selectedUid?: string,
    slotLabel?: string
  ) => void;
  onInspect3D: (card: TarotCard, reversed: boolean) => void;
  onSaveReading: () => void;
  onAiComplete: (fullText: string) => void;
  onBackToPicker?: () => void;
}

interface ResolvedAssistCard {
  entry: AssistSelectedCard;
  card: TarotCard;
  index: number;
  displaySlotLabel: string;
  slotDescription: string;
  isExtraCard: boolean;
}

const SUIT_SYMBOLS: Record<SuitType, string> = {
  major: "✦",
  wands: "🜂",
  cups: "🜄",
  swords: "🜁",
  pentacles: "🜃",
};

const READING_TABS: Array<{
  id: AssistReadingTab;
  label: string;
  heading: string;
  Icon: typeof Sparkles;
}> = [
  { id: "general", label: "基础牌义", heading: "核心牌义", Icon: Sparkles },
  { id: "love", label: "爱情", heading: "情感羁绊", Icon: Heart },
  { id: "career", label: "事业", heading: "事业与学业", Icon: Briefcase },
  { id: "wealth", label: "财富", heading: "财富流动", Icon: Coins },
  { id: "advice", label: "行动指引", heading: "行动指引", Icon: Compass },
];

const ELEMENT_ORDER = ["火", "水", "风", "土"] as const;

const COLLAPSE_PREVIEW_LIMIT = 4;

function getRecommendedTabForCategory(
  categoryId: ReadingCategoryId
): AssistReadingTab {
  switch (categoryId) {
    case "love":
      return "love";
    case "career":
    case "study":
      return "career";
    case "wealth":
      return "wealth";
    case "decision":
      return "advice";
    default:
      return "general";
  }
}

function getCardDimensionText(
  card: TarotCard,
  reversed: boolean,
  tab: AssistReadingTab
): string {
  switch (tab) {
    case "love":
      return reversed ? card.loveReversed : card.loveUpright;
    case "career":
      return reversed ? card.careerReversed : card.careerUpright;
    case "wealth":
      return reversed ? card.wealthReversed : card.wealthUpright;
    case "advice":
      return reversed ? card.adviceReversed : card.adviceUpright;
    default:
      return reversed ? card.meaningReversed : card.meaningUpright;
  }
}

interface AssistCardThumbProps {
  card: TarotCard;
  deck: DeckDefinition;
  reversed: boolean;
  onClick: () => void;
}

function AssistCardThumb({
  card,
  deck,
  reversed,
  onClick,
}: AssistCardThumbProps): React.ReactElement {
  const thumbPath = getCardThumbPath(deck.id, card.slug);
  const fullPath = getCardImagePath(deck.id, card.slug);
  const [useFullFallback, setUseFullFallback] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const activeSrc = !useFullFallback && thumbPath ? thumbPath : fullPath;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`速查 ${card.nameZh}（${reversed ? "逆位" : "正位"}）基础牌义`}
      title="点击快速查阅 5 维牌义"
      className={`group/thumb relative w-[68px] shrink-0 overflow-hidden rounded-xl border border-[var(--border-accent)]/80 bg-[#100e18] shadow-[0_6px_18px_rgba(0,0,0,0.28)] transition duration-200 hover:scale-[1.03] hover:border-[var(--accent)] active:scale-[0.98] sm:w-[74px] ${deck.aspectClass}`}
    >
      {activeSrc && !imageFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={activeSrc}
          alt={`${card.nameZh} (${card.nameEn})`}
          loading="lazy"
          decoding="async"
          onError={() => {
            if (!useFullFallback && fullPath && fullPath !== thumbPath) {
              setUseFullFallback(true);
            } else {
              setImageFailed(true);
            }
          }}
          className={`h-full w-full object-cover transition-transform duration-300 ${
            reversed ? "rotate-180" : ""
          }`}
        />
      ) : (
        <div
          className={`relative flex h-full w-full flex-col items-center justify-between bg-gradient-to-b from-[#261d14] via-[#17120e] to-[#0f0c0a] p-1.5 text-center transition-transform duration-300 ${
            reversed ? "rotate-180" : ""
          }`}
        >
          <span className="font-display text-[8px] tracking-widest text-[#e7ca7b]/85">
            {card.romanNumeral ?? String(card.number)}
          </span>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs text-[#f0d27a]">
              {SUIT_SYMBOLS[card.suit]}
            </span>
            <span className="font-display line-clamp-2 text-[10px] leading-tight font-semibold text-[#f7ebd2]">
              {card.nameZh}
            </span>
          </div>
          <span className="text-[7px] text-[#d4af37]/70">✦</span>
        </div>
      )}

      {/* Subtle hover lookup cue */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity duration-200 group-hover/thumb:opacity-100"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#f0d27a]/60 bg-black/65 text-[#f5df94] shadow-md">
          <BookOpen className="h-3.5 w-3.5" />
        </span>
      </div>

      {/* Reversed corner badge on art */}
      {reversed ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-1 bottom-1 rounded-md border border-rose-300/50 bg-black/75 px-1 py-0.5 text-[9px] leading-none font-semibold text-rose-200 backdrop-blur-sm"
        >
          逆
        </span>
      ) : null}
    </button>
  );
}

export function AssistReadingPanel({
  selectedCards,
  spreadId,
  categoryId,
  question,
  deck,
  aiConfig,
  soundEnabled,
  savedRecordId,
  aiInterpretation,
  onSpreadChange,
  onCategoryChange,
  onQuestionChange,
  onToggleReversed,
  onMoveCard,
  onRemoveCard,
  onRenameSlot,
  onClearAll,
  onQuickLookup,
  onInspect3D,
  onSaveReading,
  onAiComplete,
  onBackToPicker,
}: AssistReadingPanelProps): React.ReactElement {
  const activeSpread = useMemo(
    () => (spreadId === "free" ? null : getSpreadById(spreadId)),
    [spreadId]
  );
  const activeCategory = useMemo(
    () => getCategoryById(categoryId),
    [categoryId]
  );

  // Derived reading tab: auto-syncs when categoryId changes while respecting manual overrides
  const [manualTabOverride, setManualTabOverride] = useState<{
    categoryId: ReadingCategoryId;
    tab: AssistReadingTab;
  } | null>(null);

  const activeReadingTab: AssistReadingTab =
    manualTabOverride && manualTabOverride.categoryId === categoryId
      ? manualTabOverride.tab
      : getRecommendedTabForCategory(categoryId);

  const [referenceExpanded, setReferenceExpanded] = useState<boolean>(true);
  const [showAllRefCards, setShowAllRefCards] = useState<boolean>(false);

  const resolvedCards = useMemo<ResolvedAssistCard[]>(() => {
    return selectedCards.flatMap((entry, index): ResolvedAssistCard[] => {
      const card = getCardById(entry.cardId);
      if (!card) return [];

      if (activeSpread) {
        const slot = activeSpread.slots[index];
        if (slot) {
          return [
            {
              entry,
              card,
              index,
              displaySlotLabel: `${slot.index + 1}. ${slot.labelZh}`,
              slotDescription: slot.description,
              isExtraCard: false,
            },
          ];
        }
        const extraNumber = index - activeSpread.slots.length + 1;
        return [
          {
            entry,
            card,
            index,
            displaySlotLabel: `补牌 #${extraNumber}`,
            slotDescription: `超出「${activeSpread.nameZh}」主牌阵的补充指示牌`,
            isExtraCard: true,
          },
        ];
      }

      const customLabel = entry.customSlotLabel?.trim();
      return [
        {
          entry,
          card,
          index,
          displaySlotLabel: customLabel
            ? `${index + 1}. ${customLabel}`
            : `第 ${index + 1} 张`,
          slotDescription: customLabel
            ? `自定义牌位：${customLabel}`
            : "实体牌自由排布位置",
          isExtraCard: false,
        },
      ];
    });
  }, [activeSpread, selectedCards]);

  const remainingSlots = useMemo(() => {
    if (!activeSpread || resolvedCards.length >= activeSpread.cardCount) {
      return [];
    }
    return activeSpread.slots.slice(resolvedCards.length);
  }, [activeSpread, resolvedCards.length]);

  const spreadStats = useMemo(() => {
    const elementCounts: Record<string, number> = {
      火: 0,
      水: 0,
      风: 0,
      土: 0,
    };
    let uprightCount = 0;
    let reversedCount = 0;

    for (const item of resolvedCards) {
      if (item.card.element in elementCounts) {
        elementCounts[item.card.element] += 1;
      }
      if (item.entry.reversed) {
        reversedCount += 1;
      } else {
        uprightCount += 1;
      }
    }

    return { elementCounts, uprightCount, reversedCount };
  }, [resolvedCards]);

  const aiCardsPayload = useMemo<AiReadingCardInput[]>(() => {
    return resolvedCards.map((item) => ({
      slotLabel: item.displaySlotLabel,
      slotDescription: item.slotDescription,
      nameZh: item.card.nameZh,
      nameEn: item.card.nameEn,
      reversed: item.entry.reversed,
      keywords: item.entry.reversed
        ? item.card.keywordsReversed
        : item.card.keywordsUpright,
      meaning: item.entry.reversed
        ? item.card.meaningReversed
        : item.card.meaningUpright,
    }));
  }, [resolvedCards]);

  const spreadDisplayName = `实体牌辅助 · ${
    activeSpread ? activeSpread.nameZh : "自由排布"
  }`;

  const effectiveQuestion = useMemo(() => {
    const trimmed = question.trim();
    if (trimmed) return trimmed;
    return `关于「${activeCategory.nameZh}」的${
      activeSpread ? activeSpread.nameZh : "实体牌"
    }启示`;
  }, [activeCategory.nameZh, activeSpread, question]);

  const activeTabMeta =
    READING_TABS.find((t) => t.id === activeReadingTab) ?? READING_TABS[0];

  const hasLongReferenceList = resolvedCards.length > 5;
  const visibleReferenceCards =
    hasLongReferenceList && !showAllRefCards
      ? resolvedCards.slice(0, COLLAPSE_PREVIEW_LIMIT)
      : resolvedCards;
  const hiddenReferenceCount =
    resolvedCards.length - visibleReferenceCards.length;

  const extraCardCount =
    activeSpread && resolvedCards.length > activeSpread.cardCount
      ? resolvedCards.length - activeSpread.cardCount
      : 0;

  const isSpreadComplete =
    activeSpread !== null && resolvedCards.length >= activeSpread.cardCount;

  return (
    <div className="@container space-y-5">
      {/* =====================================================================
          SECTION A — Physical Spread Organizer (牌阵定位与已录入实体牌列)
         ===================================================================== */}
      <section className="uranai-glass gold-shimmer-border relative overflow-hidden rounded-3xl p-4 sm:p-5">
        {/* Subtle ambient corner glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-14 right-6 h-28 w-44 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--accent)" }}
        />

        {/* Top Header + Progress Badge & Primary Actions */}
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent)]">
              <Layers className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
                Physical Spread Organizer
              </p>
              <h2 className="font-display text-base font-semibold tracking-wide text-[var(--text-primary)] sm:text-lg">
                实体牌阵整理台
              </h2>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-muted)]">
                {activeSpread
                  ? activeSpread.summary
                  : "按桌上实体牌摆放顺序录入，可为每张牌自由注明牌位含义并实时翻正/逆、调序。"}
              </p>
            </div>
          </div>

          {/* Progress & Record Action Controls */}
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
            {/* Progress Badge */}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tabular-nums ${
                isSpreadComplete
                  ? "border-emerald-400/45 bg-emerald-500/12 text-emerald-300 [[data-light=true]_&]:border-emerald-700/35 [[data-light=true]_&]:bg-emerald-600/12 [[data-light=true]_&]:text-emerald-800"
                  : "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
              }`}
            >
              <span>
                {activeSpread
                  ? `已录入 ${resolvedCards.length} / ${activeSpread.cardCount} 张`
                  : `已录入 ${resolvedCards.length} 张`}
              </span>
              {extraCardCount > 0 ? (
                <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] leading-none text-amber-200 [[data-light=true]_&]:border-amber-700/35 [[data-light=true]_&]:bg-amber-600/12 [[data-light=true]_&]:text-amber-800">
                  +{extraCardCount} 补牌
                </span>
              ) : null}
            </span>

            {/* Save / Synced Button */}
            <button
              type="button"
              disabled={resolvedCards.length === 0}
              onClick={onSaveReading}
              title={
                savedRecordId
                  ? "已存入历史记录，点击同步当前改动"
                  : "将本次实体牌阵保存到占卜记录"
              }
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
                savedRecordId
                  ? "border-emerald-400/45 bg-emerald-500/14 text-emerald-300 hover:brightness-110 [[data-light=true]_&]:border-emerald-700/35 [[data-light=true]_&]:bg-emerald-600/12 [[data-light=true]_&]:text-emerald-800"
                  : "border-[var(--border-accent)] bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[0_4px_16px_var(--cloth-glow)] hover:brightness-110"
              }`}
            >
              {savedRecordId ? (
                <>
                  <BookmarkCheck className="h-3.5 w-3.5" />
                  <span>已同步记录 ✓</span>
                </>
              ) : (
                <>
                  <BookmarkPlus className="h-3.5 w-3.5" />
                  <span>保存至记录</span>
                </>
              )}
            </button>

            {/* Clear All Button */}
            <button
              type="button"
              disabled={resolvedCards.length === 0}
              onClick={onClearAll}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:border-rose-400/50 hover:bg-rose-500/12 hover:text-rose-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 [[data-light=true]_&]:hover:border-rose-700/40 [[data-light=true]_&]:hover:text-rose-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>清空全部</span>
            </button>
          </div>
        </div>

        {/* Spread Preset Quick-Select Bar */}
        <div className="relative mt-4">
          <div
            role="tablist"
            aria-label="选择牌阵预设"
            className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1"
          >
            {/* Free Mode Pill */}
            <button
              type="button"
              role="tab"
              aria-selected={spreadId === "free"}
              onClick={() => {
                soundEngine.playHoverTick(soundEnabled);
                onSpreadChange("free");
              }}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition active:scale-95 ${
                spreadId === "free"
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[0_4px_16px_var(--cloth-glow)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 text-[var(--text-secondary)] hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Sparkles className="h-3 w-3" />
              <span>自由选牌</span>
              <span
                className={`text-[10px] ${
                  spreadId === "free" ? "opacity-85" : "text-[var(--text-muted)]"
                }`}
              >
                · 不限张数
              </span>
            </button>

            {/* All 6 Preset Spreads */}
            {SPREADS.map((spread) => {
              const isSelected = spreadId === spread.id;
              const isRecommended = spread.recommendedFor.includes(categoryId);

              return (
                <button
                  key={spread.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => {
                    soundEngine.playHoverTick(soundEnabled);
                    onSpreadChange(spread.id);
                  }}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition active:scale-95 ${
                    isSelected
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[0_4px_16px_var(--cloth-glow)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 text-[var(--text-secondary)] hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {isRecommended && !isSelected ? (
                    <span
                      aria-hidden="true"
                      className="text-[10px] text-[var(--accent)]"
                      title="契合当前占卜领域"
                    >
                      ✦
                    </span>
                  ) : null}
                  <span>
                    {spread.nameZh} · {spread.cardCount}张
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Cards Stage OR Empty State Guide */}
        <div className="relative mt-4">
          {resolvedCards.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-accent)]/60 bg-[var(--bg-base)]/40 px-4 py-7 text-center sm:px-6">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent)]">
                <Sparkles className="h-5 w-5" />
              </div>

              <h3 className="font-display mt-3 text-base font-semibold text-[var(--text-primary)]">
                {activeSpread
                  ? `「${activeSpread.nameZh}」牌位已就绪`
                  : "自由实体牌工作台已就绪"}
              </h3>

              <p className="mx-auto mt-1.5 max-w-lg text-xs leading-relaxed text-[var(--text-secondary)]">
                {activeSpread
                  ? `请按你在桌面上抽出的顺序，从牌库选入对应的 ${activeSpread.cardCount} 张实体牌，系统将自动填入以下牌位并生成离线速查与 AI 综合解读：`
                  : "不限张数与牌阵形态。将你用实体塔罗抽出的牌依次选入后，可自由填写每个位置的含义（如过去 / 现状 / 对方想法 / 障碍）并开启深度解读。"}
              </p>

              {/* Preset spread slot preview pills */}
              {activeSpread ? (
                <div className="mx-auto mt-4 flex max-w-2xl flex-wrap items-center justify-center gap-1.5">
                  {activeSpread.slots.map((slot) => (
                    <span
                      key={slot.index}
                      title={slot.description}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/75 px-2.5 py-1 text-[11px] text-[var(--text-secondary)]"
                    >
                      <span className="font-display font-semibold text-[var(--accent)]">
                        {slot.index + 1}.
                      </span>
                      <span>{slot.labelZh}</span>
                    </span>
                  ))}
                </div>
              ) : null}

              {onBackToPicker ? (
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playHoverTick(soundEnabled);
                      onBackToPicker();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-accent)] bg-[var(--accent)] px-5 py-2.5 text-xs font-semibold tracking-wide text-[var(--accent-contrast)] shadow-[0_6px_22px_var(--cloth-glow)] transition hover:brightness-110 active:scale-95"
                  >
                    <Plus className="h-4 w-4" />
                    <span>去牌库选入你抽到的实体牌</span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              {/* Responsive Selected Cards Grid (container-query adaptive for split or full width) */}
              <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2 @4xl:grid-cols-3">
                <AnimatePresence initial={false}>
                  {resolvedCards.map((item) => {
                    const { entry, card, index, displaySlotLabel, slotDescription, isExtraCard } =
                      item;
                    const isFirst = index === 0;
                    const isLast = index === resolvedCards.length - 1;

                    return (
                      <motion.article
                        key={entry.uid}
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="flex flex-col justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/75 p-3 shadow-[0_6px_20px_rgba(0,0,0,0.12)] transition hover:border-[var(--border-accent)]"
                      >
                        {/* Top Content: Artwork Thumb + Slot Header + Card Identity */}
                        <div className="flex items-start gap-3">
                          <AssistCardThumb
                            key={`${deck.id}-${card.slug}`}
                            card={card}
                            deck={deck}
                            reversed={entry.reversed}
                            onClick={() => {
                              soundEngine.playHoverTick(soundEnabled);
                              onQuickLookup(
                                card,
                                entry.reversed,
                                entry.uid,
                                displaySlotLabel
                              );
                            }}
                          />

                          <div className="min-w-0 flex-1 space-y-1.5">
                            {/* Slot Label: Preset Badge OR Inline Free-Mode Input */}
                            {activeSpread ? (
                              <div>
                                <span
                                  className={`inline-flex max-w-full items-center gap-1 truncate rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                    isExtraCard
                                      ? "border-amber-400/45 bg-amber-500/14 text-amber-200 [[data-light=true]_&]:border-amber-700/35 [[data-light=true]_&]:bg-amber-600/12 [[data-light=true]_&]:text-amber-800"
                                      : "border-[var(--border-accent)]/70 bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                                  }`}
                                >
                                  {displaySlotLabel}
                                </span>
                                <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--text-muted)]">
                                  {slotDescription}
                                </p>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/55 px-2 py-1 focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)]/35">
                                <span className="font-display shrink-0 text-[10px] font-semibold text-[var(--accent)]">
                                  #{index + 1}
                                </span>
                                <input
                                  type="text"
                                  value={entry.customSlotLabel ?? ""}
                                  maxLength={24}
                                  onChange={(e) =>
                                    onRenameSlot(entry.uid, e.target.value)
                                  }
                                  placeholder={`第 ${index + 1} 张 · 可输入牌位含义`}
                                  aria-label={`自定义第 ${index + 1} 张牌位含义`}
                                  className="w-full min-w-0 bg-transparent text-[11px] font-medium text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/75 focus:outline-none"
                                />
                                <PencilLine
                                  aria-hidden="true"
                                  className="h-3 w-3 shrink-0 text-[var(--text-muted)]/70"
                                />
                              </div>
                            )}

                            {/* Chinese & English Name + Orientation Badge */}
                            <div className="pt-0.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <h3 className="font-display text-base leading-tight font-semibold text-[var(--text-primary)]">
                                  {card.romanNumeral ? (
                                    <span className="mr-1 text-xs font-normal text-[var(--accent)]">
                                      {card.romanNumeral}
                                    </span>
                                  ) : null}
                                  {card.nameZh}
                                </h3>
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                    entry.reversed
                                      ? "border-rose-400/45 bg-rose-500/15 text-rose-300 [[data-light=true]_&]:border-rose-700/35 [[data-light=true]_&]:bg-rose-600/12 [[data-light=true]_&]:text-rose-700"
                                      : "border-emerald-400/40 bg-emerald-500/12 text-emerald-300 [[data-light=true]_&]:border-emerald-700/35 [[data-light=true]_&]:bg-emerald-600/12 [[data-light=true]_&]:text-emerald-800"
                                  }`}
                                >
                                  {entry.reversed ? "逆位" : "正位"}
                                </span>
                              </div>
                              <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                                {card.nameEn} · {card.element}元素
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Compact Quick Action Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-[var(--border-subtle)] pt-2.5">
                          <div className="flex items-center gap-1">
                            {/* Flip Upright / Reversed */}
                            <button
                              type="button"
                              onClick={() => onToggleReversed(entry.uid)}
                              title={
                                entry.reversed ? "切换为正位" : "切换为逆位"
                              }
                              aria-label={`将 ${card.nameZh} 翻转为${
                                entry.reversed ? "正位" : "逆位"
                              }`}
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)]/55 px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)] active:scale-95"
                            >
                              <RotateCw className="h-3 w-3" />
                              <span>翻正/逆</span>
                            </button>

                            {/* Move Left / Right */}
                            <div className="inline-flex items-center overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)]/55">
                              <button
                                type="button"
                                disabled={isFirst}
                                onClick={() => {
                                  soundEngine.playHoverTick(soundEnabled);
                                  onMoveCard(entry.uid, -1);
                                }}
                                title="左移一位"
                                aria-label={`将 ${card.nameZh} 左移一位`}
                                className="inline-flex h-6 w-6 items-center justify-center text-[var(--text-secondary)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                <ChevronLeft className="h-3.5 w-3.5" />
                              </button>
                              <span
                                aria-hidden="true"
                                className="h-3.5 w-[1px] bg-[var(--border-subtle)]"
                              />
                              <button
                                type="button"
                                disabled={isLast}
                                onClick={() => {
                                  soundEngine.playHoverTick(soundEnabled);
                                  onMoveCard(entry.uid, 1);
                                }}
                                title="右移一位"
                                aria-label={`将 ${card.nameZh} 右移一位`}
                                className="inline-flex h-6 w-6 items-center justify-center text-[var(--text-secondary)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Quick Lookup */}
                            <button
                              type="button"
                              onClick={() => {
                                soundEngine.playHoverTick(soundEnabled);
                                onQuickLookup(
                                  card,
                                  entry.reversed,
                                  entry.uid,
                                  displaySlotLabel
                                );
                              }}
                              title="基础牌义速查"
                              aria-label={`速查 ${card.nameZh} 基础牌义`}
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)]/55 px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)] active:scale-95"
                            >
                              <BookOpen className="h-3 w-3" />
                              <span>速查</span>
                            </button>

                            {/* 360° 3D Inspect */}
                            <button
                              type="button"
                              onClick={() => {
                                soundEngine.playHoverTick(soundEnabled);
                                onInspect3D(card, entry.reversed);
                              }}
                              title="360° 立体赏析卡面"
                              aria-label={`360° 赏析 ${card.nameZh}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)]/55 px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)] active:scale-95"
                            >
                              <Orbit className="h-3 w-3" />
                              <span>360°</span>
                            </button>

                            {/* Remove */}
                            <button
                              type="button"
                              onClick={() => {
                                soundEngine.playHoverTick(soundEnabled);
                                onRemoveCard(entry.uid);
                              }}
                              title="移除此牌"
                              aria-label={`移除 ${card.nameZh}`}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)]/55 text-[var(--text-muted)] transition hover:border-rose-400/50 hover:bg-rose-500/14 hover:text-rose-300 active:scale-95 [[data-light=true]_&]:hover:border-rose-700/40 [[data-light=true]_&]:hover:text-rose-700"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </motion.article>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* Next expected slots guide when preset spread is partially filled */}
              {remainingSlots.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-[var(--border-accent)]/50 bg-[var(--bg-base)]/35 px-3.5 py-2.5 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-[var(--accent-strong)]">
                      待录入牌位：
                    </span>
                    {remainingSlots.slice(0, 4).map((slot) => (
                      <span
                        key={slot.index}
                        className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/75 px-2 py-0.5 text-[11px] text-[var(--text-secondary)]"
                      >
                        {slot.index + 1}. {slot.labelZh}
                      </span>
                    ))}
                    {remainingSlots.length > 4 ? (
                      <span className="text-[11px] text-[var(--text-muted)]">
                        等共 {remainingSlots.length} 位
                      </span>
                    ) : null}
                  </div>
                  {onBackToPicker ? (
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playHoverTick(soundEnabled);
                        onBackToPicker();
                      }}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--accent-strong)] transition hover:brightness-110 active:scale-95"
                    >
                      <Plus className="h-3 w-3" />
                      继续选牌
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>

      {/* =====================================================================
          SECTION B — Offline Multi-Card Basic Reference (多牌基础牌义速查总览)
         ===================================================================== */}
      {resolvedCards.length > 0 ? (
        <section className="uranai-glass gold-shimmer-border relative overflow-hidden rounded-3xl p-4 sm:p-5">
          {/* Header + Collapse/Expand Toggle */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent)]">
                <BookOpen className="h-4 w-4" />
              </div>
              <div>
                <p className="font-display text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
                  Offline Multi-Card Reference
                </p>
                <h2 className="font-display text-base font-semibold tracking-wide text-[var(--text-primary)] sm:text-lg">
                  多牌基础牌义速查总览
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  离线即时查阅已录入 {resolvedCards.length} 张实体牌的 5 维传统牌义与关键词
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                soundEngine.playHoverTick(soundEnabled);
                setReferenceExpanded((prev) => !prev);
              }}
              aria-expanded={referenceExpanded}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/75 px-3.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-accent)] hover:text-[var(--text-primary)] active:scale-95"
            >
              {referenceExpanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5 text-[var(--accent)]" />
                  <span>折叠速查</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5 text-[var(--accent)]" />
                  <span>展开速查（{resolvedCards.length} 张）</span>
                </>
              )}
            </button>
          </div>

          {/* Elemental & Orientation Balance Ribbon (for multi-card spreads) */}
          {resolvedCards.length >= 2 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/40 px-3 py-2 text-[11px] text-[var(--text-secondary)]">
              <span className="font-medium text-[var(--accent-strong)]">
                ✦ 牌阵气象
              </span>
              <span className="text-[var(--text-muted)]">·</span>
              <span className="tabular-nums">
                正位 {spreadStats.uprightCount} / 逆位 {spreadStats.reversedCount}
              </span>
              <span className="text-[var(--text-muted)]">·</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {ELEMENT_ORDER.map((el) => {
                  const count = spreadStats.elementCounts[el] ?? 0;
                  return (
                    <span
                      key={el}
                      className={`rounded-full border px-2 py-0.5 tabular-nums ${
                        count > 0
                          ? "border-[var(--border-accent)]/60 bg-[var(--accent-soft)]/70 text-[var(--accent-strong)]"
                          : "border-[var(--border-subtle)] bg-transparent text-[var(--text-muted)] opacity-60"
                      }`}
                    >
                      {el} {count}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Collapsed Compact Strip OR Expanded 5-Dimension Reading Cards */}
          {!referenceExpanded ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {resolvedCards.map((item) => (
                <button
                  key={item.entry.uid}
                  type="button"
                  onClick={() => {
                    soundEngine.playHoverTick(soundEnabled);
                    onQuickLookup(
                      item.card,
                      item.entry.reversed,
                      item.entry.uid,
                      item.displaySlotLabel
                    );
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/75 px-3 py-1 text-xs text-[var(--text-secondary)] transition hover:border-[var(--border-accent)] hover:text-[var(--text-primary)] active:scale-95"
                >
                  <span className="text-[10px] text-[var(--accent)]">
                    {item.displaySlotLabel}
                  </span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {item.card.nameZh}
                  </span>
                  <span
                    className={`text-[10px] font-semibold ${
                      item.entry.reversed
                        ? "text-rose-300 [[data-light=true]_&]:text-rose-700"
                        : "text-emerald-300 [[data-light=true]_&]:text-emerald-800"
                    }`}
                  >
                    {item.entry.reversed ? "逆" : "正"}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {/* 5-Dimension Switcher Pills */}
              <div
                role="tablist"
                aria-label="切换牌义解读维度"
                className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1"
              >
                {READING_TABS.map(({ id, label, Icon }) => {
                  const isActive = activeReadingTab === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => {
                        soundEngine.playHoverTick(soundEnabled);
                        setManualTabOverride({ categoryId, tab: id });
                      }}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition active:scale-95 ${
                        isActive
                          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[0_4px_14px_var(--cloth-glow)]"
                          : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 text-[var(--text-secondary)] hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Structured Reference Reading Cards */}
              <div className="grid grid-cols-1 gap-3 @3xl:grid-cols-2">
                {visibleReferenceCards.map((item) => {
                  const { entry, card, displaySlotLabel } = item;
                  const isRev = entry.reversed;
                  const keywords = isRev
                    ? card.keywordsReversed
                    : card.keywordsUpright;
                  const dimensionText = getCardDimensionText(
                    card,
                    isRev,
                    activeReadingTab
                  );
                  const showAffirmation =
                    activeReadingTab === "general" ||
                    activeReadingTab === "advice";

                  return (
                    <article
                      key={entry.uid}
                      className="flex flex-col justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 p-4 transition hover:border-[var(--border-accent)]/80"
                    >
                      <div className="space-y-3">
                        {/* Slot + Card Title + Orientation + Meta */}
                        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
                          <div className="min-w-0 space-y-1">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide text-[var(--accent)]">
                              <span>✦</span>
                              <span className="truncate">{displaySlotLabel}</span>
                            </span>

                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-display text-base font-semibold text-[var(--text-primary)]">
                                {card.romanNumeral ? (
                                  <span className="mr-1.5 text-xs font-normal text-[var(--accent)]">
                                    {card.romanNumeral}
                                  </span>
                                ) : null}
                                {card.nameZh}
                              </h3>
                              <span className="text-xs text-[var(--text-muted)]">
                                {card.nameEn}
                              </span>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                  isRev
                                    ? "border-rose-400/45 bg-rose-500/15 text-rose-300 [[data-light=true]_&]:border-rose-700/35 [[data-light=true]_&]:bg-rose-600/12 [[data-light=true]_&]:text-rose-700"
                                    : "border-emerald-400/40 bg-emerald-500/12 text-emerald-300 [[data-light=true]_&]:border-emerald-700/35 [[data-light=true]_&]:bg-emerald-600/12 [[data-light=true]_&]:text-emerald-800"
                                }`}
                              >
                                {isRev ? "逆位 · Reversed" : "正位 · Upright"}
                              </span>
                            </div>
                          </div>

                          {/* Element & Astrology tags */}
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)]/50 px-2 py-0.5 text-[var(--text-secondary)]">
                              {card.element}元素
                            </span>
                            <span className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)]/50 px-2 py-0.5 text-[var(--text-secondary)]">
                              {card.astrology}
                            </span>
                          </div>
                        </div>

                        {/* Keywords Capsules */}
                        <div className="flex flex-wrap gap-1.5">
                          {keywords.map((kw) => (
                            <span
                              key={kw}
                              className="rounded-full border border-[var(--border-accent)]/65 bg-[var(--accent-soft)]/70 px-2.5 py-0.5 text-[11px] font-medium text-[var(--accent-strong)]"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>

                        {/* Dimension Full Meaning Text */}
                        <div className="space-y-1">
                          <div className="text-[11px] font-semibold tracking-wider text-[var(--accent)]">
                            {activeTabMeta.heading}
                          </div>
                          <p className="text-xs leading-[1.82] text-[var(--text-primary)]/92 sm:text-[13px]">
                            {dimensionText}
                          </p>
                        </div>

                        {/* Affirmation Quote (shown under general / advice tabs) */}
                        {showAffirmation ? (
                          <blockquote className="flex items-start gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/45 px-3 py-2.5">
                            <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)] opacity-75" />
                            <p className="font-display text-xs leading-relaxed text-[var(--text-primary)]/90 italic">
                              「{card.affirmation}」
                            </p>
                          </blockquote>
                        ) : null}
                      </div>

                      {/* Card Footer: 5-Dimension Full Lookup CTA */}
                      <div className="flex items-center justify-end border-t border-[var(--border-subtle)] pt-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playHoverTick(soundEnabled);
                            onQuickLookup(
                              card,
                              isRev,
                              entry.uid,
                              displaySlotLabel
                            );
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-[var(--border-accent)]/75 bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--accent-strong)] transition hover:brightness-110 active:scale-95"
                        >
                          <span>查看 5 维全览</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Expand/Collapse Remaining Cards Button when > 5 cards */}
              {hasLongReferenceList ? (
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playHoverTick(soundEnabled);
                      setShowAllRefCards((prev) => !prev);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-accent)] bg-[var(--bg-surface)]/80 px-4 py-2 text-xs font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--accent-soft)] active:scale-95"
                  >
                    {showAllRefCards ? (
                      <>
                        <ChevronUp className="h-3.5 w-3.5" />
                        <span>收起其余牌义，保持视图清爽</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3.5 w-3.5" />
                        <span>展开其余 {hiddenReferenceCount} 张牌义速查</span>
                      </>
                    )}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {/* =====================================================================
          SECTION C — Context Setup & AI Comprehensive Reading
         ===================================================================== */}
      <div className="space-y-4">
        {/* Reading Context Card: Category Pills + Question Input + Sample Questions */}
        <section className="uranai-glass gold-shimmer-border relative overflow-hidden rounded-3xl p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-display text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
                Physical Reading Context
              </p>
              <h2 className="font-display text-base font-semibold tracking-wide text-[var(--text-primary)] sm:text-lg">
                实体牌提问语境
              </h2>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent-strong)]">
              <span>{activeCategory.icon}</span>
              <span>{activeCategory.nameZh}</span>
            </span>
          </div>

          {/* 6 Category Quick-Select Pills */}
          <div className="mt-3.5 flex flex-wrap gap-2">
            {READING_CATEGORIES.map((cat) => {
              const isSelected = cat.id === categoryId;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playHoverTick(soundEnabled);
                    onCategoryChange(cat.id);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
                    isSelected
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[0_0_14px_var(--cloth-glow)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 text-[var(--text-secondary)] hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.nameZh}</span>
                </button>
              );
            })}
          </div>

          {/* Custom Question Textarea */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="assist-reading-question"
                className="text-xs font-semibold text-[var(--text-primary)]"
              >
                写下你本次抽牌时的核心问题（可选）
              </label>
              <span className="text-[11px] tabular-nums text-[var(--text-muted)]">
                {question.length} / 240
              </span>
            </div>

            <div className="relative">
              <textarea
                id="assist-reading-question"
                rows={2}
                maxLength={240}
                value={question}
                onChange={(e) => onQuestionChange(e.target.value)}
                placeholder={`例如：${activeCategory.sampleQuestions[0]}`}
                className="w-full resize-none rounded-2xl border border-[var(--border-accent)]/70 bg-[var(--bg-base)]/60 py-3 pr-9 pl-3.5 text-sm leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/80 shadow-inner focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/40 focus:outline-none"
              />
              {question.trim() ? (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playHoverTick(soundEnabled);
                    onQuestionChange("");
                  }}
                  aria-label="清空问题"
                  className="absolute top-2.5 right-2.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>

          {/* Sample Questions Quick-Fill Pills */}
          <div className="mt-3 space-y-1.5">
            <p className="text-[11px] font-medium text-[var(--text-muted)]">
              ✦ 灵感提问（轻触一键填入）
            </p>
            <div className="flex flex-wrap gap-1.5">
              {activeCategory.sampleQuestions.map((sample) => {
                const isMatched = question === sample;
                return (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => {
                      soundEngine.playHoverTick(soundEnabled);
                      onQuestionChange(sample);
                    }}
                    className={`rounded-2xl border px-3 py-1.5 text-left text-xs leading-snug transition active:scale-[0.98] ${
                      isMatched
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text-primary)]"
                        : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/65 text-[var(--text-secondary)] hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {sample}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Shared Streaming AI Interpretation Panel */}
        <AiInterpretationPanel
          mode="spread"
          question={effectiveQuestion}
          category={activeCategory.nameZh}
          spreadName={spreadDisplayName}
          cards={aiCardsPayload}
          initialInterpretation={aiInterpretation}
          customAi={aiConfig}
          disabled={resolvedCards.length === 0}
          disabledHint="请先从牌库中选入至少 1 张你用实体牌抽出的塔罗牌，再开启 AI 综合解读。"
          onInterpretationComplete={onAiComplete}
        />
      </div>
    </div>
  );
}
