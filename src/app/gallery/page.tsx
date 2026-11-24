"use client";

import React, { useMemo, useState } from "react";
import { Search, Sparkles, Layers, Eye, Check } from "lucide-react";
import { useUranai } from "@/context/UranaiProvider";
import { TAROT_CARDS } from "@/data/tarot-cards";
import {
  DECKS,
  MUCHA_AVAILABLE_SLUGS,
  getCardImagePath,
  getDeckBackImagePath,
} from "@/data/decks";
import { soundEngine } from "@/lib/sound";
import { CardInspectorModal } from "@/components/tarot/CardInspectorModal";
import type { SuitType, TarotCard } from "@/types/tarot";

type SuitFilter = "all" | SuitType;

const SUIT_FILTERS: Array<{ id: SuitFilter; label: string; count: number }> = [
  { id: "all", label: "全部", count: 78 },
  { id: "major", label: "大阿卡纳", count: 22 },
  { id: "wands", label: "权杖", count: 14 },
  { id: "cups", label: "圣杯", count: 14 },
  { id: "swords", label: "宝剑", count: 14 },
  { id: "pentacles", label: "星币", count: 14 },
];

const SUIT_BADGE_MAP: Record<SuitType, { label: string; symbol: string }> = {
  major: { label: "大阿卡纳", symbol: "✦" },
  wands: { label: "权杖", symbol: "🜂" },
  cups: { label: "圣杯", symbol: "🜄" },
  swords: { label: "宝剑", symbol: "🜁" },
  pentacles: { label: "星币", symbol: "🜃" },
};

