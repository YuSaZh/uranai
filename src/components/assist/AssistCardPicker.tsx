"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Eye,
  Plus,
  RotateCcw,
  RotateCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { DeckDefinition, SuitType, TarotCard } from "@/types/tarot";
import { TAROT_CARDS } from "@/data/tarot-cards";
import { getCardImagePath, getCardThumbPath } from "@/data/decks";
import { soundEngine } from "@/lib/sound";
import type {
  AssistRankFilter,
  AssistSelectedCard,
  AssistSuitFilter,
} from "./types";

export interface AssistCardPickerProps {
  deck: DeckDefinition;
  selectedCards: AssistSelectedCard[];
  maxCards?: number;
  soundEnabled: boolean;
  onAddCard: (cardId: string, reversed: boolean) => void;
  onToggleCardReversed: (uid: string) => void;
  onRemoveCard: (uid: string) => void;
  onQuickLookup: (
    card: TarotCard,
    reversed: boolean,
    selectedUid?: string
  ) => void;
}

type MajorRangeId = "0-7" | "8-14" | "15-21";

interface CardSearchIndex {
  card: TarotCard;
  nameZhLower: string;
  nameEnLower: string;
  nameEnCore: string;
  romanLower: string;
  elementLower: string;
  exactTokens: Set<string>;
  prefixTargets: string[];
  searchableCorpus: string;
}

const SUIT_FILTER_ITEMS: Array<{
  id: AssistSuitFilter;
  label: string;
  symbol?: string;
}> = [
  { id: "all", label: "全部" },
  { id: "major", label: "大阿卡纳", symbol: "✦" },
  { id: "wands", label: "权杖(火)", symbol: "🜂" },
  { id: "cups", label: "圣杯(水)", symbol: "🜄" },
  { id: "swords", label: "宝剑(风)", symbol: "🜁" },
  { id: "pentacles", label: "星币(土)", symbol: "🜃" },
];

const SUIT_META: Record<
  SuitType,
  { shortZh: string; symbol: string; elementZh: string }
> = {
  major: { shortZh: "大牌", symbol: "✦", elementZh: "大阿卡纳" },
  wands: { shortZh: "权杖", symbol: "🜂", elementZh: "火" },
  cups: { shortZh: "圣杯", symbol: "🜄", elementZh: "水" },
  swords: { shortZh: "宝剑", symbol: "🜁", elementZh: "风" },
  pentacles: { shortZh: "星币", symbol: "🜃", elementZh: "土" },
};

const MINOR_RANK_CHIPS: Array<{
  number: number;
  shortLabel: string;
  fullLabel: string;
  isCourt: boolean;
}> = [
  { number: 1, shortLabel: "A", fullLabel: "王牌", isCourt: false },
  { number: 2, shortLabel: "2", fullLabel: "二", isCourt: false },
  { number: 3, shortLabel: "3", fullLabel: "三", isCourt: false },
  { number: 4, shortLabel: "4", fullLabel: "四", isCourt: false },
  { number: 5, shortLabel: "5", fullLabel: "五", isCourt: false },
  { number: 6, shortLabel: "6", fullLabel: "六", isCourt: false },
  { number: 7, shortLabel: "7", fullLabel: "七", isCourt: false },
  { number: 8, shortLabel: "8", fullLabel: "八", isCourt: false },
  { number: 9, shortLabel: "9", fullLabel: "九", isCourt: false },
  { number: 10, shortLabel: "10", fullLabel: "十", isCourt: false },
  { number: 11, shortLabel: "侍", fullLabel: "侍从", isCourt: true },
  { number: 12, shortLabel: "骑", fullLabel: "骑士", isCourt: true },
  { number: 13, shortLabel: "后", fullLabel: "王后", isCourt: true },
  { number: 14, shortLabel: "王", fullLabel: "国王", isCourt: true },
];

const MAJOR_RANGE_CHIPS: Array<{
  id: MajorRangeId;
  label: string;
  min: number;
  max: number;
}> = [
  { id: "0-7", label: "0–VII 初心", min: 0, max: 7 },
  { id: "8-14", label: "VIII–XIV 历练", min: 8, max: 14 },
  { id: "15-21", label: "XV–XXI 觉醒", min: 15, max: 21 },
];

const MINOR_RANK_FILTERS: Array<{ id: AssistRankFilter; label: string }> = [
  { id: "all", label: "全部" },
  { id: "pips", label: "数字牌 A–10" },
  { id: "court", label: "宫廷牌" },
];

const MAJOR_NUMBER_ALIASES: Record<number, string[]> = {
  0: ["0", "零"],
  1: ["1", "一"],
  2: ["2", "二"],
  3: ["3", "三"],
  4: ["4", "四"],
  5: ["5", "五"],
  6: ["6", "六"],
  7: ["7", "七"],
  8: ["8", "八"],
  9: ["9", "九"],
  10: ["10", "十"],
  11: ["11", "十一"],
  12: ["12", "十二"],
  13: ["13", "十三"],
  14: ["14", "十四"],
  15: ["15", "十五"],
  16: ["16", "十六"],
  17: ["17", "十七"],
  18: ["18", "十八"],
  19: ["19", "十九"],
  20: ["20", "二十"],
  21: ["21", "二十一"],
};

