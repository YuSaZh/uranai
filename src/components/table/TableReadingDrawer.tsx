"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  BookmarkCheck,
  BookmarkPlus,
  Briefcase,
  Coins,
  Compass,
  Eye,
  FlipVertical2,
  Heart,
  Layers,
  Quote,
  RotateCw,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import type {
  DeckId,
  ReadingCategoryId,
  TarotCard,
  ThemeId,
} from "@/types/tarot";
import { useUranai } from "@/context/UranaiProvider";
import { getCardById } from "@/data/tarot-cards";
import {
  READING_CATEGORIES,
  getCategoryById,
  getSpreadById,
} from "@/data/spreads";
import { getThemeById } from "@/data/themes";
import { getCardImagePath, getDeckById } from "@/data/decks";
import { soundEngine } from "@/lib/sound";
import {
  AiInterpretationPanel,
  type AiReadingCardInput,
} from "@/components/reading/AiInterpretationPanel";
import type { TablePlacedCard, TableSpreadId } from "./types";

export interface TableReadingDrawerProps {
  open: boolean;
  onClose: () => void;
  placedCards: TablePlacedCard[];
  spreadId: TableSpreadId;
  category: ReadingCategoryId;
  onCategoryChange: (c: ReadingCategoryId) => void;
  question: string;
  onQuestionChange: (q: string) => void;
  deckId: DeckId;
  themeId: ThemeId;
  soundEnabled: boolean;
  querentFacing: boolean;
  onToggleQuerentFacing: () => void;
  onInspectCard: (card: TarotCard, reversed: boolean) => void;
  onRevealAll: () => void;
  savedRecordId: string | null;
  aiInterpretation: string;
  onAiComplete: (text: string) => void;
  onSaveHistory: () => void;
}

