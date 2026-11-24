"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Filter,
  Layers,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import type { DeckPoolConfig, MinorSuitKey, SuitType } from "@/types/tarot";
import { TAROT_CARDS } from "@/data/tarot-cards";
import {
  DECK_POOL_PRESETS,
  DEFAULT_DECK_POOL,
  MINOR_SUIT_KEYS,
  MINOR_SUIT_META,
  THEMATIC_POOL_TEMPLATES,
  getPoolCards,
  isCardIncludedByGroups,
  normalizeDeckPool,
} from "@/lib/deck-pool";
import { soundEngine } from "@/lib/sound";

export interface DeckPoolModalProps {
  open: boolean;
  value: DeckPoolConfig;
  minRequiredCards?: number;
  spreadLabel?: string;
  soundEnabled: boolean;
  onApply: (next: DeckPoolConfig) => void;
  onClose: () => void;
}

type CardFilterTab = "all" | SuitType;

const FILTER_TABS: Array<{ id: CardFilterTab; label: string }> = [
  { id: "all", label: "全部" },
  { id: "major", label: "大阿卡纳" },
  { id: "wands", label: "权杖" },
  { id: "cups", label: "圣杯" },
  { id: "swords", label: "宝剑" },
  { id: "pentacles", label: "星币" },
];