const MINOR_RANK_ALIASES: Record<number, string[]> = {
  1: ["1", "一", "a", "ace", "王牌", "首牌"],
  2: ["2", "二", "two"],
  3: ["3", "三", "three"],
  4: ["4", "四", "four"],
  5: ["5", "五", "five"],
  6: ["6", "六", "six"],
  7: ["7", "七", "seven"],
  8: ["8", "八", "eight"],
  9: ["9", "九", "nine"],
  10: ["10", "十", "ten"],
  11: ["11", "侍从", "侍", "侍卫", "随从", "page", "p"],
  12: ["12", "骑士", "骑", "knight", "kn"],
  13: ["13", "王后", "皇后", "后", "queen", "q"],
  14: ["14", "国王", "王", "king", "k"],
};

const SUIT_ZH_ALIASES: Record<SuitType, string[]> = {
  major: ["大阿卡纳", "大牌", "major"],
  wands: ["权杖", "杖", "wands", "wand"],
  cups: ["圣杯", "杯", "cups", "cup"],
  swords: ["宝剑", "剑", "swords", "sword"],
  pentacles: ["星币", "钱币", "金币", "币", "pentacles", "pentacle", "coins", "coin"],
};

const MAJOR_ZH_ALIASES: Record<string, string[]> = {
  "00-the-fool": ["愚人", "傻瓜"],
  "01-the-magician": ["魔术"],
  "02-the-high-priestess": ["女教皇", "女祭祀"],
  "03-the-empress": ["女皇"],
  "05-the-hierophant": ["教宗"],
  "09-the-hermit": ["隐士"],
  "10-wheel-of-fortune": ["命运", "轮盘"],
  "12-the-hanged-man": ["吊人", "悬吊者"],
  "20-judgement": ["judgment"],
};

const REVERSED_BADGE_STYLE: React.CSSProperties = {
  borderColor: "color-mix(in srgb, #f59e0b 48%, transparent)",
  backgroundColor: "color-mix(in srgb, #f59e0b 17%, var(--bg-surface))",
  color: "color-mix(in srgb, #f59e0b 65%, var(--text-primary))",
};

const REVERSED_BTN_STYLE: React.CSSProperties = {
  borderColor: "color-mix(in srgb, #f59e0b 44%, transparent)",
  backgroundColor: "color-mix(in srgb, #f59e0b 12%, transparent)",
  color: "color-mix(in srgb, #f59e0b 62%, var(--text-primary))",
};

const REMOVE_BTN_STYLE: React.CSSProperties = {
  borderColor: "color-mix(in srgb, #f43f5e 38%, transparent)",
  backgroundColor: "color-mix(in srgb, #f43f5e 10%, transparent)",
  color: "color-mix(in srgb, #f43f5e 64%, var(--text-primary))",
};

function isMinorSuit(suit: AssistSuitFilter): suit is Exclude<SuitType, "major"> {
  return (
    suit === "wands" ||
    suit === "cups" ||
    suit === "swords" ||
    suit === "pentacles"
  );
}

function getMinorShortCode(number: number): string {
  const item = MINOR_RANK_CHIPS.find((chip) => chip.number === number);
  return item ? item.shortLabel : String(number);
}

