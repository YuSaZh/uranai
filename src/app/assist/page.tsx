"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Layers,
  RotateCw,
  ScanSearch,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useUranai } from "@/context/UranaiProvider";
import { getCardById } from "@/data/tarot-cards";
import { getCardImagePath, getCardThumbPath } from "@/data/decks";
import { getCategoryById, getSpreadById } from "@/data/spreads";
import { getLocalDateKey } from "@/lib/storage";
import { soundEngine } from "@/lib/sound";
import { CardInspectorModal } from "@/components/tarot/CardInspectorModal";
import { AssistCardPicker } from "@/components/assist/AssistCardPicker";
import { AssistQuickLookupModal } from "@/components/assist/AssistQuickLookupModal";
import { AssistReadingPanel } from "@/components/assist/AssistReadingPanel";
import type {
  AssistQuickLookupTarget,
  AssistSelectedCard,
  AssistSpreadId,
} from "@/components/assist/types";
import type {
  DrawnCard,
  ReadingCategoryId,
  ReadingRecord,
  SpreadId,
  TarotCard,
} from "@/types/tarot";

type AssistViewMode = "picker" | "reading";

const MAX_ASSIST_CARDS = 12;

function resolveRecordSpreadId(
  spreadId: AssistSpreadId,
  cardCount: number
): SpreadId {
  if (spreadId !== "free") {
    return spreadId;
  }
  if (cardCount <= 1) return "single";
  if (cardCount <= 3) return "time-flow";
  if (cardCount <= 5) return "cross-five";
  if (cardCount === 6) return "love-mirror";
  return "celtic-cross";
}

function toDrawnCards(cards: AssistSelectedCard[]): DrawnCard[] {
  return cards.map((item, idx) => ({
    cardId: item.cardId,
    slotIndex: idx,
    reversed: item.reversed,
    revealed: true,
  }));
}

function resolveSlotLabel(
  index: number,
  item: AssistSelectedCard | undefined,
  spreadId: AssistSpreadId
): string {
  const custom = item?.customSlotLabel?.trim();
  if (custom) return custom;
  if (spreadId !== "free") {
    const spread = getSpreadById(spreadId);
    const slot = spread.slots[index];
    if (slot) return slot.labelZh;
  }
  return `第 ${index + 1} 张`;
}