export default function GalleryPage() {
  const { deck, theme, prefs, setDeckId } = useUranai();

  const [suitFilter, setSuitFilter] = useState<SuitFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyMuchaPublished, setOnlyMuchaPublished] = useState(false);
  const [selectedCard, setSelectedCard] = useState<TarotCard | null>(null);
  const [showBackModal, setShowBackModal] = useState(false);

  const deckBackImage = getDeckBackImagePath(deck.id);

  const filteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return TAROT_CARDS.filter((card) => {
      if (suitFilter !== "all" && card.suit !== suitFilter) return false;
      if (
        deck.id === "mucha-hamster" &&
        onlyMuchaPublished &&
        !MUCHA_AVAILABLE_SLUGS.has(card.slug)
      ) {
        return false;
      }
      if (!q) return true;

      return (
        card.nameZh.toLowerCase().includes(q) ||
        card.nameEn.toLowerCase().includes(q) ||
        card.element.toLowerCase().includes(q) ||
        card.astrology.toLowerCase().includes(q) ||
        card.keywordsUpright.some((kw) => kw.toLowerCase().includes(q)) ||
        card.keywordsReversed.some((kw) => kw.toLowerCase().includes(q))
      );
    });
  }, [deck.id, onlyMuchaPublished, searchQuery, suitFilter]);

  return (
    <div className="space-y-5">
      {/* Gallery Showcase Header */}
      <header className="space-y-1.5">
        <p className="font-display text-xs tracking-[0.26em] text-[var(--accent)] uppercase">
          Arcana Gallery
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-wide text-[var(--text-primary)] sm:text-3xl">
          塔罗卡面鉴赏馆
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          珍藏全套 78 张大、小阿卡纳象征图谱，点击任意牌面进入 3D 追光与正逆位全解。
        </p>
      </header>

      {/* Prominent Deck Switcher Tabs */}
      <section className="uranai-glass gold-shimmer-border rounded-3xl p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {DECKS.map((item) => {
            const active = item.id === deck.id;
            const isMucha = item.id === "mucha-hamster";
            const tabLabel = isMucha
              ? `穆夏仓鼠塔罗 · ${MUCHA_AVAILABLE_SLUGS.size}/78 高清原画 + 专属牌背`
              : "经典韦特塔罗 · 78/78";

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  soundEngine.playCardFlip(prefs.soundEnabled);
                  setDeckId(item.id);
                  if (!isMucha) setOnlyMuchaPublished(false);
                }}
                className={`flex items-start justify-between gap-3 rounded-2xl border p-3.5 text-left transition active:scale-[0.99] ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_0_24px_var(--cloth-glow)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 hover:border-[var(--border-accent)]"
                }`}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                    <span className="font-display text-sm font-semibold text-[var(--text-primary)]">
                      {tabLabel}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                    {item.subtitle}
                  </p>
                </div>
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]"
                      : "border-[var(--border-subtle)]"
                  }`}
                >
                  {active && <Check className="h-3 w-3" />}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Deck Artistry Description & Exclusive Back Preview */}
        <div className="mt-3.5 flex flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/65 p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-sm font-semibold text-[var(--text-primary)]">
                {deck.nameZh}
              </span>
              <span className="rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent-strong)]">
                {deck.badge}
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                {deck.nameEn}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              {deck.description}
            </p>
          </div>

          {deck.id === "mucha-hamster" && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setOnlyMuchaPublished((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  onlyMuchaPublished
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]"
                    : "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {onlyMuchaPublished
                  ? "显示全部 78 张"
                  : `仅看已实装原画 (${MUCHA_AVAILABLE_SLUGS.size})`}
              </button>
              {deckBackImage && (
                <button
                  type="button"
                  onClick={() => setShowBackModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/80 px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]"
                >
                  <Eye className="h-3.5 w-3.5 text-[var(--accent)]" />
                  鉴赏专属牌背
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Search & Horizontal Suit Filter Pills */}
      <section className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索牌名（如 愚者 / The Moon）、元素或正逆位关键词…"
            className="w-full rounded-full border border-[var(--border-subtle)] bg-[var(--bg-glass)] py-2.5 pr-4 pl-11 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] backdrop-blur-md focus:border-[var(--accent)] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {SUIT_FILTERS.map((item) => {
            const active = suitFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  soundEngine.playHoverTick(prefs.soundEnabled);
                  setSuitFilter(item.id);
                }}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition active:scale-95 ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[0_4px_16px_var(--cloth-glow)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-glass)] text-[var(--text-secondary)] hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]"
                }`}
              >
                {item.label}
                <span className="ml-1 opacity-75">{item.count}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Smooth 60fps Tactile Card Gallery Grid */}
      {filteredCards.length === 0 ? (
        <div className="uranai-glass rounded-3xl px-6 py-12 text-center">
          <p className="font-display text-base font-semibold text-[var(--text-primary)]">
            未找到符合条件的塔罗牌
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            请尝试清空关键词或切换其他花色分类。
          </p>
        </div>
      ) : (
        <section className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {filteredCards.map((card) => {
            const imagePath = getCardImagePath(deck.id, card.slug);
            const isMuchaPublished =
              deck.id === "mucha-hamster" && MUCHA_AVAILABLE_SLUGS.has(card.slug);
            const suitInfo = SUIT_BADGE_MAP[card.suit];

            return (
              <button
                key={card.id}
                type="button"
                onClick={() => {
                  soundEngine.playHoverTick(prefs.soundEnabled);
                  setSelectedCard(card);
                }}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-glass)] p-2 text-left backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:border-[var(--border-accent)] hover:shadow-[0_14px_34px_rgba(0,0,0,0.35)] active:scale-[0.98]"
              >
                {/* Fluid 7:12 Gilded Card Frame */}
                <div className="relative aspect-[7/12] w-full overflow-hidden rounded-xl border border-[var(--border-accent)] bg-[#0f0d16] shadow-inner">
                  {imagePath ? (
                    <img
                      src={imagePath}
                      alt={`${card.nameZh} (${card.nameEn})`}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    /* Art-Nouveau gilded crest fallback for unreleased Mucha Hamster cards */
                    <div className="relative flex h-full w-full flex-col items-center justify-between bg-gradient-to-b from-[#261d14] via-[#17120e] to-[#0f0c0a] p-3 text-center">
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-1.5 rounded-lg border border-[#d4af37]/35"
                      />
                      <span className="font-display text-[10px] tracking-[0.22em] text-[#e7ca7b]/85">
                        {card.romanNumeral ?? String(card.number)}
                      </span>
                      <div className="flex flex-col items-center gap-1.5 px-1">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d4af37]/45 bg-[#d4af37]/10 text-base text-[#f0d27a]">
                          {suitInfo.symbol}
                        </span>
                        <span className="font-display text-sm font-semibold tracking-wider text-[#f7ebd2]">
                          {card.nameZh}
                        </span>
                        <span className="line-clamp-1 text-[9px] tracking-[0.14em] text-[#d4af37]/75 uppercase">
                          {card.nameEn}
                        </span>
                      </div>
                      <span className="rounded-full border border-[#d4af37]/30 bg-[#d4af37]/10 px-2 py-0.5 text-[9px] text-[#e7ca7b]/85">
                        新艺术绘稿企划中
                      </span>
                    </div>
                  )}

                  {/* Subtle diagonal specular sheen on hover */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/15 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  />

                  {/* Published Mucha Artwork Badge */}
                  {isMuchaPublished && (
                    <span className="absolute top-2 right-2 inline-flex items-center gap-0.5 rounded-full border border-[#f0d27a]/65 bg-black/65 px-2 py-0.5 text-[9px] font-medium text-[#f5df94] backdrop-blur-sm">
                      ✦ 高清原画
                    </span>
                  )}
                </div>

                {/* Card Caption */}
                <div className="mt-2.5 flex items-baseline justify-between gap-1 px-1 pb-0.5">
                  <div className="min-w-0">
                    <div className="font-display truncate text-sm font-semibold text-[var(--text-primary)]">
                      {card.nameZh}
                    </div>
                    <div className="truncate text-[10px] tracking-wide text-[var(--text-muted)]">
                      {card.nameEn}
                    </div>
                  </div>
                  <span className="font-display shrink-0 text-[11px] font-medium text-[var(--accent)]">
                    {card.romanNumeral ?? String(card.number)}
                  </span>
                </div>
              </button>
            );
          })}
        </section>
      )}

      {/* Full 3D Tilt Card Inspector Modal */}
      <CardInspectorModal
        card={selectedCard}
        reversed={false}
        deckId={deck.id}
        themeId={theme.id}
        gyroEnabled={prefs.gyroEnabled}
        soundEnabled={prefs.soundEnabled}
        onDeckChange={setDeckId}
        onClose={() => setSelectedCard(null)}
      />

      {/* Exclusive Mucha Hamster Back Preview Lightbox */}
      {showBackModal && deckBackImage && (
        <div
          onClick={() => setShowBackModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="uranai-glass-strong flex max-w-xs flex-col items-center rounded-3xl p-5 text-center"
          >
            <div className="aspect-[7/12] w-56 overflow-hidden rounded-2xl border border-[var(--accent)] shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
              <img
                src={deckBackImage}
                alt="穆夏仓鼠塔罗专属牌背"
                className="h-full w-full object-cover"
              />
            </div>
            <h3 className="font-display mt-4 text-base font-semibold text-[var(--text-primary)]">
              穆夏仓鼠塔罗 · 专属烫金牌背
            </h3>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              新艺术对称花环与双月星盘纹饰，在洗牌与抽牌仪式中全程呈现。
            </p>
            <button
              type="button"
              onClick={() => setShowBackModal(false)}
              className="mt-4 rounded-full bg-[var(--accent)] px-5 py-1.5 text-xs font-semibold text-[var(--accent-contrast)]"
            >
              关闭鉴赏
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