function buildSearchIndex(cards: TarotCard[]): CardSearchIndex[] {
  return cards.map((card) => {
    const nameZhLower = card.nameZh.toLowerCase();
    const nameEnLower = card.nameEn.toLowerCase();
    const nameEnCore = nameEnLower.replace(/^the\s+/, "");
    const romanLower = card.romanNumeral?.toLowerCase() ?? "";
    const elementLower = card.element.toLowerCase();

    const exactTokens = new Set<string>([
      nameZhLower,
      nameEnLower,
      nameEnCore,
      String(card.number),
      elementLower,
    ]);

    if (romanLower) {
      exactTokens.add(romanLower);
    }

    const prefixTargets: string[] = [nameZhLower, nameEnLower, nameEnCore];
    if (romanLower) prefixTargets.push(romanLower);

    const extraAliases: string[] = [];

    if (card.arcana === "major") {
      const majorAliases = MAJOR_ZH_ALIASES[card.id] ?? [];
      for (const alias of majorAliases) {
        const lower = alias.toLowerCase();
        exactTokens.add(lower);
        prefixTargets.push(lower);
        extraAliases.push(lower);
      }
      const numAliases = MAJOR_NUMBER_ALIASES[card.number] ?? [];
      for (const n of numAliases) {
        exactTokens.add(n);
      }
    } else {
      const suitAliases = SUIT_ZH_ALIASES[card.suit];
      const rankAliases = MINOR_RANK_ALIASES[card.number] ?? [
        String(card.number),
      ];

      for (const r of rankAliases) {
        exactTokens.add(r);
      }
      for (const s of suitAliases) {
        extraAliases.push(s);
      }

      // Shorthand combinations like 权杖3, 杖3, 权杖a, 圣杯q, 杯后, 宝剑7, 钱币王牌
      const compactSuitPrefixes = suitAliases.filter((s) => s.length <= 2);
      const compactRanks = rankAliases.filter((r) => r.length <= 2);
      for (const s of compactSuitPrefixes) {
        for (const r of compactRanks) {
          const combo = `${s}${r}`;
          exactTokens.add(combo);
          prefixTargets.push(combo);
          extraAliases.push(combo);
        }
      }
      // English compact combinations like "3 wands", "7 swords", "queen cups"
      const primaryEnSuit =
        card.suit === "pentacles" ? ["pentacles", "coins"] : [card.suit];
      for (const enSuit of primaryEnSuit) {
        for (const r of rankAliases) {
          exactTokens.add(`${r} ${enSuit}`);
          exactTokens.add(`${enSuit} ${r}`);
          exactTokens.add(`${r} of ${enSuit}`);
        }
      }
    }

    const searchableCorpus = [
      nameZhLower,
      nameEnLower,
      romanLower,
      elementLower,
      card.astrology.toLowerCase(),
      ...SUIT_ZH_ALIASES[card.suit],
      ...extraAliases,
      ...(card.arcana === "minor" ? MINOR_RANK_ALIASES[card.number] ?? [] : []),
      ...card.keywordsUpright.map((kw) => kw.toLowerCase()),
      ...card.keywordsReversed.map((kw) => kw.toLowerCase()),
    ]
      .filter(Boolean)
      .join(" ");

    return {
      card,
      nameZhLower,
      nameEnLower,
      nameEnCore,
      romanLower,
      elementLower,
      exactTokens,
      prefixTargets,
      searchableCorpus,
    };
  });
}

const CARD_SEARCH_INDEX: CardSearchIndex[] = buildSearchIndex(TAROT_CARDS);
const CARD_BY_ID = new Map<string, TarotCard>(
  TAROT_CARDS.map((card) => [card.id, card])
);

function scoreCardQuery(entry: CardSearchIndex, rawQuery: string): number {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return 1;

  // Compact whitespace version for queries like "权杖 3" -> "权杖3"
  const compactQ = q.replace(/\s+/g, "");

  // Pure numeric query (0-21, also accepting leading zeros like "00" / "07")
  if (/^\d+$/.test(compactQ)) {
    const normalizedNum = String(Number(compactQ));
    return String(entry.card.number) === normalizedNum ? 100 : 0;
  }

  // Single ASCII letter (e.g. "a", "q", "k", "p", "i", "v", "x"):
  // strictly match exact shorthand tokens so "a" returns the 4 Aces, not every English word containing "a".
  if (/^[a-z]$/.test(compactQ)) {
    return entry.exactTokens.has(compactQ) ? 100 : 0;
  }

  // Pure element single-character query: match card element cleanly without astrology false positives (e.g. 水星)
  if (
    compactQ === "火" ||
    compactQ === "水" ||
    compactQ === "风" ||
    compactQ === "土"
  ) {
    return entry.elementLower === compactQ ? 100 : 0;
  }

  // Exact token match (Chinese name, English name, roman numeral, shorthand like 宝剑7 / 圣杯Q / 愚人)
  if (entry.exactTokens.has(q) || entry.exactTokens.has(compactQ)) {
    return 100;
  }

  // Pure roman numeral sequence (2-4 chars like vi, xiii, xxi): prioritize roman matches cleanly
  if (/^[ivx]{2,4}$/.test(compactQ)) {
    if (entry.romanLower === compactQ) return 100;
    if (entry.romanLower && entry.romanLower.startsWith(compactQ)) return 70;
  }

  // Prefix match on primary names / aliases
  if (
    entry.prefixTargets.some(
      (target) => target.startsWith(q) || target.startsWith(compactQ)
    )
  ) {
    return 82;
  }

  // Multi-token search (e.g. "火 王后", "queen cups", "剑 7", "星币 侍从")
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    const allMatch = tokens.every((token) => {
      if (/^\d+$/.test(token)) {
        return String(entry.card.number) === token;
      }
      if (/^[a-z]$/.test(token)) {
        return entry.exactTokens.has(token);
      }
      return (
        entry.exactTokens.has(token) || entry.searchableCorpus.includes(token)
      );
    });
    if (allMatch) return 68;
  }

  // Direct substring match on names / aliases
  if (
    entry.nameZhLower.includes(compactQ) ||
    entry.nameEnLower.includes(q)
  ) {
    return 60;
  }

  // Element / astrology / upright & reversed keywords / suit alias match
  if (entry.searchableCorpus.includes(q)) {
    return 36;
  }

  return 0;
}

interface CardArtworkThumbProps {
  card: TarotCard;
  deck: DeckDefinition;
  reversed: boolean;
}