export default function PhysicalAssistPage() {
  const {
    prefs,
    theme,
    deck,
    aiConfig,
    addReading,
    updateReading,
    setDeckId,
  } = useUranai();

  const [selectedCards, setSelectedCards] = useState<AssistSelectedCard[]>([]);
  const [spreadId, setSpreadId] = useState<AssistSpreadId>("free");
  const [categoryId, setCategoryId] = useState<ReadingCategoryId>("general");
  const [question, setQuestion] = useState<string>("");
  const [activeView, setActiveView] = useState<AssistViewMode>("picker");
  const [quickLookupTarget, setQuickLookupTarget] =
    useState<AssistQuickLookupTarget | null>(null);
  const [inspectTarget, setInspectTarget] = useState<{
    card: TarotCard;
    reversed: boolean;
  } | null>(null);
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);
  const [aiInterpretation, setAiInterpretation] = useState<string>("");
  const [limitNotice, setLimitNotice] = useState<string | null>(null);

  const selectedCardsRef = useRef<AssistSelectedCard[]>(selectedCards);
  const spreadIdRef = useRef<AssistSpreadId>(spreadId);
  const savedRecordIdRef = useRef<string | null>(savedRecordId);
  const uidCounterRef = useRef<number>(0);
  const noticeTimerRef = useRef<number | null>(null);

  selectedCardsRef.current = selectedCards;
  spreadIdRef.current = spreadId;
  savedRecordIdRef.current = savedRecordId;

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  const showLimitNotice = useCallback((message: string) => {
    setLimitNotice(message);
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setLimitNotice(null);
      noticeTimerRef.current = null;
    }, 2600);
  }, []);

  const resetSavedSession = useCallback(() => {
    savedRecordIdRef.current = null;
    setSavedRecordId(null);
    setAiInterpretation("");
  }, []);

  const handleSwitchView = useCallback(
    (nextView: AssistViewMode) => {
      soundEngine.playHoverTick(prefs.soundEnabled);
      setActiveView(nextView);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [prefs.soundEnabled]
  );

  const handleAddCard = useCallback(
    (cardId: string, reversed: boolean) => {
      const current = selectedCardsRef.current;
      if (current.some((item) => item.cardId === cardId)) {
        return;
      }
      if (current.length >= MAX_ASSIST_CARDS) {
        soundEngine.playHoverTick(prefs.soundEnabled);
        showLimitNotice(
          `单次最多录入 ${MAX_ASSIST_CARDS} 张实体牌，可先移除部分牌面再添加`
        );
        return;
      }

      uidCounterRef.current += 1;
      const newUid = `assist-${Date.now()}-${uidCounterRef.current}`;
      const newEntry: AssistSelectedCard = {
        uid: newUid,
        cardId,
        reversed,
      };
      const nextCards = [...current, newEntry];
      selectedCardsRef.current = nextCards;
      setSelectedCards(nextCards);
      resetSavedSession();

      const nextIndex = nextCards.length - 1;
      const nextSlotLabel = resolveSlotLabel(
        nextIndex,
        newEntry,
        spreadIdRef.current
      );
      setQuickLookupTarget((prev) =>
        prev && prev.card.id === cardId
          ? {
              ...prev,
              reversed,
              selectedUid: newUid,
              slotLabel: nextSlotLabel,
            }
          : prev
      );

      soundEngine.playCardDraw(prefs.soundEnabled);
      if (
        prefs.hapticsEnabled &&
        typeof navigator !== "undefined" &&
        "vibrate" in navigator
      ) {
        navigator.vibrate(10);
      }
    },
    [
      prefs.hapticsEnabled,
      prefs.soundEnabled,
      resetSavedSession,
      showLimitNotice,
    ]
  );

  const handleToggleCardReversed = useCallback(
    (uid: string) => {
      const current = selectedCardsRef.current;
      const targetIndex = current.findIndex((item) => item.uid === uid);
      if (targetIndex < 0) return;

      const nextReversed = !current[targetIndex].reversed;
      const nextCards = current.map((item) =>
        item.uid === uid ? { ...item, reversed: nextReversed } : item
      );
      selectedCardsRef.current = nextCards;
      setSelectedCards(nextCards);
      resetSavedSession();

      setQuickLookupTarget((prev) =>
        prev && prev.selectedUid === uid
          ? { ...prev, reversed: nextReversed }
          : prev
      );

      soundEngine.playCardFlip(prefs.soundEnabled);
    },
    [prefs.soundEnabled, resetSavedSession]
  );

  const handleRemoveCard = useCallback(
    (uid: string) => {
      const current = selectedCardsRef.current;
      const nextCards = current.filter((item) => item.uid !== uid);
      if (nextCards.length === current.length) return;

      selectedCardsRef.current = nextCards;
      setSelectedCards(nextCards);
      resetSavedSession();

      setQuickLookupTarget((prev) =>
        prev && prev.selectedUid === uid
          ? { ...prev, selectedUid: undefined, slotLabel: undefined }
          : prev
      );

      soundEngine.playHoverTick(prefs.soundEnabled);
    },
    [prefs.soundEnabled, resetSavedSession]
  );

  const handleMoveCard = useCallback(
    (uid: string, direction: -1 | 1) => {
      const current = selectedCardsRef.current;
      const index = current.findIndex((item) => item.uid === uid);
      if (index < 0) return;

      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) return;

      const nextCards = [...current];
      const [moved] = nextCards.splice(index, 1);
      nextCards.splice(targetIndex, 0, moved);

      selectedCardsRef.current = nextCards;
      setSelectedCards(nextCards);
      resetSavedSession();

      const updatedSlotLabel = resolveSlotLabel(
        targetIndex,
        moved,
        spreadIdRef.current
      );
      setQuickLookupTarget((prev) =>
        prev && prev.selectedUid === uid
          ? { ...prev, slotLabel: updatedSlotLabel }
          : prev
      );

      soundEngine.playHoverTick(prefs.soundEnabled);
    },
    [prefs.soundEnabled, resetSavedSession]
  );

  const handleRenameSlot = useCallback((uid: string, label: string) => {
    const current = selectedCardsRef.current;
    const index = current.findIndex((item) => item.uid === uid);
    if (index < 0) return;

    const nextCards = current.map((item) =>
      item.uid === uid ? { ...item, customSlotLabel: label } : item
    );
    selectedCardsRef.current = nextCards;
    setSelectedCards(nextCards);

    const updatedItem = nextCards[index];
    const resolvedLabel = resolveSlotLabel(
      index,
      updatedItem,
      spreadIdRef.current
    );
    setQuickLookupTarget((prev) =>
      prev && prev.selectedUid === uid
        ? { ...prev, slotLabel: resolvedLabel }
        : prev
    );
  }, []);

  const handleClearAll = useCallback(() => {
    if (selectedCardsRef.current.length === 0) return;
    selectedCardsRef.current = [];
    setSelectedCards([]);
    resetSavedSession();
    setQuickLookupTarget((prev) =>
      prev?.selectedUid
        ? { ...prev, selectedUid: undefined, slotLabel: undefined }
        : prev
    );
    soundEngine.playShuffle(prefs.soundEnabled);
  }, [prefs.soundEnabled, resetSavedSession]);

  const handleSpreadChange = useCallback(
    (nextSpreadId: AssistSpreadId) => {
      soundEngine.playHoverTick(prefs.soundEnabled);
      spreadIdRef.current = nextSpreadId;
      setSpreadId(nextSpreadId);
    },
    [prefs.soundEnabled]
  );

  const handleCategoryChange = useCallback(
    (nextCategoryId: ReadingCategoryId) => {
      soundEngine.playHoverTick(prefs.soundEnabled);
      setCategoryId(nextCategoryId);
    },
    [prefs.soundEnabled]
  );

  const handleQuickLookup = useCallback(
    (
      card: TarotCard,
      reversed: boolean,
      selectedUid?: string,
      slotLabel?: string
    ) => {
      const current = selectedCardsRef.current;
      const matchedIndex = selectedUid
        ? current.findIndex((item) => item.uid === selectedUid)
        : current.findIndex((item) => item.cardId === card.id);
      const matched = matchedIndex >= 0 ? current[matchedIndex] : undefined;

      const resolvedUid = selectedUid ?? matched?.uid;
      const resolvedReversed =
        selectedUid !== undefined
          ? reversed
          : matched
            ? matched.reversed
            : reversed;
      const resolvedSlotLabel =
        slotLabel ??
        (matchedIndex >= 0
          ? resolveSlotLabel(matchedIndex, matched, spreadIdRef.current)
          : undefined);

      soundEngine.playHoverTick(prefs.soundEnabled);
      setQuickLookupTarget({
        card,
        reversed: resolvedReversed,
        selectedUid: resolvedUid,
        slotLabel: resolvedSlotLabel,
      });
    },
    [prefs.soundEnabled]
  );

  const handleInspect3D = useCallback(
    (card: TarotCard, reversed: boolean) => {
      soundEngine.playHoverTick(prefs.soundEnabled);
      setQuickLookupTarget(null);
      setInspectTarget({ card, reversed });
    },
    [prefs.soundEnabled]
  );

  const persistReading = useCallback(
    (overrideAiText?: string): string | null => {
      const currentCards = selectedCardsRef.current;
      if (currentCards.length === 0) return null;

      const drawn = toDrawnCards(currentCards);
      const categoryMeta = getCategoryById(categoryId);
      const effectiveQuestion =
        question.trim() || `实体牌辅助 · ${categoryMeta.nameZh}解读`;
      const recordSpreadId = resolveRecordSpreadId(spreadId, drawn.length);
      const nextAiText =
        overrideAiText !== undefined ? overrideAiText : aiInterpretation;
      const nowIso = new Date().toISOString();

      if (savedRecordIdRef.current) {
        const existingId = savedRecordIdRef.current;
        updateReading(existingId, {
          category: categoryId,
          question: effectiveQuestion,
          spreadId: recordSpreadId,
          deckId: deck.id,
          themeId: theme.id,
          cards: drawn,
          ...(nextAiText ? { aiInterpretation: nextAiText } : {}),
        });
        return existingId;
      }

      const newId = `assist-${Date.now()}`;
      const record: ReadingRecord = {
        id: newId,
        mode: "spread",
        dateKey: getLocalDateKey(),
        category: categoryId,
        question: effectiveQuestion,
        spreadId: recordSpreadId,
        deckId: deck.id,
        themeId: theme.id,
        cards: drawn,
        ...(nextAiText ? { aiInterpretation: nextAiText } : {}),
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      savedRecordIdRef.current = newId;
      setSavedRecordId(newId);
      addReading(record);
      return newId;
    },
    [
      addReading,
      aiInterpretation,
      categoryId,
      deck.id,
      question,
      spreadId,
      theme.id,
      updateReading,
    ]
  );

  const handleSaveReading = useCallback(() => {
    const recordId = persistReading();
    if (recordId) {
      soundEngine.playChime(prefs.soundEnabled);
    }
  }, [persistReading, prefs.soundEnabled]);

  const handleAiComplete = useCallback(
    (fullText: string) => {
      setAiInterpretation(fullText);
      persistReading(fullText);
    },
    [persistReading]
  );

  const resolvedSelectedEntries = useMemo(() => {
    return selectedCards
      .map((entry, idx) => {
        const card = getCardById(entry.cardId);
        if (!card) return null;
        return {
          entry,
          card,
          index: idx,
          slotLabel: resolveSlotLabel(idx, entry, spreadId),
          thumbSrc:
            getCardThumbPath(deck.id, card.slug) ??
            getCardImagePath(deck.id, card.slug),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [deck.id, selectedCards, spreadId]);

  const stickyTrayPreviewText = useMemo(() => {
    if (resolvedSelectedEntries.length === 0) return "";
    const topFour = resolvedSelectedEntries
      .slice(0, 4)
      .map(({ card, entry }) =>
        entry.reversed ? `${card.nameZh}(逆)` : card.nameZh
      );
    const suffix =
      resolvedSelectedEntries.length > 4
        ? ` 等 ${resolvedSelectedEntries.length} 张`
        : "";
    return `${topFour.join(" · ")}${suffix}`;
  }, [resolvedSelectedEntries]);

  return (
    <div className="space-y-5">
      {/* Page Header & Dual-View Segmented Switch */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-display text-xs tracking-[0.26em] text-[var(--accent)] uppercase">
              Physical Deck Companion
            </p>
            <h1 className="font-display mt-0.5 text-2xl font-semibold tracking-wide text-[var(--text-primary)] sm:text-3xl">
              实体牌辅助模式
            </h1>
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
              用真实塔罗牌占卜时，闪电筛选速查单牌基础解读，或录入多张已抽牌面开启
              AI 综合推演
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/75 px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] backdrop-blur-md">
              <Layers className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span>
                已录{" "}
                <strong className="font-semibold text-[var(--accent-strong)]">
                  {selectedCards.length}
                </strong>
                /{MAX_ASSIST_CARDS} 张
              </span>
            </span>

            {savedRecordId && (
              <Link
                href="/history"
                onClick={() => soundEngine.playHoverTick(prefs.soundEnabled)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--accent-strong)] transition hover:brightness-110 active:scale-95"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--accent)]" />
                <span>已存记录</span>
              </Link>
            )}
          </div>
        </div>

        {/* Dual-Mode Segmented Control */}
        <div
          role="tablist"
          aria-label="实体牌辅助视图切换"
          className="uranai-glass grid grid-cols-2 gap-1.5 rounded-2xl p-1.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "picker"}
            onClick={() => handleSwitchView("picker")}
            className={`relative flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors sm:text-sm ${
              activeView === "picker"
                ? "text-[var(--accent-strong)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {activeView === "picker" && (
              <motion.span
                layoutId="assist-view-pill"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className="absolute inset-0 rounded-xl border border-[var(--border-accent)] bg-[var(--accent-soft)] shadow-[0_0_20px_var(--cloth-glow)]"
              />
            )}
            <ScanSearch className="relative z-10 h-4 w-4 shrink-0 text-[var(--accent)]" />
            <span className="relative z-10 truncate">选牌与单牌速查</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeView === "reading"}
            onClick={() => handleSwitchView("reading")}
            className={`relative flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors sm:text-sm ${
              activeView === "reading"
                ? "text-[var(--accent-strong)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {activeView === "reading" && (
              <motion.span
                layoutId="assist-view-pill"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className="absolute inset-0 rounded-xl border border-[var(--border-accent)] bg-[var(--accent-soft)] shadow-[0_0_20px_var(--cloth-glow)]"
              />
            )}
            <Sparkles className="relative z-10 h-4 w-4 shrink-0 text-[var(--accent)]" />
            <span className="relative z-10 truncate">已选牌阵 & AI 解牌</span>
            <span
              className={`relative z-10 inline-flex min-w-[1.35rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                selectedCards.length > 0
                  ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                  : "border border-[var(--border-subtle)] bg-[var(--bg-surface)]/80 text-[var(--text-muted)]"
              }`}
            >
              {selectedCards.length}
            </span>
          </button>
        </div>

        {/* Compact Selected Cards Quick Strip (visible in Picker view when cards are selected) */}
        <AnimatePresence initial={false}>
          {activeView === "picker" && resolvedSelectedEntries.length > 0 && (
            <motion.section
              key="assist-quick-strip"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              aria-label="已抽实体牌快览条"
              className="uranai-glass gold-shimmer-border rounded-2xl p-3 sm:px-4 sm:py-3"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    已抽实体牌 ({resolvedSelectedEntries.length})
                  </span>
                  <span className="hidden text-[11px] text-[var(--text-muted)] sm:inline">
                    轻触牌名速查 · 点正/逆秒翻
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 px-2.5 py-1 text-[11px] text-[var(--text-muted)] transition hover:border-rose-400/45 hover:text-rose-300 active:scale-95"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>清空</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchView("reading")}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--border-accent)] bg-[var(--accent)] px-3 py-1 text-[11px] font-semibold text-[var(--accent-contrast)] shadow-[0_6px_18px_var(--cloth-glow)] transition hover:brightness-110 active:scale-95"
                  >
                    <span>去 AI 解牌</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <AnimatePresence initial={false}>
                  {resolvedSelectedEntries.map(
                    ({ entry, card, index, slotLabel, thumbSrc }) => (
                      <motion.div
                        key={entry.uid}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        transition={{ duration: 0.18 }}
                        className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/80 py-1 pr-1.5 pl-1.5 transition hover:border-[var(--border-accent)]"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            handleQuickLookup(
                              card,
                              entry.reversed,
                              entry.uid,
                              slotLabel
                            )
                          }
                          title={`速查：${card.nameZh}（${entry.reversed ? "逆位" : "正位"}）`}
                          className="flex items-center gap-1.5 text-left focus:outline-none"
                        >
                          <span className="relative flex h-7 w-4.5 shrink-0 items-center justify-center overflow-hidden rounded-[4px] border border-[var(--border-accent)]/60 bg-black/30">
                            {thumbSrc ? (
                              <img
                                src={thumbSrc}
                                alt={card.nameZh}
                                className={`h-full w-full object-cover transition-transform duration-300 ${
                                  entry.reversed ? "rotate-180" : ""
                                }`}
                              />
                            ) : (
                              <span className="text-[9px] font-semibold text-[var(--accent)]">
                                {index + 1}
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] font-semibold text-[var(--text-muted)]">
                            {index + 1}.
                          </span>
                          <span className="max-w-[5.25rem] truncate text-xs font-medium text-[var(--text-primary)]">
                            {card.nameZh}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleCardReversed(entry.uid);
                          }}
                          title="点击切换正位 / 逆位"
                          aria-label={`切换${card.nameZh}正逆位`}
                          className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold transition active:scale-90 ${
                            entry.reversed
                              ? "border-rose-400/45 bg-rose-500/15 text-rose-300"
                              : "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                          }`}
                        >
                          <RotateCw className="h-2.5 w-2.5" />
                          <span>{entry.reversed ? "逆" : "正"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveCard(entry.uid);
                          }}
                          title={`移除 ${card.nameZh}`}
                          aria-label={`移除${card.nameZh}`}
                          className="flex h-5 w-5 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-rose-500/15 hover:text-rose-300 active:scale-90"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </motion.div>
                    )
                  )}
                </AnimatePresence>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Limit feedback banner */}
        <AnimatePresence>
          {limitNotice && (
            <motion.div
              key="assist-limit-notice"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              role="status"
              className="rounded-xl border border-[var(--border-accent)] bg-[var(--accent-soft)] px-3.5 py-2 text-center text-xs font-medium text-[var(--accent-strong)]"
            >
              {limitNotice}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Active View */}
      <AnimatePresence mode="wait">
        {activeView === "picker" ? (
          <motion.div
            key="assist-picker-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className={selectedCards.length > 0 ? "pb-24" : ""}
          >
            <AssistCardPicker
              deck={deck}
              selectedCards={selectedCards}
              maxCards={MAX_ASSIST_CARDS}
              soundEnabled={prefs.soundEnabled}
              onAddCard={handleAddCard}
              onToggleCardReversed={handleToggleCardReversed}
              onRemoveCard={handleRemoveCard}
              onQuickLookup={(card, reversed, selectedUid) =>
                handleQuickLookup(card, reversed, selectedUid)
              }
            />
          </motion.div>
        ) : (
          <motion.div
            key="assist-reading-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <AssistReadingPanel
              selectedCards={selectedCards}
              spreadId={spreadId}
              categoryId={categoryId}
              question={question}
              deck={deck}
              aiConfig={aiConfig}
              soundEnabled={prefs.soundEnabled}
              savedRecordId={savedRecordId}
              aiInterpretation={aiInterpretation}
              onSpreadChange={handleSpreadChange}
              onCategoryChange={handleCategoryChange}
              onQuestionChange={setQuestion}
              onToggleReversed={handleToggleCardReversed}
              onMoveCard={handleMoveCard}
              onRemoveCard={handleRemoveCard}
              onRenameSlot={handleRenameSlot}
              onClearAll={handleClearAll}
              onQuickLookup={handleQuickLookup}
              onInspect3D={handleInspect3D}
              onSaveReading={handleSaveReading}
              onAiComplete={handleAiComplete}
              onBackToPicker={() => handleSwitchView("picker")}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky Selection Tray Pill above AppShell bottom navigation */}
      <AnimatePresence>
        {activeView === "picker" && selectedCards.length > 0 && (
          <motion.div
            key="assist-sticky-tray"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            className="pointer-events-none fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-3"
          >
            <div className="uranai-glass-strong gold-shimmer-border pointer-events-auto flex w-full max-w-xl items-center justify-between gap-2.5 rounded-2xl px-3.5 py-2.5 shadow-[0_14px_38px_rgba(0,0,0,0.42)]">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-[10px] font-bold text-[var(--accent-contrast)]">
                    {selectedCards.length}
                  </span>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    已选 {selectedCards.length} 张实体牌
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-[var(--text-secondary)]">
                  {stickyTrayPreviewText}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleSwitchView("reading")}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--border-accent)] bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--accent-contrast)] shadow-[0_8px_22px_var(--cloth-glow)] transition hover:brightness-110 active:scale-95 sm:px-4"
              >
                <span>查看速查 & AI 解牌</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Lookup Modal */}
      <AssistQuickLookupModal
        target={quickLookupTarget}
        deck={deck}
        soundEnabled={prefs.soundEnabled}
        onClose={() => setQuickLookupTarget(null)}
        onAddCard={handleAddCard}
        onToggleSelectedReversed={handleToggleCardReversed}
        onRemoveSelected={handleRemoveCard}
        onInspect3D={handleInspect3D}
      />

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
    </div>
  );
}