export function DeckPoolModal({
  open,
  value,
  minRequiredCards = 1,
  spreadLabel,
  soundEnabled,
  onApply,
  onClose,
}: DeckPoolModalProps) {
  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState<DeckPoolConfig>(value);
  const [showCardPicker, setShowCardPicker] = useState(false);
  const [filterTab, setFilterTab] = useState<CardFilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setDraft(value);
      setSearchQuery("");
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const activeCards = useMemo(() => getPoolCards(draft, TAROT_CARDS), [draft]);
  const activeCount = activeCards.length;
  const excludedSet = useMemo(
    () => new Set(draft.excludedCardIds),
    [draft.excludedCardIds]
  );

  // Cards enabled by current group toggles (eligible for individual exclude/include)
  const groupEligibleCards = useMemo(
    () => TAROT_CARDS.filter((card) => isCardIncludedByGroups(card, draft)),
    [draft]
  );

  const activeExcludedInGroupCount = useMemo(
    () => groupEligibleCards.filter((c) => excludedSet.has(c.id)).length,
    [excludedSet, groupEligibleCards]
  );

  const filteredPickerCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return groupEligibleCards.filter((card) => {
      if (filterTab !== "all" && card.suit !== filterTab) return false;
      if (!q) return true;
      return (
        card.nameZh.toLowerCase().includes(q) ||
        card.nameEn.toLowerCase().includes(q) ||
        (card.romanNumeral?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [filterTab, groupEligibleCards, searchQuery]);

  const anyMinorRankOn = draft.includeMinorPips || draft.includeCourt;
  const anySuitOn = MINOR_SUIT_KEYS.some((k) => draft.suits[k]);
  const belowMinSpread = activeCount > 0 && activeCount < minRequiredCards;

  const updateDraft = (
    updater: (prev: DeckPoolConfig) => Omit<DeckPoolConfig, "presetId">
  ) => {
    setDraft((prev) => normalizeDeckPool(updater(prev)));
  };

  const handleToggleMajor = () => {
    soundEngine.playHoverTick(soundEnabled);
    updateDraft((prev) => ({
      ...prev,
      includeMajor: !prev.includeMajor,
    }));
  };

  const handleToggleMinorRank = (rank: "pips" | "court") => {
    soundEngine.playHoverTick(soundEnabled);
    updateDraft((prev) => {
      const nextPips =
        rank === "pips" ? !prev.includeMinorPips : prev.includeMinorPips;
      const nextCourt =
        rank === "court" ? !prev.includeCourt : prev.includeCourt;
      const hasAnySuit = MINOR_SUIT_KEYS.some((k) => prev.suits[k]);
      const nextSuits =
        (nextPips || nextCourt) && !hasAnySuit
          ? { wands: true, cups: true, swords: true, pentacles: true }
          : prev.suits;
      return {
        ...prev,
        includeMinorPips: nextPips,
        includeCourt: nextCourt,
        suits: nextSuits,
      };
    });
  };

  const handleToggleSuit = (suit: MinorSuitKey) => {
    soundEngine.playHoverTick(soundEnabled);
    updateDraft((prev) => {
      const nextSuitVal = !prev.suits[suit];
      const nextSuits = { ...prev.suits, [suit]: nextSuitVal };
      const needRankAutoEnable =
        nextSuitVal && !prev.includeMinorPips && !prev.includeCourt;
      return {
        ...prev,
        includeMinorPips: needRankAutoEnable ? true : prev.includeMinorPips,
        includeCourt: needRankAutoEnable ? true : prev.includeCourt,
        suits: nextSuits,
      };
    });
  };

  const handleToggleCardExclusion = (cardId: string) => {
    soundEngine.playHoverTick(soundEnabled);
    updateDraft((prev) => {
      const exists = prev.excludedCardIds.includes(cardId);
      return {
        ...prev,
        excludedCardIds: exists
          ? prev.excludedCardIds.filter((id) => id !== cardId)
          : [...prev.excludedCardIds, cardId],
      };
    });
  };

  const handleApply = () => {
    if (activeCount < 1) return;
    soundEngine.playChime(soundEnabled);
    onApply(draft);
    onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div
          className="fixed inset-0 z-[115] flex items-end justify-center sm:items-center sm:p-5"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/62 backdrop-blur-sm"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="洗牌牌池与占卜规则设置"
            initial={{ opacity: 0, y: 36, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            className="uranai-glass-strong relative z-10 flex max-h-[88dvh] w-full max-w-2xl flex-col rounded-t-3xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_24px_68px_rgba(0,0,0,0.68)] sm:rounded-3xl sm:p-6"
          >
            {/* Mobile grab bar */}
            <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-[var(--border-accent)] opacity-60 sm:hidden" />

            {/* Modal Header */}
            <div className="mb-3.5 flex shrink-0 items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent)]">
                  <Filter className="h-4 w-4" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-base font-semibold tracking-wide text-[var(--text-primary)]">
                      洗牌牌池与占卜规则
                    </h2>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                        activeCount === 0 || belowMinSpread
                          ? "border-amber-400/50 bg-amber-500/20 text-amber-200"
                          : "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                      }`}
                    >
                      已纳入 {activeCount} / 78 张
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    按不同占卜流派自由设定参与洗牌、揉搓与摊牌的牌组范围
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="关闭牌池规则弹窗"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] text-[var(--text-muted)] transition hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div
              className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-0.5"
              style={{ touchAction: "pan-y" }}
            >
              {/* Section 1: 6 Traditional Divination Rule Presets */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold tracking-wide text-[var(--text-primary)]">
                    经典占卜流派规则
                  </h3>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    一键切换常用牌数
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {DECK_POOL_PRESETS.map((preset) => {
                    const active = draft.presetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          soundEngine.playHoverTick(soundEnabled);
                          setDraft(preset.config);
                        }}
                        className={`flex flex-col rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                          active
                            ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_0_20px_var(--cloth-glow)]"
                            : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/75 hover:border-[var(--border-accent)]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate text-xs font-semibold text-[var(--text-primary)]">
                              {preset.nameZh}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <span className="rounded-full border border-[var(--border-subtle)] bg-black/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--accent-strong)]">
                              {preset.cardCount} 张
                            </span>
                            {active ? (
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-contrast)]">
                                <Check className="h-2.5 w-2.5" />
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <span className="mt-1 text-[10px] font-medium text-[var(--accent)]">
                          {preset.traditionTag}
                        </span>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                          {preset.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Section 1.5: Quick Thematic Combinations */}
              <section className="space-y-1.5">
                <span className="block text-xs font-semibold tracking-wide text-[var(--text-primary)]">
                  专题快速组合
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {THEMATIC_POOL_TEMPLATES.map((tpl) => {
                    const isMatch =
                      draft.includeMajor === tpl.config.includeMajor &&
                      draft.includeMinorPips === tpl.config.includeMinorPips &&
                      draft.includeCourt === tpl.config.includeCourt &&
                      draft.excludedCardIds.length === 0 &&
                      MINOR_SUIT_KEYS.every(
                        (k) => draft.suits[k] === tpl.config.suits[k]
                      );
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        title={tpl.desc}
                        onClick={() => {
                          soundEngine.playHoverTick(soundEnabled);
                          setDraft(tpl.config);
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition active:scale-95 ${
                          isMatch
                            ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                            : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 text-[var(--text-secondary)] hover:border-[var(--border-accent)]"
                        }`}
                      >
                        <Sparkles className="h-3 w-3 text-[var(--accent)]" />
                        <span>{tpl.nameZh}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Section 2: Granular Group Toggles */}
              <section className="space-y-2.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/55 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold tracking-wide text-[var(--text-primary)]">
                    自定义分组勾选（决定哪些牌加入洗牌）
                  </h3>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    可自由搭配大牌、牌阶与花色
                  </span>
                </div>

                {/* Arcana & Rank Row */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={handleToggleMajor}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition active:scale-[0.98] ${
                      draft.includeMajor
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                        : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 text-[var(--text-muted)]"
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold">大阿卡纳</div>
                      <div className="text-[10px] opacity-80">0–XXI · 22 张</div>
                    </div>
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                        draft.includeMajor
                          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]"
                          : "border-[var(--border-subtle)]"
                      }`}
                    >
                      {draft.includeMajor ? <Check className="h-3 w-3" /> : null}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleMinorRank("pips")}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition active:scale-[0.98] ${
                      draft.includeMinorPips
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                        : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 text-[var(--text-muted)]"
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold">小牌 · 数字牌</div>
                      <div className="text-[10px] opacity-80">Ace–10 · 每花色 10 张</div>
                    </div>
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                        draft.includeMinorPips
                          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]"
                          : "border-[var(--border-subtle)]"
                      }`}
                    >
                      {draft.includeMinorPips ? <Check className="h-3 w-3" /> : null}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleMinorRank("court")}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition active:scale-[0.98] ${
                      draft.includeCourt
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                        : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 text-[var(--text-muted)]"
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold">小牌 · 宫廷牌</div>
                      <div className="text-[10px] opacity-80">侍从~国王 · 每花色 4 张</div>
                    </div>
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                        draft.includeCourt
                          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]"
                          : "border-[var(--border-subtle)]"
                      }`}
                    >
                      {draft.includeCourt ? <Check className="h-3 w-3" /> : null}
                    </span>
                  </button>
                </div>

                {/* 4 Minor Suits Row */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                      小阿卡纳四元素花色
                    </span>
                    {!anyMinorRankOn && anySuitOn ? (
                      <span className="text-[10px] text-amber-300/90">
                        请至少勾选「数字牌」或「宫廷牌」
                      </span>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {MINOR_SUIT_KEYS.map((suitKey) => {
                      const meta = MINOR_SUIT_META[suitKey];
                      const active = draft.suits[suitKey] && anyMinorRankOn;
                      const suitCount =
                        (draft.includeMinorPips ? 10 : 0) +
                        (draft.includeCourt ? 4 : 0);
                      return (
                        <button
                          key={suitKey}
                          type="button"
                          onClick={() => handleToggleSuit(suitKey)}
                          className={`flex flex-col rounded-xl border px-2.5 py-2 text-left transition active:scale-[0.98] ${
                            active
                              ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                              : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 text-[var(--text-muted)]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-semibold">
                              {meta.nameZh}
                            </span>
                            <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[9px]">
                              {active ? `${suitCount}张` : "未选"}
                            </span>
                          </div>
                          <span className="mt-0.5 text-[10px] opacity-80">
                            {meta.badge} · {meta.nameEn}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* Section 3: Collapsible Individual Card Exclusion / Inclusion Picker */}
              <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/55">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playHoverTick(soundEnabled);
                    setShowCardPicker((v) => !v);
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5 text-[var(--accent)]" />
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      按单张牌精细剔除 / 纳入（如先抽出指示牌不参与洗牌）
                    </span>
                    {activeExcludedInGroupCount > 0 ? (
                      <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                        已剔除 {activeExcludedInGroupCount} 张
                      </span>
                    ) : null}
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform ${
                      showCardPicker ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {showCardPicker ? (
                  <div className="space-y-2.5 border-t border-[var(--border-subtle)] px-3.5 pt-3 pb-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative min-w-[160px] flex-1">
                        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="搜索牌名（如 愚人、恋人、权杖三）…"
                          className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/60 py-1.5 pr-3 pl-8 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                        />
                      </div>
                      {activeExcludedInGroupCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playHoverTick(soundEnabled);
                            updateDraft((prev) => ({
                              ...prev,
                              excludedCardIds: [],
                            }));
                          }}
                          className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-accent)] bg-[var(--accent-soft)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--accent-strong)] transition hover:brightness-110"
                        >
                          <RotateCcw className="h-3 w-3" />
                          全部重新纳入
                        </button>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {FILTER_TABS.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setFilterTab(tab.id)}
                          className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition ${
                            filterTab === tab.id
                              ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                              : "bg-[var(--bg-base)]/55 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {filteredPickerCards.length === 0 ? (
                      <p className="py-4 text-center text-xs text-[var(--text-muted)]">
                        当前分组或筛选条件下没有可选牌面。
                      </p>
                    ) : (
                      <div className="grid max-h-48 grid-cols-2 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4">
                        {filteredPickerCards.map((card) => {
                          const isExcluded = excludedSet.has(card.id);
                          return (
                            <button
                              key={card.id}
                              type="button"
                              onClick={() => handleToggleCardExclusion(card.id)}
                              className={`flex items-center justify-between gap-1.5 rounded-xl border px-2.5 py-1.5 text-left text-[11px] transition ${
                                isExcluded
                                  ? "border-rose-400/35 bg-rose-500/10 text-[var(--text-muted)] line-through opacity-75"
                                  : "border-[var(--border-subtle)] bg-[var(--bg-base)]/55 text-[var(--text-primary)] hover:border-[var(--border-accent)]"
                              }`}
                            >
                              <span className="truncate">
                                {card.romanNumeral ? `${card.romanNumeral} ` : ""}
                                {card.nameZh}
                              </span>
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${
                                  isExcluded ? "bg-rose-400/70" : "bg-emerald-400"
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </section>
            </div>

            {/* Warning Banner if below active spread requirement */}
            {activeCount === 0 || belowMinSpread ? (
              <div className="mt-3 flex shrink-0 items-center justify-between gap-2 rounded-2xl border border-amber-400/40 bg-amber-500/15 px-3.5 py-2 text-xs text-amber-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    {activeCount === 0
                      ? "至少需要保留 1 张牌才能洗牌占卜。"
                      : `当前「${spreadLabel ?? "所选牌阵"}」需要 ${minRequiredCards} 张牌，已选牌池仅 ${activeCount} 张。`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playHoverTick(soundEnabled);
                    setDraft(DEFAULT_DECK_POOL);
                  }}
                  className="shrink-0 rounded-full border border-amber-300/50 bg-amber-400/20 px-2.5 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-400/30"
                >
                  恢复 78 张
                </button>
              </div>
            ) : null}

            {/* Footer */}
            <div className="mt-3.5 flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playHoverTick(soundEnabled);
                  setDraft(DEFAULT_DECK_POOL);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-accent)] hover:text-[var(--text-primary)] active:scale-95"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                重置 78 张全副
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full border border-[var(--border-subtle)] px-3.5 py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={activeCount < 1}
                  onClick={handleApply}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-accent)] bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--accent-contrast)] shadow-[0_6px_22px_var(--cloth-glow)] transition hover:brightness-110 active:scale-95 disabled:opacity-40"
                >
                  <Check className="h-3.5 w-3.5" />
                  应用规则（{activeCount} 张洗牌）
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