function CardArtworkThumb({
  card,
  deck,
  reversed,
}: CardArtworkThumbProps): React.ReactElement {
  const thumbSrc = getCardThumbPath(deck.id, card.slug);
  const fullSrc = getCardImagePath(deck.id, card.slug);
  const initialStage = thumbSrc ? "thumb" : fullSrc ? "full" : "crest";

  const [stage, setStage] = useState<"thumb" | "full" | "crest">(initialStage);

  useEffect(() => {
    setStage(thumbSrc ? "thumb" : fullSrc ? "full" : "crest");
  }, [thumbSrc, fullSrc]);

  const activeSrc =
    stage === "thumb" ? thumbSrc : stage === "full" ? fullSrc : null;
  const suitInfo = SUIT_META[card.suit];

  const handleImageError = () => {
    if (stage === "thumb" && fullSrc && fullSrc !== thumbSrc) {
      setStage("full");
    } else {
      setStage("crest");
    }
  };

  return (
    <div
      className={`relative ${deck.aspectClass} w-full overflow-hidden rounded-xl border bg-[#0f0d16] shadow-inner transition-colors ${
        reversed
          ? "border-amber-500/55"
          : "border-[var(--border-accent)]"
      }`}
    >
      {activeSrc ? (
        <img
          src={activeSrc}
          alt={`${card.nameZh} (${card.nameEn})`}
          loading="lazy"
          decoding="async"
          onError={handleImageError}
          className={`h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] ${
            reversed ? "rotate-180" : "rotate-0"
          }`}
        />
      ) : (
        <div
          className={`relative flex h-full w-full flex-col items-center justify-between bg-gradient-to-b from-[#261d14] via-[#17120e] to-[#0f0c0a] p-2.5 text-center transition-transform duration-500 ease-out ${
            reversed ? "rotate-180" : "rotate-0"
          }`}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-1.5 rounded-lg border border-[#d4af37]/35"
          />
          <span className="font-display text-[10px] tracking-[0.2em] text-[#e7ca7b]/85">
            {card.romanNumeral ?? getMinorShortCode(card.number)}
          </span>
          <div className="flex flex-col items-center gap-1 px-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#d4af37]/45 bg-[#d4af37]/10 text-sm text-[#f0d27a]">
              {suitInfo.symbol}
            </span>
            <span className="font-display text-xs font-semibold tracking-wider text-[#f7ebd2]">
              {card.nameZh}
            </span>
          </div>
          <span className="text-[9px] tracking-[0.14em] text-[#d4af37]/75 uppercase line-clamp-1">
            {card.nameEn}
          </span>
        </div>
      )}

      {/* Subtle sheen + quick-lookup micro hint on hover */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/12 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
      <span className="pointer-events-none absolute right-1.5 bottom-1.5 inline-flex items-center gap-1 rounded-full bg-black/62 px-2 py-0.5 text-[10px] font-medium text-[#f5efe2] opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
        <Eye className="h-2.5 w-2.5 text-[#f0d27a]" />
        速查
      </span>
    </div>
  );
}

interface PickerCardTileProps {
  card: TarotCard;
  deck: DeckDefinition;
  selectedEntry?: AssistSelectedCard;
  selectedPosition?: number;
  isLimitReached: boolean;
  maxCards?: number;
  soundEnabled: boolean;
  onAddCard: (cardId: string, reversed: boolean) => void;
  onToggleCardReversed: (uid: string) => void;
  onRemoveCard: (uid: string) => void;
  onQuickLookup: (
    card: TarotCard,
    reversed: boolean,
    selectedUid?: string
  ) => void;
}

const PickerCardTile = React.memo(function PickerCardTile({
  card,
  deck,
  selectedEntry,
  selectedPosition,
  isLimitReached,
  maxCards,
  soundEnabled,
  onAddCard,
  onToggleCardReversed,
  onRemoveCard,
  onQuickLookup,
}: PickerCardTileProps) {
  const isSelected = Boolean(selectedEntry);
  const isReversed = selectedEntry?.reversed ?? false;
  const suitInfo = SUIT_META[card.suit];

  const microCode =
    card.arcana === "major"
      ? `${card.romanNumeral ?? card.number} · ${card.element}`
      : `${suitInfo.symbol} ${getMinorShortCode(card.number)} · ${card.element}`;

  const previewKeywords = (
    isSelected && isReversed ? card.keywordsReversed : card.keywordsUpright
  ).slice(0, 2);

  return (
    <article
      className={`uranai-glass group relative flex flex-col justify-between rounded-2xl p-2 transition duration-200 ${
        isSelected
          ? isReversed
            ? "shadow-[0_10px_28px_rgba(245,158,11,0.16)]"
            : "border-[var(--border-accent)] shadow-[0_10px_28px_var(--cloth-glow)]"
          : "hover:border-[var(--border-accent)]"
      }`}
      style={
        isSelected && isReversed
          ? { borderColor: "color-mix(in srgb, #f59e0b 52%, transparent)" }
          : undefined
      }
    >
      {/* Top micro-label + selected order/orientation badge */}
      <div className="mb-1.5 flex items-center justify-between gap-1 px-0.5">
        <span className="truncate text-[10px] font-medium tracking-wide text-[var(--text-muted)]">
          {microCode}
        </span>

        {isSelected && selectedPosition ? (
          isReversed ? (
            <span
              className="shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none"
              style={REVERSED_BADGE_STYLE}
            >
              #{selectedPosition} · 逆位
            </span>
          ) : (
            <span className="shrink-0 rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[var(--accent-strong)]">
              #{selectedPosition} · 正位
            </span>
          )
        ) : (
          <span className="shrink-0 text-[10px] text-[var(--text-muted)]/75">
            {suitInfo.shortZh}
          </span>
        )}
      </div>

      {/* Clickable card artwork & title -> opens Quick Lookup Modal */}
      <button
        type="button"
        onClick={() => {
          soundEngine.playHoverTick(soundEnabled);
          onQuickLookup(
            card,
            isSelected ? isReversed : false,
            selectedEntry?.uid
          );
        }}
        className="flex flex-1 flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-xl"
        aria-label={`速查 ${card.nameZh} 基础牌义`}
      >
        <CardArtworkThumb card={card} deck={deck} reversed={isReversed} />

        <div className="mt-2 px-0.5">
          <h3 className="font-display truncate text-[13px] font-semibold tracking-wide text-[var(--text-primary)] sm:text-sm">
            {card.nameZh}
          </h3>
          <p className="truncate text-[10px] tracking-wider text-[var(--text-muted)] uppercase">
            {card.nameEn}
          </p>

          {/* 2 core keywords */}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {previewKeywords.map((kw) => (
              <span
                key={kw}
                className="max-w-full truncate rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)]/80 px-1.5 py-0.5 text-[10px] leading-tight text-[var(--text-secondary)]"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      </button>

      {/* Bottom one-tap dual action bar */}
      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        {isSelected && selectedEntry ? (
          <>
            <button
              type="button"
              onClick={() => {
                soundEngine.playCardFlip(soundEnabled);
                onToggleCardReversed(selectedEntry.uid);
              }}
              aria-label={`将 ${card.nameZh} 翻转为${isReversed ? "正位" : "逆位"}`}
              className="inline-flex min-h-[34px] items-center justify-center gap-1 rounded-xl border border-[var(--border-accent)] bg-[var(--accent-soft)] px-1.5 py-1.5 text-[11px] font-semibold text-[var(--accent-strong)] transition hover:brightness-110 active:scale-95"
            >
              <RotateCw className="h-3 w-3 shrink-0" />
              <span>翻正/逆</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playHoverTick(soundEnabled);
                onRemoveCard(selectedEntry.uid);
              }}
              aria-label={`从牌阵移除 ${card.nameZh}`}
              style={REMOVE_BTN_STYLE}
              className="inline-flex min-h-[34px] items-center justify-center gap-1 rounded-xl border px-1.5 py-1.5 text-[11px] font-semibold transition hover:brightness-110 active:scale-95"
            >
              <Trash2 className="h-3 w-3 shrink-0" />
              <span>移除</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={isLimitReached}
              title={
                isLimitReached && maxCards
                  ? `已达当前牌阵上限 ${maxCards} 张`
                  : `以正位加入 ${card.nameZh}`
              }
              onClick={() => {
                if (isLimitReached) return;
                soundEngine.playCardDraw(soundEnabled);
                onAddCard(card.id, false);
              }}
              className={`inline-flex min-h-[34px] items-center justify-center gap-0.5 rounded-xl border px-1.5 py-1.5 text-[11px] font-semibold transition ${
                isLimitReached
                  ? "cursor-not-allowed border-[var(--border-subtle)] bg-[var(--bg-surface)]/50 text-[var(--text-muted)] opacity-50"
                  : "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)] hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)] active:scale-95"
              }`}
            >
              <Plus className="h-3 w-3 shrink-0" />
              <span>正位</span>
            </button>
            <button
              type="button"
              disabled={isLimitReached}
              title={
                isLimitReached && maxCards
                  ? `已达当前牌阵上限 ${maxCards} 张`
                  : `以逆位加入 ${card.nameZh}`
              }
              onClick={() => {
                if (isLimitReached) return;
                soundEngine.playCardDraw(soundEnabled);
                onAddCard(card.id, true);
              }}
              style={isLimitReached ? undefined : REVERSED_BTN_STYLE}
              className={`inline-flex min-h-[34px] items-center justify-center gap-0.5 rounded-xl border px-1.5 py-1.5 text-[11px] font-semibold transition ${
                isLimitReached
                  ? "cursor-not-allowed border-[var(--border-subtle)] bg-[var(--bg-surface)]/50 text-[var(--text-muted)] opacity-50"
                  : "hover:brightness-110 active:scale-95"
              }`}
            >
              <Plus className="h-3 w-3 shrink-0" />
              <span>逆位</span>
            </button>
          </>
        )}
      </div>
    </article>
  );
});

export function AssistCardPicker({
  deck,
  selectedCards,
  maxCards,
  soundEnabled,
  onAddCard,
  onToggleCardReversed,
  onRemoveCard,
  onQuickLookup,
}: AssistCardPickerProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState("");
  const [suitFilter, setSuitFilter] = useState<AssistSuitFilter>("all");
  const [rankFilter, setRankFilter] = useState<AssistRankFilter>("all");
  const [allOnlyMajor, setAllOnlyMajor] = useState(false);
  const [quickMinorNumber, setQuickMinorNumber] = useState<number | null>(null);
  const [majorRange, setMajorRange] = useState<MajorRangeId | null>(null);
  const [onlySelected, setOnlySelected] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedMap = useMemo(() => {
    const map = new Map<
      string,
      { entry: AssistSelectedCard; position: number }
    >();
    selectedCards.forEach((entry, index) => {
      if (!map.has(entry.cardId)) {
        map.set(entry.cardId, { entry, position: index + 1 });
      }
    });
    return map;
  }, [selectedCards]);

  const isLimitReached =
    typeof maxCards === "number" && selectedCards.length >= maxCards;

  // Base pool filtered by search query + onlySelected (used to compute live suit counts!)
  const searchScoredPool = useMemo(() => {
    const trimmed = searchQuery.trim();
    const matches: Array<{ card: TarotCard; score: number }> = [];

    for (const entry of CARD_SEARCH_INDEX) {
      if (onlySelected && !selectedMap.has(entry.card.id)) {
        continue;
      }
      const score = trimmed ? scoreCardQuery(entry, trimmed) : 1;
      if (score > 0) {
        matches.push({ card: entry.card, score });
      }
    }

    if (trimmed) {
      matches.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.card.index - b.card.index;
      });
    }

    return matches;
  }, [onlySelected, searchQuery, selectedMap]);

  // Live counts per suit pill
  const suitCounts = useMemo<Record<AssistSuitFilter, number>>(() => {
    const counts: Record<AssistSuitFilter, number> = {
      all: searchScoredPool.length,
      major: 0,
      wands: 0,
      cups: 0,
      swords: 0,
      pentacles: 0,
    };
    for (const { card } of searchScoredPool) {
      counts[card.suit] += 1;
    }
    return counts;
  }, [searchScoredPool]);

  // Set of minor numbers already selected in the active minor suit (for chip dot indicator)
  const selectedNumbersInSuit = useMemo(() => {
    const set = new Set<number>();
    if (!isMinorSuit(suitFilter)) return set;
    for (const entry of selectedCards) {
      const card = CARD_BY_ID.get(entry.cardId);
      if (card && card.suit === suitFilter) {
        set.add(card.number);
      }
    }
    return set;
  }, [selectedCards, suitFilter]);

  // Apply suit + level-2 rank/quick-number/major-range filters
  const filteredCards = useMemo(() => {
    return searchScoredPool
      .filter(({ card }) => {
        if (suitFilter !== "all" && card.suit !== suitFilter) {
          return false;
        }

        if (suitFilter === "all") {
          if (allOnlyMajor) return card.arcana === "major";
          if (rankFilter === "pips") {
            return card.arcana === "minor" && card.number <= 10;
          }
          if (rankFilter === "court") {
            return card.arcana === "minor" && card.number >= 11;
          }
          return true;
        }

        if (suitFilter === "major") {
          if (!majorRange) return true;
          const rangeObj = MAJOR_RANGE_CHIPS.find((r) => r.id === majorRange);
          if (!rangeObj) return true;
          return card.number >= rangeObj.min && card.number <= rangeObj.max;
        }

        // Minor suit active
        if (quickMinorNumber !== null) {
          return card.number === quickMinorNumber;
        }
        if (rankFilter === "pips") {
          return card.number <= 10;
        }
        if (rankFilter === "court") {
          return card.number >= 11;
        }
        return true;
      })
      .map(({ card }) => card);
  }, [
    allOnlyMajor,
    majorRange,
    quickMinorNumber,
    rankFilter,
    searchScoredPool,
    suitFilter,
  ]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    suitFilter !== "all" ||
    rankFilter !== "all" ||
    allOnlyMajor ||
    quickMinorNumber !== null ||
    majorRange !== null ||
    onlySelected;

  const handleSelectSuit = useCallback(
    (nextSuit: AssistSuitFilter) => {
      soundEngine.playHoverTick(soundEnabled);
      setSuitFilter(nextSuit);
      setQuickMinorNumber(null);
      setMajorRange(null);
      setAllOnlyMajor(false);
      if (nextSuit === "major") {
        setRankFilter("all");
      }
    },
    [soundEnabled]
  );

  const handleSelectMinorRank = useCallback(
    (nextRank: AssistRankFilter) => {
      soundEngine.playHoverTick(soundEnabled);
      setRankFilter(nextRank);
      if (quickMinorNumber !== null) {
        if (nextRank === "pips" && quickMinorNumber > 10) {
          setQuickMinorNumber(null);
        } else if (nextRank === "court" && quickMinorNumber <= 10) {
          setQuickMinorNumber(null);
        }
      }
    },
    [quickMinorNumber, soundEnabled]
  );

  const handleToggleQuickMinorNumber = useCallback(
    (num: number) => {
      soundEngine.playHoverTick(soundEnabled);
      setQuickMinorNumber((prev) => {
        const next = prev === num ? null : num;
        if (next !== null) {
          if (rankFilter === "pips" && next > 10) {
            setRankFilter("all");
          } else if (rankFilter === "court" && next <= 10) {
            setRankFilter("all");
          }
        }
        return next;
      });
    },
    [rankFilter, soundEnabled]
  );

  const handleToggleMajorRange = useCallback(
    (rangeId: MajorRangeId) => {
      soundEngine.playHoverTick(soundEnabled);
      setMajorRange((prev) => (prev === rangeId ? null : rangeId));
    },
    [soundEnabled]
  );

  const handleResetFilters = useCallback(() => {
    soundEngine.playHoverTick(soundEnabled);
    setSearchQuery("");
    setSuitFilter("all");
    setRankFilter("all");
    setAllOnlyMajor(false);
    setQuickMinorNumber(null);
    setMajorRange(null);
    setOnlySelected(false);
  }, [soundEnabled]);

  return (
    <section
      aria-label="实体牌极速选牌器"
      className="space-y-3"
    >
      {/* Search + Multi-Level Fast Filter Console */}
      <div className="uranai-glass rounded-3xl p-3 sm:p-4 space-y-3">
        {/* Smart Real-Time Search Bar */}
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[var(--accent)]"
          />
          <input
            ref={searchInputRef}
            type="text"
            inputMode="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && searchQuery) {
                e.preventDefault();
                setSearchQuery("");
              }
            }}
            placeholder="速搜牌名 / 罗马数字 / 数字 / 宫廷 / 元素（如 恋人、宝剑7、VI、ace、水）"
            className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/85 py-2.5 pr-10 pl-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                soundEngine.playHoverTick(soundEnabled);
                setSearchQuery("");
                searchInputRef.current?.focus();
              }}
              aria-label="清空搜索"
              className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/90 text-[var(--text-secondary)] transition hover:border-[var(--border-accent)] hover:text-[var(--text-primary)] active:scale-90"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {/* Level 1: Suit Filter Pills (with live counts) */}
        <div
          role="tablist"
          aria-label="花色筛选"
          className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar"
        >
          {SUIT_FILTER_ITEMS.map((item) => {
            const active = suitFilter === item.id;
            const count = suitCounts[item.id];
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleSelectSuit(item.id)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[0_4px_16px_var(--cloth-glow)]"
                    : "uranai-pill-solid text-[var(--text-secondary)] hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]"
                }`}
              >
                {item.symbol ? (
                  <span aria-hidden="true" className="text-[11px] leading-none">
                    {item.symbol}
                  </span>
                ) : null}
                <span>{item.label}</span>
                <span
                  className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums ${
                    active
                      ? "bg-black/15 text-current"
                      : "bg-[var(--bg-surface)]/80 text-[var(--text-muted)]"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Level 2: Context-Aware Rank + Keyboard-Free Quick Jump Strip */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/55 p-2.5 space-y-2.5">
          {isMinorSuit(suitFilter) ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {MINOR_RANK_FILTERS.map((rf) => {
                    const active =
                      rankFilter === rf.id && quickMinorNumber === null;
                    return (
                      <button
                        key={rf.id}
                        type="button"
                        onClick={() => handleSelectMinorRank(rf.id)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition active:scale-95 ${
                          active
                            ? "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                            : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/75 text-[var(--text-secondary)] hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        {rf.label}
                      </button>
                    );
                  })}
                </div>
                <span className="text-[11px] text-[var(--text-muted)]">
                  点数字直达单牌 · 再点取消
                </span>
              </div>

              {/* Keyboard-free 14-chip instant number & court jump strip */}
              <div className="grid grid-cols-7 gap-1 sm:grid-cols-[repeat(14,minmax(0,1fr))]">
                {MINOR_RANK_CHIPS.map((chip) => {
                  const active = quickMinorNumber === chip.number;
                  const alreadySelected = selectedNumbersInSuit.has(
                    chip.number
                  );
                  return (
                    <button
                      key={chip.number}
                      type="button"
                      onClick={() => handleToggleQuickMinorNumber(chip.number)}
                      aria-pressed={active}
                      title={`${SUIT_META[suitFilter].shortZh}${chip.fullLabel}`}
                      className={`relative flex h-8 items-center justify-center rounded-xl border text-xs font-semibold transition active:scale-90 ${
                        active
                          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[0_4px_14px_var(--cloth-glow)]"
                          : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/85 text-[var(--text-primary)] hover:border-[var(--border-accent)] hover:bg-[var(--accent-soft)]"
                      }`}
                    >
                      <span>{chip.shortLabel}</span>
                      {alreadySelected ? (
                        <span
                          aria-hidden="true"
                          className={`absolute top-1 right-1 h-1.5 w-1.5 rounded-full ${
                            active
                              ? "bg-[var(--accent-contrast)]"
                              : "bg-[var(--accent)]"
                          }`}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </>
          ) : suitFilter === "major" ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-0.5 inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                <Sparkles className="h-3 w-3 text-[var(--accent)]" />
                号段速筛
              </span>
              {MAJOR_RANGE_CHIPS.map((range) => {
                const active = majorRange === range.id;
                return (
                  <button
                    key={range.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleToggleMajorRange(range.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition active:scale-95 ${
                      active
                        ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[0_4px_14px_var(--cloth-glow)]"
                        : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/85 text-[var(--text-secondary)] hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {range.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="mr-0.5 inline-flex shrink-0 items-center gap-1 text-[11px] text-[var(--text-muted)]">
                <SlidersHorizontal className="h-3 w-3 text-[var(--accent)]" />
                牌阶
              </span>
              {(
                [
                  { id: "all", label: "全部" },
                  { id: "only-major", label: "仅大牌" },
                  { id: "pips", label: "数字牌 A–10" },
                  { id: "court", label: "宫廷人物牌" },
                ] as const
              ).map((item) => {
                const active =
                  item.id === "only-major"
                    ? allOnlyMajor
                    : !allOnlyMajor && rankFilter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      soundEngine.playHoverTick(soundEnabled);
                      if (item.id === "only-major") {
                        setAllOnlyMajor(true);
                        setRankFilter("all");
                      } else {
                        setAllOnlyMajor(false);
                        setRankFilter(item.id);
                      }
                    }}
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition active:scale-95 ${
                      active
                        ? "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                        : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/80 text-[var(--text-secondary)] hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Filter Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-[var(--text-secondary)]">
            <span>
              当前命中{" "}
              <strong className="font-semibold tabular-nums text-[var(--text-primary)]">
                {filteredCards.length}
              </strong>{" "}
              张
            </span>
            {isLimitReached && typeof maxCards === "number" ? (
              <span
                className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium"
                style={REVERSED_BADGE_STYLE}
              >
                已达牌阵上限 {maxCards} 张
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-pressed={onlySelected}
              onClick={() => {
                soundEngine.playHoverTick(soundEnabled);
                setOnlySelected((prev) => !prev);
              }}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition active:scale-95 ${
                onlySelected
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/80 text-[var(--text-secondary)] hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]"
              }`}
            >
              <CheckCircle2 className="h-3 w-3" />
              <span>仅看已选 ({selectedCards.length})</span>
            </button>

            <button
              type="button"
              disabled={!hasActiveFilters}
              onClick={handleResetFilters}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                hasActiveFilters
                  ? "border-[var(--border-subtle)] bg-[var(--bg-surface)]/80 text-[var(--text-secondary)] hover:border-[var(--border-accent)] hover:text-[var(--text-primary)] active:scale-95"
                  : "cursor-not-allowed border-transparent text-[var(--text-muted)] opacity-45"
              }`}
            >
              <RotateCcw className="h-3 w-3" />
              <span>重置筛选</span>
            </button>
          </div>
        </div>
      </div>

      {/* High-Density Responsive Card Grid */}
      {filteredCards.length === 0 ? (
        <div className="uranai-glass rounded-3xl px-5 py-10 text-center space-y-3">
          <p className="font-display text-base font-semibold text-[var(--text-primary)]">
            {onlySelected && selectedCards.length === 0
              ? "尚未选入任何实体牌"
              : "未找到匹配的塔罗牌"}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            {onlySelected && selectedCards.length === 0
              ? "关闭「仅看已选」后，可直接点击任意牌面的「+ 正位 / + 逆位」快速选入。"
              : suitFilter !== "all" && suitCounts.all > 0
                ? `「全部」花色下共有 ${suitCounts.all} 张匹配当前关键词，可切换查看或重置筛选。`
                : "试试简短关键词（如 宝剑7、圣杯后、VI、火），或点击下方重置筛选。"}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {suitFilter !== "all" && suitCounts.all > 0 ? (
              <button
                type="button"
                onClick={() => handleSelectSuit("all")}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)] bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-[var(--accent-contrast)] transition hover:brightness-105 active:scale-95"
              >
                切换到「全部」({suitCounts.all})
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-4 py-1.5 text-xs font-semibold text-[var(--accent-strong)] transition hover:brightness-110 active:scale-95"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              重置全部筛选
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3.5 md:grid-cols-4">
          {filteredCards.map((card) => {
            const match = selectedMap.get(card.id);
            return (
              <PickerCardTile
                key={card.id}
                card={card}
                deck={deck}
                selectedEntry={match?.entry}
                selectedPosition={match?.position}
                isLimitReached={isLimitReached}
                maxCards={maxCards}
                soundEnabled={soundEnabled}
                onAddCard={onAddCard}
                onToggleCardReversed={onToggleCardReversed}
                onRemoveCard={onRemoveCard}
                onQuickLookup={onQuickLookup}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
