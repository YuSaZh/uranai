"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sparkles,
  Compass,
  BookOpen,
  ArrowRight,
  RotateCcw,
  Quote,
  Eye,
  Flame,
  Star,
  Tablet,
  ScanSearch,
} from "lucide-react";
import { useUranai } from "@/context/UranaiProvider";
import { TAROT_CARDS, getCardById } from "@/data/tarot-cards";
import { getLocalDateKey } from "@/lib/storage";
import { soundEngine } from "@/lib/sound";
import { TarotCard3D } from "@/components/tarot/TarotCard3D";
import { CardInspectorModal } from "@/components/tarot/CardInspectorModal";
import { AiInterpretationPanel } from "@/components/reading/AiInterpretationPanel";
import type { ReadingRecord, TarotCard } from "@/types/tarot";

interface MoonPhaseInfo {
  nameZh: string;
  nameEn: string;
  symbol: string;
  illumination: number;
  poeticNote: string;
}

function getCurrentMoonPhase(date: Date = new Date()): MoonPhaseInfo {
  // Reference astronomical new moon: 2000-01-06 18:14 UTC
  const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
  const SYNODIC_MONTH_DAYS = 29.53058867;
  const elapsedDays = (date.getTime() - KNOWN_NEW_MOON_MS) / 86_400_000;
  const cyclePos =
    (((elapsedDays % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS) %
      SYNODIC_MONTH_DAYS) /
    SYNODIC_MONTH_DAYS;
  const illumination = Math.round(((1 - Math.cos(cyclePos * 2 * Math.PI)) / 2) * 100);

  if (cyclePos < 0.0625 || cyclePos >= 0.9375) {
    return {
      nameZh: "新月 · 朔",
      nameEn: "New Moon",
      symbol: "🌑",
      illumination,
      poeticNote: "万象归零，宜种下崭新心愿",
    };
  }
  if (cyclePos < 0.1875) {
    return {
      nameZh: "蛾眉初升",
      nameEn: "Waxing Crescent",
      symbol: "🌒",
      illumination,
      poeticNote: "微光萌芽，静听直觉第一声回响",
    };
  }
  if (cyclePos < 0.3125) {
    return {
      nameZh: "上弦之月",
      nameEn: "First Quarter",
      symbol: "🌓",
      illumination,
      poeticNote: "力量渐盈，适合厘清方向与行动",
    };
  }
  if (cyclePos < 0.4375) {
    return {
      nameZh: "盈凸辉光",
      nameEn: "Waxing Gibbous",
      symbol: "🌔",
      illumination,
      poeticNote: "能量蓄满前夕，细微调整皆有回音",
    };
  }
  if (cyclePos < 0.5625) {
    return {
      nameZh: "满月 · 望",
      nameEn: "Full Moon",
      symbol: "🌕",
      illumination,
      poeticNote: "清辉圆满，潜意识讯息尤为明晰",
    };
  }
  if (cyclePos < 0.6875) {
    return {
      nameZh: "亏凸余韵",
      nameEn: "Waning Gibbous",
      symbol: "🌖",
      illumination,
      poeticNote: "收获与分享之时，回望近期领悟",
    };
  }
  if (cyclePos < 0.8125) {
    return {
      nameZh: "下弦清辉",
      nameEn: "Last Quarter",
      symbol: "🌗",
      illumination,
      poeticNote: "去芜存菁，温柔放下冗余执念",
    };
  }
  return {
    nameZh: "残月静谧",
    nameEn: "Waning Crescent",
    symbol: "🌘",
    illumination,
    poeticNote: "向内休养，在静默中沉淀智慧",
  };
}

function formatChineseDate(date: Date): string {
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 · 星期${
    weekdays[date.getDay()]
  }`;
}

export default function DailyOraclePage() {
  const {
    prefs,
    theme,
    deck,
    aiConfig,
    hydrated,
    addReading,
    updateReading,
    getTodayDailyReading,
    setDeckId,
  } = useUranai();

  const [nowDate] = useState<Date>(() => new Date());
  const [redrawPending, setRedrawPending] = useState(false);
  const [inspectOpen, setInspectOpen] = useState(false);

  const moonPhase = useMemo(() => getCurrentMoonPhase(nowDate), [nowDate]);
  const formattedDate = useMemo(() => formatChineseDate(nowDate), [nowDate]);

  const savedTodayReading = hydrated ? getTodayDailyReading() : undefined;
  const activeReading: ReadingRecord | undefined = redrawPending
    ? undefined
    : savedTodayReading;

  const drawnItem = activeReading?.cards[0];
  const drawnCard: TarotCard | undefined = drawnItem
    ? getCardById(drawnItem.cardId)
    : undefined;

  const isRevealed = Boolean(activeReading && drawnItem && drawnCard);

  const handleDrawDailyCard = () => {
    const randomIndex = Math.floor(Math.random() * TAROT_CARDS.length);
    const pickedCard = TAROT_CARDS[randomIndex];
    const reversed = prefs.allowReversed ? Math.random() < 0.35 : false;
    const nowIso = new Date().toISOString();
    const dateKey = getLocalDateKey();

    soundEngine.playCardFlip(prefs.soundEnabled);
    if (
      prefs.hapticsEnabled &&
      typeof navigator !== "undefined" &&
      "vibrate" in navigator
    ) {
      navigator.vibrate([12, 30, 18]);
    }

    const newRecord: ReadingRecord = {
      id: `daily-${dateKey}-${Date.now()}`,
      mode: "daily",
      dateKey,
      category: "general",
      question: `${formattedDate} · 每日神谕`,
      spreadId: "single",
      deckId: deck.id,
      themeId: theme.id,
      cards: [
        {
          cardId: pickedCard.id,
          slotIndex: 0,
          reversed,
          revealed: true,
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setRedrawPending(false);
    addReading(newRecord);
  };

  const handleResetExperience = () => {
    soundEngine.playShuffle(prefs.soundEnabled);
    setRedrawPending(true);
  };

  const displayCard = drawnCard ?? TAROT_CARDS[0];
  const isReversed = drawnItem?.reversed ?? false;
  const activeKeywords = drawnCard
    ? isReversed
      ? drawnCard.keywordsReversed
      : drawnCard.keywordsUpright
    : [];
  const activeMeaning = drawnCard
    ? isReversed
      ? drawnCard.meaningReversed
      : drawnCard.meaningUpright
    : "";
  const activeAdvice = drawnCard
    ? isReversed
      ? drawnCard.adviceReversed
      : drawnCard.adviceUpright
    : "";

  return (
    <div className="space-y-6">
      {/* Top Celestial Status Strip */}
      <section className="flex flex-col items-center text-center">
        <div className="uranai-glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs text-[var(--text-secondary)]">
          <span aria-hidden="true" className="text-sm leading-none">
            {moonPhase.symbol}
          </span>
          <span className="font-medium text-[var(--accent-strong)]">
            {moonPhase.nameZh}
          </span>
          <span className="opacity-45">·</span>
          <span>月面辉度 {moonPhase.illumination}%</span>
        </div>

        <h1 className="font-display mt-3.5 text-2xl font-semibold tracking-[0.12em] text-[var(--text-primary)] sm:text-3xl">
          每日神谕殿堂
        </h1>
        <p className="mt-1 text-xs tracking-[0.14em] text-[var(--text-muted)]">
          {formattedDate}
        </p>
        <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[var(--text-secondary)]">
          {moonPhase.poeticNote} · 轻缓呼吸，感应属于今日的一张塔罗启示。
        </p>
      </section>

      {/* Center Daily Sanctuary Stage */}
      <section className="uranai-glass gold-shimmer-border relative overflow-hidden rounded-[2rem] px-4 py-7 sm:px-8 sm:py-9">
        {/* Sacred ambient halo behind card */}
        <div
          aria-hidden="true"
          className="animate-aura-pulse pointer-events-none absolute top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: "var(--cloth-glow)" }}
        />

        <div className="relative flex flex-col items-center">
          {/* Interactive Hero TarotCard3D */}
          <div className={isRevealed ? "" : "animate-float-slow"}>
            <TarotCard3D
              card={displayCard}
              deckId={activeReading?.deckId ?? deck.id}
              themeId={theme.id}
              flipped={isRevealed}
              reversed={isRevealed ? isReversed : false}
              size="hero"
              interactive
              tiltEnabled
              gyroEnabled={prefs.gyroEnabled}
              soundEnabled={prefs.soundEnabled}
              glowActive
              onClick={() => {
                if (!isRevealed) {
                  handleDrawDailyCard();
                } else {
                  setInspectOpen(true);
                }
              }}
            />
          </div>

          {/* Pre-draw CTA vs Revealed Oracle Details */}
          <AnimatePresence mode="wait">
            {!isRevealed ? (
              <motion.div
                key="pre-draw"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="mt-6 flex flex-col items-center text-center"
              >
                <button
                  type="button"
                  onClick={handleDrawDailyCard}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border-accent)] bg-[var(--accent)] px-7 py-3 text-sm font-semibold tracking-wider text-[var(--accent-contrast)] shadow-[0_10px_32px_var(--cloth-glow)] transition hover:brightness-110 active:scale-95"
                >
                  <Sparkles className="h-4 w-4" />
                  轻触抽取今日神谕牌
                </button>
                <p className="mt-3 text-xs text-[var(--text-muted)]">
                  当前牌组：{deck.nameZh} ·{" "}
                  {prefs.allowReversed ? "含正逆位能量" : "仅正位启示"}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={`revealed-${activeReading?.id}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.38 }}
                className="mt-5 w-full max-w-2xl space-y-5"
              >
                {/* Tap to inspect hint */}
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => setInspectOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 px-3 py-1 text-[11px] text-[var(--text-secondary)] transition hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]"
                  >
                    <Eye className="h-3.5 w-3.5 text-[var(--accent)]" />
                    轻触牌面开启 3D 追光鉴赏与多领域详释
                  </button>
                </div>

                {/* Bilingual Card Title & Orientation Badge */}
                <div className="text-center">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {drawnCard?.romanNumeral && (
                      <span className="font-display text-sm tracking-[0.2em] text-[var(--accent)]">
                        {drawnCard.romanNumeral}
                      </span>
                    )}
                    <h2 className="font-display text-2xl font-semibold tracking-wide text-[var(--text-primary)] sm:text-3xl">
                      {drawnCard?.nameZh}
                    </h2>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        isReversed
                          ? "border-rose-400/45 bg-rose-500/15 text-rose-300"
                          : "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                      }`}
                    >
                      {isReversed ? "逆位 · Reversed" : "正位 · Upright"}
                    </span>
                  </div>
                  <p className="mt-1 font-display text-xs tracking-[0.22em] text-[var(--text-muted)] uppercase">
                    {drawnCard?.nameEn}
                  </p>

                  {/* Element & Astrology + Keywords Pills */}
                  <div className="mt-3.5 flex flex-wrap items-center justify-center gap-1.5">
                    {drawnCard && (
                      <>
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/75 px-2.5 py-1 text-[11px] text-[var(--text-secondary)]">
                          <Flame className="h-3 w-3 text-[var(--accent)]" />
                          {drawnCard.element}元素
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/75 px-2.5 py-1 text-[11px] text-[var(--text-secondary)]">
                          <Star className="h-3 w-3 text-[var(--accent)]" />
                          {drawnCard.astrology}
                        </span>
                      </>
                    )}
                    {activeKeywords.map((kw) => (
                      <span
                        key={kw}
                        className="rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent-strong)]"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="gold-divider" />

                {/* Daily Guidance & Advice */}
                <div className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 p-4 sm:p-5">
                  <div>
                    <h3 className="font-display text-xs font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">
                      今日能量启示
                    </h3>
                    <p className="mt-2 text-sm leading-[1.85] text-[var(--text-primary)]/95">
                      {activeMeaning}
                    </p>
                  </div>

                  <div className="border-t border-[var(--border-subtle)] pt-3">
                    <h3 className="font-display text-xs font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">
                      行动建议
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                      {activeAdvice}
                    </p>
                  </div>
                </div>

                {/* Daily Affirmation Quote Card */}
                {drawnCard && (
                  <blockquote className="relative overflow-hidden rounded-2xl border border-[var(--border-accent)] bg-[var(--accent-soft)] px-5 py-4 text-center">
                    <Quote className="mx-auto mb-1.5 h-4 w-4 text-[var(--accent)] opacity-80" />
                    <p className="font-display text-sm font-medium leading-relaxed tracking-wide text-[var(--text-primary)] sm:text-base">
                      「{drawnCard.affirmation}」
                    </p>
                    <footer className="mt-1.5 text-[11px] tracking-[0.18em] text-[var(--accent-strong)]">
                      TODAY&apos;S AFFIRMATION · 今日咒语
                    </footer>
                  </blockquote>
                )}

                {/* AI Personalized Daily Oracle */}
                {drawnCard && activeReading && (
                  <AiInterpretationPanel
                    mode="daily"
                    question={`${formattedDate} · 每日神谕指引`}
                    category="综合运势"
                    spreadName="每日一牌神谕"
                    cards={[
                      {
                        slotLabel: "今日神谕",
                        slotDescription: "映照今日核心能量、情绪提醒与行动方向",
                        nameZh: drawnCard.nameZh,
                        nameEn: drawnCard.nameEn,
                        reversed: isReversed,
                        keywords: activeKeywords,
                        meaning: activeMeaning,
                      },
                    ]}
                    initialInterpretation={activeReading.aiInterpretation ?? ""}
                    customAi={aiConfig}
                    onInterpretationComplete={(fullText) => {
                      updateReading(activeReading.id, {
                        aiInterpretation: fullText,
                      });
                    }}
                  />
                )}

                {/* Subtle Redraw Option */}
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={handleResetExperience}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/65 px-4 py-1.5 text-xs text-[var(--text-muted)] transition hover:border-[var(--border-accent)] hover:text-[var(--text-primary)] active:scale-95"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    重新抽一张体验
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Bottom Quick Entry Cards */}
      <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <Link
          href="/table"
          onClick={() => soundEngine.playHoverTick(prefs.soundEnabled)}
          className="uranai-glass gold-shimmer-border group relative flex items-center justify-between gap-4 overflow-hidden rounded-3xl p-4 transition hover:-translate-y-0.5 hover:border-[var(--border-accent)] sm:p-5"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-10 right-6 h-28 w-40 rounded-full opacity-35 blur-2xl transition-opacity duration-500 group-hover:opacity-60"
            style={{ background: "var(--cloth-glow)" }}
          />
          <div className="relative flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-[0_0_20px_var(--cloth-glow)]">
              <Tablet className="h-5 w-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
                  虚拟占卜桌面模式
                </h2>
                <span className="rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium tracking-wide text-[var(--accent-strong)]">
                  全屏桌面沉浸
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                平放设备化身真实丝绒桌布 · 手指揉洗搓牌、丝带摊牌、自由拖拽摆阵
              </p>
            </div>
          </div>
          <ArrowRight className="relative h-4 w-4 shrink-0 text-[var(--accent)] transition-transform group-hover:translate-x-1" />
        </Link>

        <Link
          href="/assist"
          onClick={() => soundEngine.playHoverTick(prefs.soundEnabled)}
          className="uranai-glass gold-shimmer-border group relative flex items-center justify-between gap-4 overflow-hidden rounded-3xl p-4 transition hover:-translate-y-0.5 hover:border-[var(--border-accent)] sm:p-5"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-10 right-6 h-28 w-40 rounded-full opacity-35 blur-2xl transition-opacity duration-500 group-hover:opacity-60"
            style={{ background: "var(--cloth-glow)" }}
          />
          <div className="relative flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-[0_0_20px_var(--cloth-glow)]">
              <ScanSearch className="h-5 w-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
                  实体牌辅助模式
                </h2>
                <span className="rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium tracking-wide text-[var(--accent-strong)]">
                  速查 · AI 推演
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                手握实体塔罗牌占卜时，闪电速查单牌牌意，或录入多张牌阵开启 AI 综合解读
              </p>
            </div>
          </div>
          <ArrowRight className="relative h-4 w-4 shrink-0 text-[var(--accent)] transition-transform group-hover:translate-x-1" />
        </Link>

        <Link
          href="/reading"
          onClick={() => soundEngine.playHoverTick(prefs.soundEnabled)}
          className="uranai-glass group flex items-center justify-between gap-4 rounded-3xl p-4 transition hover:-translate-y-0.5 hover:border-[var(--border-accent)] sm:p-5"
        >
          <div className="flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent)]">
              <Compass className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
                开始定制问题牌阵占卜
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                六大提问领域 · 1 至 10 张经典牌阵 · 沉浸洗牌与弧形抽牌
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-[var(--accent)] transition-transform group-hover:translate-x-1" />
        </Link>

        <Link
          href="/gallery"
          onClick={() => soundEngine.playHoverTick(prefs.soundEnabled)}
          className="uranai-glass group flex items-center justify-between gap-4 rounded-3xl p-4 transition hover:-translate-y-0.5 hover:border-[var(--border-accent)] sm:p-5"
        >
          <div className="flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent)]">
              <BookOpen className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
                浏览 78 张塔罗卡面图鉴
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                经典伟特全套与穆夏仓鼠高清原画，支持 3D 倾斜追光赏析
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-[var(--accent)] transition-transform group-hover:translate-x-1" />
        </Link>
      </section>

      {/* Full 3D Card Inspector Modal */}
      <CardInspectorModal
        card={inspectOpen && drawnCard ? drawnCard : null}
        reversed={isReversed}
        deckId={activeReading?.deckId ?? deck.id}
        themeId={theme.id}
        gyroEnabled={prefs.gyroEnabled}
        soundEnabled={prefs.soundEnabled}
        onDeckChange={setDeckId}
        onClose={() => setInspectOpen(false)}
      />
    </div>
  );
}