function getDomainInsight(
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

export function TableReadingDrawer({
  open,
  onClose,
  placedCards,
  spreadId,
  category,
  onCategoryChange,
  question,
  onQuestionChange,
  deckId,
  themeId,
  soundEnabled,
  querentFacing,
  onToggleQuerentFacing,
  onInspectCard,
  onRevealAll,
  savedRecordId,
  aiInterpretation,
  onAiComplete,
  onSaveHistory,
}: TableReadingDrawerProps) {
  const { aiConfig } = useUranai();
  const theme = getThemeById(themeId);
  const deck = getDeckById(deckId);
  const activeCategory = useMemo(() => getCategoryById(category), [category]);
  const activeSpread = useMemo(
    () => (spreadId === "free" ? null : getSpreadById(spreadId)),
    [spreadId]
  );

  const [mounted, setMounted] = useState(false);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [panelRotated, setPanelRotated] = useState<boolean>(false);
  const [thumbErrorSlug, setThumbErrorSlug] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset panel rotation cleanly when tabletop querent-facing mode turns off
  useEffect(() => {
    if (!querentFacing && panelRotated) {
      setPanelRotated(false);
    }
  }, [querentFacing, panelRotated]);

  // Escape key closes drawer
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const sortedCards = useMemo(
    () => [...placedCards].sort((a, b) => a.slotIndex - b.slotIndex),
    [placedCards]
  );

  const revealedCards = useMemo(
    () => sortedCards.filter((c) => c.revealed),
    [sortedCards]
  );

  const unrevealedCount = sortedCards.length - revealedCards.length;

  // Keep selectedUid valid whenever cards change
  useEffect(() => {
    if (sortedCards.length === 0) {
      setSelectedUid(null);
      return;
    }
    const stillExists = sortedCards.some((c) => c.uid === selectedUid);
    if (!stillExists) {
      const firstRevealed = sortedCards.find((c) => c.revealed);
      setSelectedUid((firstRevealed ?? sortedCards[0]).uid);
    }
  }, [selectedUid, sortedCards]);

  const selectedEntry = useMemo(() => {
    if (!sortedCards.length) return null;
    const found = sortedCards.find((c) => c.uid === selectedUid) ?? sortedCards[0];
    const indexInSorted = sortedCards.findIndex((c) => c.uid === found.uid);
    const card = getCardById(found.cardId);
    if (!card) return null;
    const slot = activeSpread?.slots[found.slotIndex];
    return {
      placed: found,
      card,
      slotLabel: slot
        ? `${slot.index + 1}. ${slot.labelZh}`
        : `第 ${indexInSorted + 1} 张`,
      slotDescription: slot?.description ?? "桌面自由排布位置",
    };
  }, [activeSpread?.slots, selectedUid, sortedCards]);

  const selectedThumbPath = selectedEntry
    ? getCardImagePath(deckId, selectedEntry.card.slug)
    : null;

  useEffect(() => {
    setThumbErrorSlug(null);
  }, [deckId, selectedEntry?.card.slug]);

  const effectiveQuestion = useMemo(() => {
    const trimmed = question.trim();
    if (trimmed) return trimmed;
    return activeCategory.sampleQuestions[0] ?? "此刻最值得觉察的指引是什么？";
  }, [activeCategory.sampleQuestions, question]);

  const spreadDisplayName = useMemo(() => {
    if (activeSpread) {
      return `${activeSpread.nameZh}（桌面实抽 ${revealedCards.length}/${activeSpread.cardCount} 张）`;
    }
    return `桌面自由排布（${revealedCards.length} 张）`;
  }, [activeSpread, revealedCards.length]);

  const aiCardsPayload = useMemo<AiReadingCardInput[]>(() => {
    return revealedCards.flatMap((placed, idx): AiReadingCardInput[] => {
      const card = getCardById(placed.cardId);
      if (!card) return [];
      const slot = activeSpread?.slots[placed.slotIndex];
      return [
        {
          slotLabel: slot
            ? `${slot.index + 1}. ${slot.labelZh}`
            : `第 ${idx + 1} 张`,
          slotDescription: slot?.description ?? "桌面自由排布位置",
          nameZh: card.nameZh,
          nameEn: card.nameEn,
          reversed: placed.reversed,
          keywords: placed.reversed
            ? card.keywordsReversed
            : card.keywordsUpright,
          meaning: placed.reversed ? card.meaningReversed : card.meaningUpright,
        },
      ];
    });
  }, [activeSpread?.slots, revealedCards]);

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-end md:items-stretch"
          role="dialog"
          aria-modal="true"
          aria-label="桌面牌阵解牌与 AI 推演"
        >
          {/* Dimmed Velvet Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/55 backdrop-blur-sm"
          />

          {/* Responsive Sanctuary Drawer (Right side on iPad/Desktop, Bottom sheet on Mobile) */}
          <motion.aside
            initial={{ opacity: 0, y: 40, x: 0 }}
            animate={{
              opacity: 1,
              y: 0,
              x: 0,
              rotate: panelRotated ? 180 : 0,
            }}
            exit={{ opacity: 0, y: 36 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            style={{ transformOrigin: "center center" }}
            className="uranai-glass-strong relative z-10 flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-3xl border-t border-[var(--border-accent)] shadow-2xl md:h-full md:max-h-[100dvh] md:max-w-md md:rounded-none md:border-t-0 md:border-l"
          >
            {/* Mobile Sheet Grab Indicator */}
            <div className="flex justify-center pt-2.5 pb-1 md:hidden">
              <div className="h-1 w-10 rounded-full bg-[var(--text-muted)]/40" />
            </div>

            {/* ===============================================================
                Drawer Header (safe-area aware)
               =============================================================== */}
            <header className="shrink-0 border-b border-[var(--border-subtle)] px-4 pt-2 pb-3 sm:px-5 md:pt-[max(1rem,env(safe-area-inset-top))]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Sparkles className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                    <h2 className="font-display truncate text-base font-semibold tracking-wide text-[var(--text-primary)]">
                      {activeSpread ? activeSpread.nameZh : "自由排布"} · 解牌室
                    </h2>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
                    <span>{deck.nameZh}</span>
                    <span>·</span>
                    <span>
                      已翻开{" "}
                      <strong className="font-semibold text-[var(--accent-strong)]">
                        {revealedCards.length}
                      </strong>{" "}
                      / {sortedCards.length} 张
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {/* Subtle Tabletop Facing Toggle when not rotated */}
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playHoverTick(soundEnabled);
                      onToggleQuerentFacing();
                    }}
                    title="切换桌面卡牌对坐 180° 朝向"
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition active:scale-95 ${
                      querentFacing
                        ? "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                        : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <FlipVertical2 className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="关闭解牌面板"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 text-[var(--text-secondary)] transition hover:border-[var(--border-accent)] hover:text-[var(--text-primary)] active:scale-95"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* 1-Tap 180° Querent-Facing Panel Rotation Pill */}
              {querentFacing ? (
                <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-[var(--border-accent)] bg-[var(--accent-soft)]/70 px-3 py-2">
                  <span className="text-[11px] text-[var(--text-primary)]">
                    {panelRotated
                      ? "当前为对坐 180° 阅读视角"
                      : "对坐模式已开启 · 可旋转面板供桌对面阅读"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playHoverTick(soundEnabled);
                      setPanelRotated((r) => !r);
                    }}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--border-accent)] bg-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-contrast)] transition hover:brightness-110 active:scale-95"
                  >
                    <RotateCw className="h-3 w-3" />
                    {panelRotated ? "恢复正向" : "180° 对坐旋转面板"}
                  </button>
                </div>
              ) : null}
            </header>

            {/* ===============================================================
                Scrollable Content Area
               =============================================================== */}
            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-5">
              {/* 1. Category Pills & Question Input */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold tracking-[0.14em] text-[var(--text-muted)] uppercase">
                    占卜主题与提问
                  </span>
                  <span className="text-[11px] text-[var(--accent-strong)]">
                    {activeCategory.icon} {activeCategory.nameZh}
                  </span>
                </div>

                {/* Compact 6-Category Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {READING_CATEGORIES.map((cat) => {
                    const isSelected = cat.id === category;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          soundEngine.playHoverTick(soundEnabled);
                          onCategoryChange(cat.id);
                        }}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition active:scale-95 ${
                          isSelected
                            ? "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[0_0_12px_var(--cloth-glow)]"
                            : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/55 text-[var(--text-secondary)] hover:border-[var(--border-accent)]/60 hover:text-[var(--text-primary)]"
                        }`}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.nameZh}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Question Textarea */}
                <div className="relative">
                  <textarea
                    rows={2}
                    value={question}
                    onChange={(e) => onQuestionChange(e.target.value)}
                    placeholder={
                      activeCategory.sampleQuestions[0] ??
                      "写下你此刻想请塔罗照见的问题…"
                    }
                    className="w-full resize-none rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/60 px-3.5 py-2.5 text-sm leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/75 focus:border-[var(--border-accent)] focus:outline-none"
                  />
                  {question.trim() ? (
                    <button
                      type="button"
                      onClick={() => onQuestionChange("")}
                      aria-label="清空提问"
                      className="absolute top-2 right-2 rounded-full p-1 text-[var(--text-muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--text-primary)]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>

                {/* Quick sample question chips when input is empty */}
                {!question.trim() ? (
                  <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
                    {activeCategory.sampleQuestions.slice(0, 3).map((sample) => (
                      <button
                        key={sample}
                        type="button"
                        onClick={() => {
                          soundEngine.playHoverTick(soundEnabled);
                          onQuestionChange(sample);
                        }}
                        className="shrink-0 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/45 px-2.5 py-1 text-[11px] text-[var(--text-muted)] transition hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]"
                      >
                        ✦ {sample.length > 20 ? `${sample.slice(0, 20)}…` : sample}
                      </button>
                    ))}
                  </div>
                ) : null}
              </section>

              {/* 2. Unrevealed Cards Banner */}
              {unrevealedCount > 0 ? (
                <section className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-accent)] bg-[var(--accent-soft)]/70 px-3.5 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--accent-strong)]">
                      尚有 {unrevealedCount} 张暗牌静待揭晓
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                      轻触桌面卡牌逐一翻开，或在此一键全翻
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onRevealAll}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border-accent)] bg-[var(--accent)] px-3.5 py-1.5 text-xs font-semibold text-[var(--accent-contrast)] shadow-[0_4px_16px_var(--cloth-glow)] transition hover:brightness-110 active:scale-95"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    一键全翻
                  </button>
                </section>
              ) : null}

              {/* 3. Empty Table Prompt OR Card-by-Card Traditional Meanings */}
              {sortedCards.length === 0 ? (
                <section className="rounded-2xl border border-dashed border-[var(--border-accent)]/60 bg-[var(--bg-base)]/40 px-4 py-8 text-center">
                  <Layers className="mx-auto h-7 w-7 text-[var(--accent)] opacity-75" />
                  <p className="font-display mt-3 text-sm font-semibold text-[var(--text-primary)]">
                    桌面尚无抽出的塔罗牌
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)]">
                    返回桌布进行揉洗、向右拂动丝带摊牌并抽取卡牌后，这里将即时呈现传统牌义与 AI 深度推演。
                  </p>
                </section>
              ) : (
                <section className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold tracking-[0.14em] text-[var(--text-muted)] uppercase">
                      单牌传统释义
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      共 {sortedCards.length} 张牌
                    </span>
                  </div>

                  {/* Interactive Slot/Card Selector Pills */}
                  <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
                    {sortedCards.map((placed, idx) => {
                      const card = getCardById(placed.cardId);
                      const slot = activeSpread?.slots[placed.slotIndex];
                      const active = selectedEntry?.placed.uid === placed.uid;
                      return (
                        <button
                          key={placed.uid}
                          type="button"
                          onClick={() => {
                            soundEngine.playHoverTick(soundEnabled);
                            setSelectedUid(placed.uid);
                          }}
                          className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-left transition active:scale-95 ${
                            active
                              ? "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[0_0_14px_var(--cloth-glow)]"
                              : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/55 text-[var(--text-secondary)] hover:border-[var(--border-accent)]/60 hover:text-[var(--text-primary)]"
                          }`}
                        >
                          <span className="text-[10px] opacity-75">
                            {slot ? `${slot.index + 1}.` : `#${idx + 1}`}
                          </span>
                          <span className="text-xs font-medium">
                            {placed.revealed && card
                              ? card.nameZh
                              : slot?.labelZh ?? "未翻开"}
                          </span>
                          {placed.revealed ? (
                            <span
                              className={`rounded-full px-1.5 py-0.2 text-[9px] font-semibold ${
                                placed.reversed
                                  ? theme.isLight
                                    ? "bg-amber-700/15 text-amber-800"
                                    : "bg-amber-500/20 text-amber-200"
                                  : theme.isLight
                                    ? "bg-emerald-700/15 text-emerald-800"
                                    : "bg-emerald-500/20 text-emerald-200"
                              }`}
                            >
                              {placed.reversed ? "逆" : "正"}
                            </span>
                          ) : (
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-muted)]/60" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Card Meaning Panel */}
                  {selectedEntry ? (
                    selectedEntry.placed.revealed ? (
                      (() => {
                        const { placed, card, slotLabel, slotDescription } =
                          selectedEntry;
                        const isRev = placed.reversed;
                        const keywords = isRev
                          ? card.keywordsReversed
                          : card.keywordsUpright;
                        const meaning = isRev
                          ? card.meaningReversed
                          : card.meaningUpright;
                        const advice = isRev
                          ? card.adviceReversed
                          : card.adviceUpright;
                        const domain = getDomainInsight(card, isRev, category);
                        const DomainIcon = domain.Icon;

                        return (
                          <div className="space-y-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/55 p-4">
                            {/* Card Header + Mini Artwork + 360° Inspect CTA */}
                            <div className="flex items-start gap-3">
                              {selectedThumbPath &&
                              thumbErrorSlug !== card.slug ? (
                                <button
                                  type="button"
                                  onClick={() => onInspectCard(card, isRev)}
                                  className={`relative w-14 shrink-0 overflow-hidden rounded-lg border border-[var(--border-accent)]/70 shadow-md transition hover:scale-105 active:scale-95 ${deck.aspectClass}`}
                                  title="360° 赏析卡面"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={selectedThumbPath}
                                    alt={card.nameZh}
                                    onError={() => setThumbErrorSlug(card.slug)}
                                    className="h-full w-full object-cover transition-transform"
                                    style={{
                                      transform: isRev
                                        ? "rotate(180deg)"
                                        : undefined,
                                    }}
                                  />
                                </button>
                              ) : null}

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate text-[11px] font-medium text-[var(--accent)]">
                                    {slotLabel}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => onInspectCard(card, isRev)}
                                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-strong)] transition hover:brightness-110 active:scale-95"
                                  >
                                    <Eye className="h-3 w-3" />
                                    360° 赏析
                                  </button>
                                </div>

                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                  <h3 className="font-display text-lg font-semibold text-[var(--text-primary)]">
                                    {card.nameZh}
                                  </h3>
                                  <span
                                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                      isRev
                                        ? theme.isLight
                                          ? "border-amber-700/35 bg-amber-600/12 text-amber-800"
                                          : "border-rose-400/45 bg-rose-500/15 text-rose-300"
                                        : "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                                    }`}
                                  >
                                    {isRev ? "逆位 · Reversed" : "正位 · Upright"}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                                  {card.nameEn} · {card.element}元素 · {card.astrology}
                                </p>
                              </div>
                            </div>

                            {activeSpread ? (
                              <p className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/45 px-3 py-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                                <strong className="text-[var(--accent-strong)]">
                                  牌位含义：
                                </strong>
                                {slotDescription}
                              </p>
                            ) : null}

                            {/* Keywords */}
                            <div className="flex flex-wrap gap-1.5">
                              {keywords.map((kw) => (
                                <span
                                  key={kw}
                                  className="rounded-full border border-[var(--border-accent)]/70 bg-[var(--accent-soft)]/70 px-2.5 py-0.5 text-[11px] text-[var(--accent-strong)]"
                                >
                                  {kw}
                                </span>
                              ))}
                            </div>

                            {/* Authentic Base Meaning */}
                            <p className="text-xs leading-[1.82] text-[var(--text-primary)]/95 sm:text-[13px]">
                              {meaning}
                            </p>

                            {/* Category-Matched Insight */}
                            <div className="rounded-xl border border-[var(--border-accent)]/75 bg-[var(--accent-soft)]/55 p-3">
                              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--accent-strong)]">
                                <DomainIcon className="h-3.5 w-3.5" />
                                {domain.label}
                              </div>
                              <p className="text-xs leading-relaxed text-[var(--text-primary)]/90">
                                {domain.text}
                              </p>
                            </div>

                            {/* Advice & Affirmation */}
                            <div className="grid grid-cols-1 gap-2.5">
                              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/45 p-3">
                                <div className="text-[11px] font-semibold tracking-wider text-[var(--accent)]">
                                  ✦ 行动指引
                                </div>
                                <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                                  {advice}
                                </p>
                              </div>

                              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/45 p-3">
                                <div className="flex items-center gap-1 text-[11px] font-semibold tracking-wider text-[var(--accent)]">
                                  <Quote className="h-3 w-3" />
                                  心灵肯定语
                                </div>
                                <p className="font-display mt-1 text-xs leading-relaxed text-[var(--text-primary)] italic">
                                  「{card.affirmation}」
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/45 px-4 py-6 text-center">
                        <p className="font-display text-sm font-semibold text-[var(--text-primary)]">
                          {selectedEntry.slotLabel} · 尚未翻开
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          点击桌面上的这张牌将其翻开，或点击上方「一键全翻」揭晓全部牌面。
                        </p>
                      </div>
                    )
                  ) : null}
                </section>
              )}

              {/* 4. Full AI Comprehensive Interpretation */}
              <AiInterpretationPanel
                mode="spread"
                question={effectiveQuestion}
                category={activeCategory.nameZh}
                spreadName={spreadDisplayName}
                cards={aiCardsPayload}
                initialInterpretation={aiInterpretation}
                customAi={aiConfig}
                disabled={revealedCards.length === 0}
                disabledHint={
                  sortedCards.length === 0
                    ? "请先从桌布牌扇抽出并翻开塔罗牌，即可开启 AI 深度推理解读"
                    : "请先翻开桌面上的塔罗牌（或点击上方「一键全翻」），即可开启 AI 综合推理解读"
                }
                onInterpretationComplete={onAiComplete}
              />
            </div>

            {/* ===============================================================
                Sticky Footer — Save to Reading History (safe-area aware)
               =============================================================== */}
            <footer className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]/80 px-4 pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:px-5">
              {savedRecordId ? (
                <div className="flex items-center justify-between gap-2">
                  <div
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      theme.isLight
                        ? "border-emerald-700/35 bg-emerald-600/12 text-emerald-800"
                        : "border-emerald-400/40 bg-emerald-500/12 text-emerald-300"
                    }`}
                  >
                    <BookmarkCheck className="h-3.5 w-3.5" />
                    ✦ 已存入历史记录
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playHoverTick(soundEnabled);
                      onSaveHistory();
                    }}
                    className="rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-3.5 py-1.5 text-xs font-medium text-[var(--accent-strong)] transition hover:brightness-110 active:scale-95"
                  >
                    更新记录
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playChime(soundEnabled);
                    onSaveHistory();
                  }}
                  disabled={placedCards.length === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-[var(--border-accent)] bg-[var(--accent)] px-4 py-2.5 text-xs font-semibold tracking-wide text-[var(--accent-contrast)] shadow-[0_6px_22px_var(--cloth-glow)] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <BookmarkPlus className="h-4 w-4" />
                  保存到历史记录
                </button>
              )}
            </footer>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
