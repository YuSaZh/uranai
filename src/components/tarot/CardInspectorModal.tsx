"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Briefcase,
  Coins,
  Compass,
  FlipHorizontal2,
  Heart,
  Layers,
  Orbit,
  Quote,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import type { DeckId, SuitType, TarotCard, ThemeId } from "@/types/tarot";
import { getThemeById } from "@/data/themes";
import { soundEngine } from "@/lib/sound";
import { TarotCard3D } from "./TarotCard3D";

export interface CardInspectorModalProps {
  card: TarotCard | null;
  reversed?: boolean;
  deckId: DeckId;
  themeId: ThemeId;
  gyroEnabled: boolean;
  soundEnabled: boolean;
  onDeckChange?: (d: DeckId) => void;
  onClose: () => void;
}

type DomainTab = "love" | "career" | "wealth";

const SUIT_LABELS: Record<SuitType, string> = {
  major: "大阿卡纳",
  wands: "权杖 · 小阿卡纳",
  cups: "圣杯 · 小阿卡纳",
  swords: "宝剑 · 小阿卡纳",
  pentacles: "星币 · 小阿卡纳",
};

const DOMAIN_TABS: Array<{
  id: DomainTab;
  label: string;
  Icon: typeof Heart;
}> = [
  { id: "love", label: "情感关系", Icon: Heart },
  { id: "career", label: "事业学业", Icon: Briefcase },
  { id: "wealth", label: "财富机遇", Icon: Coins },
];

