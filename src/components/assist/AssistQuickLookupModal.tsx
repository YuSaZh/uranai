"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Briefcase,
  Check,
  Coins,
  Compass,
  Heart,
  Orbit,
  Plus,
  Quote,
  Rotate3d,
  RotateCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { DeckDefinition, SuitType, TarotCard } from "@/types/tarot";
import { getCardImagePath, getCardThumbPath } from "@/data/decks";
import { soundEngine } from "@/lib/sound";
import type { AssistQuickLookupTarget, AssistReadingTab } from "./types";

export interface AssistQuickLookupModalProps {
  target: AssistQuickLookupTarget | null;
  deck: DeckDefinition;
  soundEnabled: boolean;
  onClose: () => void;
  onAddCard: (cardId: string, reversed: boolean) => void;
  onToggleSelectedReversed: (uid: string) => void;
  onRemoveSelected: (uid: string) => void;
  onInspect3D: (card: TarotCard, reversed: boolean) => void;
}

const SUIT_LABEL_MAP: Record<SuitType, { label: string; symbol: string }> = {
  major: { label: "大阿卡纳", symbol: "✦" },
  wands: { label: "权杖 · 小阿卡纳", symbol: "🜂" },
  cups: { label: "圣杯 · 小阿卡纳", symbol: "🜄" },
  swords: { label: "宝剑 · 小阿卡纳", symbol: "🜁" },
  pentacles: { label: "星币 · 小阿卡纳", symbol: "🜃" },
};

const READING_TABS: Array<{
  id: AssistReadingTab;
  label: string;
  heading: string;
  Icon: typeof BookOpen;
}> = [
  {
    id: "general",
    label: "基础牌义",
    heading: "核心牌义解析",
    Icon: BookOpen,
  },
  {
    id: "love",
    label: "爱情",
    heading: "情感与人际启示",
    Icon: Heart,
  },
  {
    id: "career",
    label: "事业",
    heading: "事业与学业指引",
    Icon: Briefcase,
  },
  {
    id: "wealth",
    label: "财富",
    heading: "财务与资源流动",
    Icon: Coins,
  },
  {
    id: "advice",
    label: "行动指引",
    heading: "当下可行建议",
    Icon: Compass,
  },
];

const REVERSED_PILL_STYLE: React.CSSProperties = {
  borderColor: "color-mix(in srgb, #f59e0b 48%, transparent)",
  backgroundColor: "color-mix(in srgb, #f59e0b 16%, transparent)",
  color: "color-mix(in srgb, #f59e0b 65%, var(--text-primary))",
};

const UPRIGHT_PILL_STYLE: React.CSSProperties = {
  borderColor: "color-mix(in srgb, #10b981 42%, transparent)",
  backgroundColor: "color-mix(in srgb, #10b981 14%, transparent)",
  color: "color-mix(in srgb, #10b981 62%, var(--text-primary))",
};

const REMOVE_BTN_STYLE: React.CSSProperties = {
  borderColor: "color-mix(in srgb, #f43f5e 40%, transparent)",
  backgroundColor: "color-mix(in srgb, #f43f5e 11%, transparent)",
  color: "color-mix(in srgb, #f43f5e 66%, var(--text-primary))",
};

function getMinorCode(number: number): string {
  if (number === 1) return "A";
  if (number === 11) return "侍";
  if (number === 12) return "骑";
  if (number === 13) return "后";
  if (number === 14) return "王";
  return String(number);
}

function getTabContent(
  card: TarotCard,
  tab: AssistReadingTab,
  reversed: boolean
): string {
  switch (tab) {
    case "general":
      return reversed ? card.meaningReversed : card.meaningUpright;
    case "love":
      return reversed ? card.loveReversed : card.loveUpright;
    case "career":
      return reversed ? card.careerReversed : card.careerUpright;
    case "wealth":
      return reversed ? card.wealthReversed : card.wealthUpright;
    case "advice":
      return reversed ? card.adviceReversed : card.adviceUpright;
  }
}

interface LookupCardThumbProps {
  card: TarotCard;
  deck: DeckDefinition;
  reversed: boolean;
  onInspect: () => void;
}