export function CardInspectorModal({
  card,
  reversed = false,
  deckId,
  themeId,
  gyroEnabled,
  soundEnabled,
  onDeckChange,
  onClose,
}: CardInspectorModalProps) {
  const [localFlipped, setLocalFlipped] = useState(true);
  const [localReversed, setLocalReversed] = useState(reversed);
  const [localDeckId, setLocalDeckId] = useState<DeckId>(deckId);
  const [activeTab, setActiveTab] = useState<DomainTab>("love");

  // Sync local preview controls whenever a new card or external props open
  useEffect(() => {
    if (card) {
      setLocalFlipped(true);
      setLocalReversed(reversed);
      setLocalDeckId(deckId);
      setActiveTab("love");
    }
  }, [card, reversed, deckId]);

  // Escape key & body scroll lock
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!card || typeof window === "undefined") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [card, onClose]);

  const theme = getThemeById(themeId);
  const accentColor = theme.cssVars["--accent"] ?? "#d4af37";

  const handleToggleFlip = () => {
    setLocalFlipped((prev) => !prev);
  };

  const handleToggleOrientation = () => {
    soundEngine.playHoverTick(soundEnabled);
    setLocalReversed((prev) => !prev);
  };

  const handleSwitchDeck = (nextDeck: DeckId) => {
    if (nextDeck === localDeckId) return;
    soundEngine.playHoverTick(soundEnabled);
    setLocalDeckId(nextDeck);
    onDeckChange?.(nextDeck);
  };

  const getDomainText = (targetCard: TarotCard): string => {
    if (activeTab === "love") {
      return localReversed ? targetCard.loveReversed : targetCard.loveUpright;
    }
    if (activeTab === "career") {
      return localReversed ? targetCard.careerReversed : targetCard.careerUpright;
    }
    return localReversed ? targetCard.wealthReversed : targetCard.wealthUpright;
  };

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {card ? (
        <motion.div
          key="card-inspector-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`${card.nameZh} 卡牌鉴赏与牌义解析`}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-[#04060d]/88 p-0 backdrop-blur-xl sm:items-center sm:p-5"
        >
          <motion.div
            key={`card-inspector-sheet-${card.id}`}
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden bg-[#0a0d18]/98 text-[#f3e7cb] shadow-[0_24px_80px_rgba(0,0,0,0.8)] sm:h-auto sm:max-h-[90dvh] sm:rounded-[28px] sm:border sm:border-[#d4af37]/25"
          >
            {/* Subtle ambient gold glow behind the inspector modal */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[520px] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
              style={{
                background: `radial-gradient(circle, ${accentColor} 0%, transparent 70%)`,
              }}
            />

            {/* Top Sanctuary Header Bar (safe-area aware for iOS PWA Dynamic Island) */}
            <div className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/10 bg-[#0a0d18]/90 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-md sm:px-6 sm:py-3.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#d4af37]/40 bg-[#d4af37]/12 text-[#f2d680]">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-serif text-sm font-semibold tracking-wider text-[#f7ebd2] sm:text-base">
                    {card.romanNumeral ? `${card.romanNumeral} · ` : ""}
                    {card.nameZh}
                  </p>
                  <p className="truncate text-[10px] uppercase tracking-[0.18em] text-[#cbbca0]/75">
                    {card.nameEn}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="关闭鉴赏弹窗"
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-[#d4af37]/40 bg-[#d4af37]/15 px-3.5 text-xs font-medium text-[#f7ebd2] shadow-sm transition hover:border-[#d4af37]/70 hover:bg-[#d4af37]/25 active:scale-95"
              >
                <X className="h-4 w-4" />
                <span>关闭</span>
              </button>
            </div>

            {/* Main Responsive Body: Mobile Vertical Scroll | Desktop 2-Column Split */}
            <div className="relative z-10 flex-1 overflow-y-auto overscroll-contain lg:grid lg:grid-cols-[minmax(340px,430px)_1fr] lg:overflow-hidden">
              {/* LEFT / TOP: Interactive ±22° Hero 3D Card Stage */}
              <div className="relative flex flex-col items-center justify-center border-b border-white/10 px-5 pb-5 pt-6 lg:border-b-0 lg:border-r lg:px-7 lg:py-8">
                {/* Candlelight stage halo */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25 blur-3xl"
                  style={{
                    background: `radial-gradient(circle, ${accentColor} 0%, transparent 72%)`,
                  }}
                />

                <div className="relative z-10 flex flex-col items-center">
                  <TarotCard3D
                    card={card}
                    deckId={localDeckId}
                    themeId={themeId}
                    flipped={localFlipped}
                    reversed={localReversed}
                    size="hero"
                    interactive
                    tiltEnabled
                    maxTilt={22}
                    gyroEnabled={gyroEnabled}
                    soundEnabled={soundEnabled}
                    glowActive
                    onClick={handleToggleFlip}
                  />

                  <p className="mt-3.5 text-center text-[11px] tracking-[0.14em] text-[#cbbca0]/65">
                    轻滑卡面或倾斜手机感受烫金光影 · 轻触卡牌翻转正背
                  </p>
                </div>

                {/* Tactile Stage Controls Bar */}
                <div className="relative z-10 mt-4 flex w-full max-w-[336px] flex-col gap-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleToggleFlip}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-[#d4af37]/30 bg-white/[0.04] px-3 py-2 text-xs font-medium tracking-wider text-[#f3e7cb] transition hover:border-[#d4af37]/65 hover:bg-[#d4af37]/15 active:scale-[0.98]"
                    >
                      <FlipHorizontal2 className="h-3.5 w-3.5 text-[#e6c465]" />
                      {localFlipped ? "查看牌背" : "翻回牌面"}
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleOrientation}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium tracking-wider transition active:scale-[0.98] ${
                        localReversed
                          ? "border-amber-400/50 bg-amber-500/15 text-amber-200"
                          : "border-emerald-400/40 bg-emerald-500/12 text-emerald-200"
                      }`}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {localReversed ? "逆位预览" : "正位预览"}
                    </button>
                  </div>

                  {/* Instant Deck Switcher: Rider-Waite ↔ Mucha Hamster */}
                  <div className="flex items-center rounded-xl border border-white/12 bg-black/35 p-1">
                    <button
                      type="button"
                      onClick={() => handleSwitchDeck("rider-waite")}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                        localDeckId === "rider-waite"
                          ? "bg-[#d4af37]/22 text-[#f8e3a1] shadow-[inset_0_0_0_1px_rgba(212,175,55,0.45)]"
                          : "text-[#cbbca0]/70 hover:text-[#f3e7cb]"
                      }`}
                    >
                      <Layers className="h-3.5 w-3.5" />
                      经典伟特
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSwitchDeck("mucha-hamster")}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                        localDeckId === "mucha-hamster"
                          ? "bg-[#d4af37]/22 text-[#f8e3a1] shadow-[inset_0_0_0_1px_rgba(212,175,55,0.45)]"
                          : "text-[#cbbca0]/70 hover:text-[#f3e7cb]"
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      穆夏仓鼠
                    </button>
                  </div>
                </div>
              </div>

              {/* RIGHT / LOWER: Scrollable Deep Tarot Encyclopedia */}
              <div className="space-y-5 px-5 py-6 sm:px-7 lg:overflow-y-auto lg:py-7">
                {/* Title & Arcana Identity */}
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[#d4af37]/35 bg-[#d4af37]/12 px-2.5 py-0.5 text-[11px] font-medium tracking-wider text-[#f3d98a]">
                      {SUIT_LABELS[card.suit]}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wider ${
                        localReversed
                          ? "border-amber-400/45 bg-amber-500/15 text-amber-200"
                          : "border-emerald-400/35 bg-emerald-500/12 text-emerald-200"
                      }`}
                    >
                      当前解读：{localReversed ? "逆位 Reversed" : "正位 Upright"}
                    </span>
                  </div>

                  <h2 className="mt-3 font-serif text-2xl font-bold tracking-wider text-[#fbf2dc] sm:text-3xl">
                    {card.romanNumeral ? (
                      <span className="mr-2 font-normal text-[#d4af37]/85">
                        {card.romanNumeral}
                      </span>
                    ) : null}
                    {card.nameZh}
                  </h2>
                  <p className="mt-0.5 text-xs uppercase tracking-[0.22em] text-[#cbbca0]/75">
                    {card.nameEn}
                  </p>

                  {/* Element & Astrology Badges */}
                  <div className="mt-3.5 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1 text-xs text-[#e8dcc2]">
                      <Sparkles className="h-3.5 w-3.5 text-[#d4af37]" />
                      元素：{card.element}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1 text-xs text-[#e8dcc2]">
                      <Orbit className="h-3.5 w-3.5 text-[#d4af37]" />
                      占星：{card.astrology}
                    </span>
                  </div>
                </div>

                {/* Keywords */}
                <div>
                  <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-[#d4af37]/80">
                    核心关键词
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {(localReversed ? card.keywordsReversed : card.keywordsUpright).map(
                      (kw) => (
                        <span
                          key={kw}
                          className="rounded-full border border-[#d4af37]/28 bg-[#d4af37]/10 px-3 py-1 text-xs font-medium tracking-wide text-[#f6e4b3]"
                        >
                          {kw}
                        </span>
                      )
                    )}
                  </div>
                </div>

                {/* General Meaning */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <h3 className="mb-1.5 text-xs font-semibold tracking-[0.16em] text-[#f2d680]">
                    核心牌义解析
                  </h3>
                  <p className="text-sm leading-7 text-[#efe4cc]/92">
                    {localReversed ? card.meaningReversed : card.meaningUpright}
                  </p>
                </div>

                {/* Love / Career / Wealth Domain Tabs */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-3 flex gap-1.5 rounded-xl bg-black/35 p-1">
                    {DOMAIN_TABS.map(({ id, label, Icon }) => {
                      const active = activeTab === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            soundEngine.playHoverTick(soundEnabled);
                            setActiveTab(id);
                          }}
                          className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition ${
                            active
                              ? "text-[#fbf0cf]"
                              : "text-[#cbbca0]/70 hover:text-[#f3e7cb]"
                          }`}
                        >
                          {active ? (
                            <motion.span
                              layoutId="inspector-domain-tab"
                              transition={{ type: "spring", stiffness: 380, damping: 32 }}
                              className="absolute inset-0 rounded-lg border border-[#d4af37]/45 bg-[#d4af37]/20"
                            />
                          ) : null}
                          <Icon className="relative z-10 h-3.5 w-3.5" />
                          <span className="relative z-10">{label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <motion.p
                    key={`${activeTab}-${localReversed ? "rev" : "up"}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-sm leading-7 text-[#efe4cc]/90"
                  >
                    {getDomainText(card)}
                  </motion.p>
                </div>

                {/* Actionable Advice */}
                <div className="rounded-2xl border border-[#d4af37]/25 bg-gradient-to-br from-[#d4af37]/[0.1] to-transparent p-4">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-[0.16em] text-[#f3d98a]">
                    <Compass className="h-3.5 w-3.5" />
                    当下行动指引
                  </div>
                  <p className="text-sm leading-7 text-[#f5ead2]/92">
                    {localReversed ? card.adviceReversed : card.adviceUpright}
                  </p>
                </div>

                {/* Poetic Affirmation */}
                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-center">
                  <Quote className="mx-auto mb-1.5 h-4 w-4 text-[#d4af37]/60" />
                  <p className="font-serif text-sm italic leading-7 tracking-wide text-[#f6e6be]">
                    “{card.affirmation}”
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-[#cbbca0]/55">
                    Daily Oracle Affirmation
                  </p>
                </div>

                {/* Mobile Safe-Area Bottom Spacer */}
                <div className="h-[max(1.5rem,env(safe-area-inset-bottom))] sm:hidden" />
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