function LookupCardThumb({
  card,
  deck,
  reversed,
  onInspect,
}: LookupCardThumbProps): React.ReactElement {
  const thumbSrc = getCardThumbPath(deck.id, card.slug);
  const fullSrc = getCardImagePath(deck.id, card.slug);
  const initialStage = thumbSrc ? "thumb" : fullSrc ? "full" : "crest";

  const [stage, setStage] = useState<"thumb" | "full" | "crest">(initialStage);

  useEffect(() => {
    setStage(thumbSrc ? "thumb" : fullSrc ? "full" : "crest");
  }, [thumbSrc, fullSrc]);

  const activeSrc =
    stage === "thumb" ? thumbSrc : stage === "full" ? fullSrc : null;
  const suitMeta = SUIT_LABEL_MAP[card.suit];

  const handleError = () => {
    if (stage === "thumb" && fullSrc && fullSrc !== thumbSrc) {
      setStage("full");
    } else {
      setStage("crest");
    }
  };

  return (
    <button
      type="button"
      onClick={onInspect}
      title="点击进入 360° 赏析"
      aria-label={`进入 ${card.nameZh} 360° 赏析`}
      className={`group relative ${deck.aspectClass} w-[76px] shrink-0 overflow-hidden rounded-xl border bg-[#0f0d16] shadow-[0_8px_22px_rgba(0,0,0,0.34)] transition hover:scale-[1.03] active:scale-95 sm:w-[88px] ${
        reversed ? "border-amber-500/60" : "border-[var(--border-accent)]"
      }`}
    >
      {activeSrc ? (
        <img
          src={activeSrc}
          alt={`${card.nameZh} (${card.nameEn})`}
          decoding="async"
          onError={handleError}
          className={`h-full w-full object-cover transition-transform duration-500 ease-out ${
            reversed ? "rotate-180" : "rotate-0"
          }`}
        />
      ) : (
        <div
          className={`relative flex h-full w-full flex-col items-center justify-between bg-gradient-to-b from-[#261d14] via-[#17120e] to-[#0f0c0a] p-2 text-center transition-transform duration-500 ease-out ${
            reversed ? "rotate-180" : "rotate-0"
          }`}
        >
          <span className="font-display text-[9px] tracking-[0.18em] text-[#e7ca7b]/85">
            {card.romanNumeral ?? getMinorCode(card.number)}
          </span>
          <span className="text-base text-[#f0d27a]">{suitMeta.symbol}</span>
          <span className="font-display text-[10px] font-semibold text-[#f7ebd2] line-clamp-1">
            {card.nameZh}
          </span>
        </div>
      )}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/15 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      />
    </button>
  );
}

export function AssistQuickLookupModal({
  target,
  deck,
  soundEnabled,
  onClose,
  onAddCard,
  onToggleSelectedReversed,
  onRemoveSelected,
  onInspect3D,
}: AssistQuickLookupModalProps): React.ReactElement | null {
  const [mounted, setMounted] = useState(false);
  const [localReversed, setLocalReversed] = useState(false);
  const [appliedReversed, setAppliedReversed] = useState(false);
  const [activeTab, setActiveTab] = useState<AssistReadingTab>("general");
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync local preview state whenever a new card or updated orientation target opens
  useEffect(() => {
    if (!target) return;
    setLocalReversed(target.reversed);
    setAppliedReversed(target.reversed);
    setJustSynced(false);
  }, [target?.card.id, target?.selectedUid, target?.reversed]);

  // Reset active reading tab when switching to a different card
  useEffect(() => {
    if (!target) return;
    setActiveTab("general");
  }, [target?.card.id]);

  // Escape key dismissal + background scroll lock while open
  useEffect(() => {
    if (!target) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [target, onClose]);

  useEffect(() => {
    if (!justSynced) return;
    const timer = window.setTimeout(() => setJustSynced(false), 1600);
    return () => window.clearTimeout(timer);
  }, [justSynced]);

  if (!mounted) return null;

  const card = target?.card ?? null;
  const isInSpread = Boolean(target?.selectedUid);
  const needsSync = isInSpread && localReversed !== appliedReversed;
  const activeTabMeta =
    READING_TABS.find((t) => t.id === activeTab) ?? READING_TABS[0];

  const handleTogglePreviewOrientation = (nextReversed: boolean) => {
    if (localReversed === nextReversed) return;
    soundEngine.playCardFlip(soundEnabled);
    setLocalReversed(nextReversed);
    setJustSynced(false);
  };

  const handleSyncOrFlipSelected = () => {
    if (!target?.selectedUid) return;
    soundEngine.playCardFlip(soundEnabled);
    onToggleSelectedReversed(target.selectedUid);
    if (needsSync) {
      setAppliedReversed(localReversed);
      setJustSynced(true);
    } else {
      const next = !appliedReversed;
      setLocalReversed(next);
      setAppliedReversed(next);
      setJustSynced(true);
    }
  };

  const handleInspect = () => {
    if (!card) return;
    soundEngine.playCardFlip(soundEnabled);
    onInspect3D(card, localReversed);
  };

  return createPortal(
    <AnimatePresence>
      {target && card ? (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center sm:p-5"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
          />

          {/* Modal Sheet */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`${card.nameZh} 单牌基础速查`}
            initial={{ opacity: 0, y: 36, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="uranai-glass-strong relative z-10 flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl shadow-[0_24px_68px_rgba(0,0,0,0.62)] sm:rounded-3xl"
          >
            {/* Mobile grab bar */}
            <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-[var(--border-accent)] opacity-60 sm:hidden" />

            {/* Top Header */}
            <div className="shrink-0 border-b border-[var(--border-subtle)] px-4 pt-3 pb-3.5 sm:px-6 sm:pt-5 sm:pb-4">
              <div className="flex items-start gap-3.5">
                <LookupCardThumb
                  card={card}
                  deck={deck}
                  reversed={localReversed}
                  onInspect={handleInspect}
                />

                <div className="min-w-0 flex-1 space-y-1.5">
                  {/* Top Row: Suit / Slot Badges + Close Button */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold tracking-wider text-[var(--accent-strong)]">
                        <span aria-hidden="true">
                          {SUIT_LABEL_MAP[card.suit].symbol}
                        </span>
                        {card.arcana === "major"
                          ? `${SUIT_LABEL_MAP.major.label} · ${card.romanNumeral ?? card.number}`
                          : `${SUIT_LABEL_MAP[card.suit].label} · ${getMinorCode(card.number)}`}
                      </span>

                      {target.slotLabel ? (
                        <span className="inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/85 px-2 py-0.5 text-[10px] font-medium text-[var(--text-primary)]">
                          牌位：{target.slotLabel}
                        </span>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={onClose}
                      aria-label="关闭速查弹窗"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/80 text-[var(--text-secondary)] transition hover:border-[var(--border-accent)] hover:text-[var(--text-primary)] active:scale-90"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Card Title (ZH + EN) */}
                  <div>
                    <h2 className="font-display text-xl font-bold tracking-wide text-[var(--text-primary)] sm:text-2xl">
                      {card.romanNumeral ? (
                        <span className="mr-1.5 font-normal text-[var(--accent)]">
                          {card.romanNumeral}
                        </span>
                      ) : null}
                      {card.nameZh}
                    </h2>
                    <p className="truncate text-[11px] tracking-[0.18em] text-[var(--text-muted)] uppercase">
                      {card.nameEn}
                    </p>
                  </div>

                  {/* Element, Astrology & 360° Inspect trigger */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]/75 px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">
                      <Sparkles className="h-3 w-3 text-[var(--accent)]" />
                      元素：{card.element}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]/75 px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">
                      <Orbit className="h-3 w-3 text-[var(--accent)]" />
                      占星：{card.astrology}
                    </span>
                    <button
                      type="button"
                      onClick={handleInspect}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-accent)] bg-[var(--accent-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--accent-strong)] transition hover:brightness-110 active:scale-95"
                    >
                      <Rotate3d className="h-3 w-3" />
                      360° 赏析
                    </button>
                  </div>
                </div>
              </div>

              {/* Real-Time Upright / Reversed Toggle */}
              <div className="mt-3.5 flex items-center gap-2">
                <div
                  role="group"
                  aria-label="正逆位牌义对照切换"
                  className="grid flex-1 grid-cols-2 gap-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/80 p-1"
                >
                  <button
                    type="button"
                    aria-pressed={!localReversed}
                    onClick={() => handleTogglePreviewOrientation(false)}
                    style={!localReversed ? UPRIGHT_PILL_STYLE : undefined}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition active:scale-[0.98] ${
                      !localReversed
                        ? "shadow-sm"
                        : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    正位 · Upright
                  </button>
                  <button
                    type="button"
                    aria-pressed={localReversed}
                    onClick={() => handleTogglePreviewOrientation(true)}
                    style={localReversed ? REVERSED_PILL_STYLE : undefined}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition active:scale-[0.98] ${
                      localReversed
                        ? "shadow-sm"
                        : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    逆位 · Reversed
                  </button>
                </div>
              </div>

              {isInSpread ? (
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-muted)]">
                    当前牌阵中状态：
                    <strong className="font-semibold text-[var(--text-primary)]">
                      {appliedReversed ? "逆位" : "正位"}
                    </strong>
                  </span>
                  {needsSync ? (
                    <span
                      className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
                      style={REVERSED_PILL_STYLE}
                    >
                      已切换预览 · 底部可一键同步
                    </span>
                  ) : justSynced ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium"
                      style={UPRIGHT_PILL_STYLE}
                    >
                      <Check className="h-3 w-3" />
                      已同步至牌阵
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Scrollable Body: Keywords + 5-Dimension Tabs + Affirmation */}
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
              {/* Keywords Pills */}
              <div>
                <p className="mb-2 text-[11px] font-medium tracking-[0.18em] text-[var(--accent)] uppercase">
                  {localReversed ? "逆位核心关键词" : "正位核心关键词"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(localReversed
                    ? card.keywordsReversed
                    : card.keywordsUpright
                  ).map((kw) => (
                    <span
                      key={kw}
                      style={localReversed ? REVERSED_PILL_STYLE : undefined}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                        localReversed
                          ? ""
                          : "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                      }`}
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>

              {/* 5-Dimension Reading Switcher & Card */}
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/72 p-3.5 sm:p-4 space-y-3">
                <div
                  role="tablist"
                  aria-label="五维基础解读"
                  className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar"
                >
                  {READING_TABS.map(({ id, label, Icon }) => {
                    const active = activeTab === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => {
                          soundEngine.playHoverTick(soundEnabled);
                          setActiveTab(id);
                        }}
                        className={`inline-flex shrink-0 items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition active:scale-95 ${
                          active
                            ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[0_4px_12px_var(--cloth-glow)]"
                            : "border-[var(--border-subtle)] bg-[var(--bg-elevated)]/65 text-[var(--text-secondary)] hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>

                <motion.div
                  key={`${card.id}-${activeTab}-${localReversed ? "rev" : "up"}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold tracking-[0.14em] text-[var(--accent-strong)]">
                      {activeTabMeta.heading}
                    </h3>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {localReversed ? "逆位解读" : "正位解读"}
                    </span>
                  </div>
                  <p className="text-sm leading-7 text-[var(--text-primary)]">
                    {getTabContent(card, activeTab, localReversed)}
                  </p>
                </motion.div>
              </div>

              {/* Healing Affirmation Blockquote */}
              <blockquote className="relative overflow-hidden rounded-2xl border border-[var(--border-accent)]/60 bg-[var(--accent-soft)]/55 px-4 py-3.5 text-center">
                <Quote
                  aria-hidden="true"
                  className="mx-auto mb-1 h-4 w-4 text-[var(--accent)] opacity-75"
                />
                <p className="font-display text-sm italic leading-relaxed tracking-wide text-[var(--text-primary)]">
                  “{card.affirmation}”
                </p>
                <footer className="mt-1 text-[10px] tracking-[0.2em] text-[var(--text-muted)] uppercase">
                  疗愈肯定语 · Affirmation
                </footer>
              </blockquote>
            </div>

            {/* Fixed Bottom Action Bar (with iOS PWA safe-area inset) */}
            <div className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]/85 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:px-6 sm:pt-3.5 sm:pb-4">
              {isInSpread && target.selectedUid ? (
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleSyncOrFlipSelected}
                    className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-semibold transition active:scale-[0.98] sm:text-sm ${
                      needsSync
                        ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[0_6px_18px_var(--cloth-glow)] hover:brightness-105"
                        : "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)] hover:brightness-110"
                    }`}
                  >
                    <RotateCw className="h-4 w-4 shrink-0" />
                    <span>
                      {needsSync
                        ? `同步为${localReversed ? "逆位" : "正位"}`
                        : `翻转为${appliedReversed ? "正位" : "逆位"}`}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!target.selectedUid) return;
                      soundEngine.playHoverTick(soundEnabled);
                      onRemoveSelected(target.selectedUid);
                      onClose();
                    }}
                    style={REMOVE_BTN_STYLE}
                    className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-semibold transition hover:brightness-110 active:scale-[0.98] sm:text-sm"
                  >
                    <Trash2 className="h-4 w-4 shrink-0" />
                    <span>移出牌阵</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playCardDraw(soundEnabled);
                      onAddCard(card.id, false);
                      onClose();
                    }}
                    className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-2xl border border-[var(--accent)] bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--accent-contrast)] shadow-[0_6px_18px_var(--cloth-glow)] transition hover:brightness-105 active:scale-[0.98] sm:text-sm"
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    <span>以正位加入解牌</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playCardDraw(soundEnabled);
                      onAddCard(card.id, true);
                      onClose();
                    }}
                    style={REVERSED_PILL_STYLE}
                    className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-semibold transition hover:brightness-110 active:scale-[0.98] sm:text-sm"
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    <span>以逆位加入解牌</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
