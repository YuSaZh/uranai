import type {
  DeckPoolConfig,
  DeckPoolPresetId,
  MinorSuitKey,
  TarotCard,
} from "@/types/tarot";
import { TAROT_CARDS } from "@/data/tarot-cards";

export const MINOR_SUIT_KEYS: MinorSuitKey[] = [
  "wands",
  "cups",
  "swords",
  "pentacles",
];

export const MINOR_SUIT_META: Record<
  MinorSuitKey,
  { nameZh: string; nameEn: string; elementZh: string; badge: string }
> = {
  wands: { nameZh: "权杖", nameEn: "Wands", elementZh: "火元素 · 行动与热忱", badge: "火" },
  cups: { nameZh: "圣杯", nameEn: "Cups", elementZh: "水元素 · 情感与直觉", badge: "水" },
  swords: { nameZh: "宝剑", nameEn: "Swords", elementZh: "风元素 · 思辨与抉择", badge: "风" },
  pentacles: { nameZh: "星币", nameEn: "Pentacles", elementZh: "土元素 · 物质与事业", badge: "土" },
};

export const DEFAULT_DECK_POOL: DeckPoolConfig = {
  presetId: "full-78",
  includeMajor: true,
  includeMinorPips: true,
  includeCourt: true,
  suits: {
    wands: true,
    cups: true,
    swords: true,
    pentacles: true,
  },
  excludedCardIds: [],
};

export interface DeckPoolPresetOption {
  id: Exclude<DeckPoolPresetId, "custom">;
  nameZh: string;
  shortLabel: string;
  cardCount: number;
  traditionTag: string;
  description: string;
  config: DeckPoolConfig;
}

export const DECK_POOL_PRESETS: DeckPoolPresetOption[] = [
  {
    id: "full-78",
    nameZh: "完整 78 张全牌组",
    shortLabel: "全牌",
    cardCount: 78,
    traditionTag: "标准伟特 · 全维占卜",
    description: "22 张大阿卡纳 + 56 张小阿卡纳，兼顾宏大命运课题与日常细节脉络。",
    config: {
      presetId: "full-78",
      includeMajor: true,
      includeMinorPips: true,
      includeCourt: true,
      suits: { wands: true, cups: true, swords: true, pentacles: true },
      excludedCardIds: [],
    },
  },
  {
    id: "major-22",
    nameZh: "仅大阿卡纳 22 张",
    shortLabel: "仅大牌",
    cardCount: 22,
    traditionTag: "马赛 / 欧陆流派",
    description: "仅纳入 0–XXI 大阿卡纳，聚焦灵魂课题、人生重大转折与高维启示。",
    config: {
      presetId: "major-22",
      includeMajor: true,
      includeMinorPips: false,
      includeCourt: false,
      suits: { wands: false, cups: false, swords: false, pentacles: false },
      excludedCardIds: [],
    },
  },
  {
    id: "minor-56",
    nameZh: "仅小阿卡纳 56 张",
    shortLabel: "仅小牌",
    cardCount: 56,
    traditionTag: "日常事件 · 细节推演",
    description: "仅纳入四元素数字牌与宫廷牌，专注现实生活进展、具体事务与行动趋势。",
    config: {
      presetId: "minor-56",
      includeMajor: false,
      includeMinorPips: true,
      includeCourt: true,
      suits: { wands: true, cups: true, swords: true, pentacles: true },
      excludedCardIds: [],
    },
  },
  {
    id: "pips-40",
    nameZh: "仅数字牌 40 张",
    shortLabel: "数字牌",
    cardCount: 40,
    traditionTag: "纯事件周期 · Ace–10",
    description: "排除大牌与宫廷人物，纯粹观察四元素从萌芽（Ace）到圆满（10）的节奏。",
    config: {
      presetId: "pips-40",
      includeMajor: false,
      includeMinorPips: true,
      includeCourt: false,
      suits: { wands: true, cups: true, swords: true, pentacles: true },
      excludedCardIds: [],
    },
  },
  {
    id: "major-court-38",
    nameZh: "大牌 + 宫廷人物 38 张",
    shortLabel: "大牌+宫廷",
    cardCount: 38,
    traditionTag: "命运原型 · 人物互动",
    description: "22 张大阿卡纳配 16 张宫廷牌，擅长剖析关系角色定位与关键贵人动态。",
    config: {
      presetId: "major-court-38",
      includeMajor: true,
      includeMinorPips: false,
      includeCourt: true,
      suits: { wands: true, cups: true, swords: true, pentacles: true },
      excludedCardIds: [],
    },
  },
  {
    id: "court-16",
    nameZh: "仅宫廷人物牌 16 张",
    shortLabel: "宫廷牌",
    cardCount: 16,
    traditionTag: "人物画像 · 性格洞察",
    description: "侍从、骑士、王后、国王 16 张人物牌，专测他人性格、心态与角色特质。",
    config: {
      presetId: "court-16",
      includeMajor: false,
      includeMinorPips: false,
      includeCourt: true,
      suits: { wands: true, cups: true, swords: true, pentacles: true },
      excludedCardIds: [],
    },
  },
];

export interface ThematicPoolTemplate {
  id: string;
  nameZh: string;
  cardCount: number;
  desc: string;
  config: DeckPoolConfig;
}

export const THEMATIC_POOL_TEMPLATES: ThematicPoolTemplate[] = [
  {
    id: "love-cups-36",
    nameZh: "情感专测（大牌+圣杯）",
    cardCount: 36,
    desc: "22 大阿卡纳 + 14 圣杯牌，聚焦感情共振与情绪流动",
    config: {
      presetId: "custom",
      includeMajor: true,
      includeMinorPips: true,
      includeCourt: true,
      suits: { wands: false, cups: true, swords: false, pentacles: false },
      excludedCardIds: [],
    },
  },
  {
    id: "career-wealth-50",
    nameZh: "事业财富（大牌+权杖+星币）",
    cardCount: 50,
    desc: "22 大阿卡纳 + 权杖与星币 28 张，聚焦行动力与现实收获",
    config: {
      presetId: "custom",
      includeMajor: true,
      includeMinorPips: true,
      includeCourt: true,
      suits: { wands: true, cups: false, swords: false, pentacles: true },
      excludedCardIds: [],
    },
  },
  {
    id: "clarity-swords-36",
    nameZh: "思辨抉择（大牌+宝剑）",
    cardCount: 36,
    desc: "22 大阿卡纳 + 14 宝剑牌，专注清晰判断与局势破冰",
    config: {
      presetId: "custom",
      includeMajor: true,
      includeMinorPips: true,
      includeCourt: true,
      suits: { wands: false, cups: false, swords: true, pentacles: false },
      excludedCardIds: [],
    },
  },
];

export function isMinorCourtCard(card: TarotCard): boolean {
  return card.arcana === "minor" && card.number >= 11;
}

export function isMinorPipCard(card: TarotCard): boolean {
  return card.arcana === "minor" && card.number >= 1 && card.number <= 10;
}

export function isCardIncludedByGroups(
  card: TarotCard,
  config: DeckPoolConfig
): boolean {
  if (card.arcana === "major") {
    return config.includeMajor;
  }
  const suitKey = card.suit as MinorSuitKey;
  if (!config.suits[suitKey]) {
    return false;
  }
  if (card.number >= 11) {
    return config.includeCourt;
  }
  return config.includeMinorPips;
}

export function getPoolCards(
  config: DeckPoolConfig,
  allCards: TarotCard[] = TAROT_CARDS
): TarotCard[] {
  const excludedSet = new Set(config.excludedCardIds);
  return allCards.filter(
    (card) => isCardIncludedByGroups(card, config) && !excludedSet.has(card.id)
  );
}

export function getPoolCardIds(
  config: DeckPoolConfig,
  allCards: TarotCard[] = TAROT_CARDS
): string[] {
  return getPoolCards(config, allCards).map((c) => c.id);
}

export function detectMatchingPresetId(
  config: Omit<DeckPoolConfig, "presetId">
): DeckPoolPresetId {
  if (config.excludedCardIds.length > 0) return "custom";

  for (const preset of DECK_POOL_PRESETS) {
    const p = preset.config;
    const anyMinorEnabled = config.includeMinorPips || config.includeCourt;
    const presetMinorEnabled = p.includeMinorPips || p.includeCourt;

    const suitsMatch =
      !anyMinorEnabled && !presetMinorEnabled
        ? true
        : MINOR_SUIT_KEYS.every((k) => config.suits[k] === p.suits[k]);

    if (
      config.includeMajor === p.includeMajor &&
      config.includeMinorPips === p.includeMinorPips &&
      config.includeCourt === p.includeCourt &&
      suitsMatch
    ) {
      return preset.id;
    }
  }
  return "custom";
}

export function normalizeDeckPool(
  draft: Omit<DeckPoolConfig, "presetId">
): DeckPoolConfig {
  const validIds = new Set(TAROT_CARDS.map((c) => c.id));
  const cleanedExcluded = Array.from(
    new Set(draft.excludedCardIds.filter((id) => validIds.has(id)))
  );
  const nextBase = {
    includeMajor: Boolean(draft.includeMajor),
    includeMinorPips: Boolean(draft.includeMinorPips),
    includeCourt: Boolean(draft.includeCourt),
    suits: {
      wands: Boolean(draft.suits.wands),
      cups: Boolean(draft.suits.cups),
      swords: Boolean(draft.suits.swords),
      pentacles: Boolean(draft.suits.pentacles),
    },
    excludedCardIds: cleanedExcluded,
  };
  return {
    ...nextBase,
    presetId: detectMatchingPresetId(nextBase),
  };
}

export function sanitizeDeckPool(raw: unknown): DeckPoolConfig {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_DECK_POOL;
  }
  const obj = raw as Record<string, unknown>;
  const rawSuits =
    obj.suits && typeof obj.suits === "object"
      ? (obj.suits as Record<string, unknown>)
      : {};

  const normalized = normalizeDeckPool({
    includeMajor:
      typeof obj.includeMajor === "boolean"
        ? obj.includeMajor
        : DEFAULT_DECK_POOL.includeMajor,
    includeMinorPips:
      typeof obj.includeMinorPips === "boolean"
        ? obj.includeMinorPips
        : DEFAULT_DECK_POOL.includeMinorPips,
    includeCourt:
      typeof obj.includeCourt === "boolean"
        ? obj.includeCourt
        : DEFAULT_DECK_POOL.includeCourt,
    suits: {
      wands:
        typeof rawSuits.wands === "boolean"
          ? rawSuits.wands
          : DEFAULT_DECK_POOL.suits.wands,
      cups:
        typeof rawSuits.cups === "boolean"
          ? rawSuits.cups
          : DEFAULT_DECK_POOL.suits.cups,
      swords:
        typeof rawSuits.swords === "boolean"
          ? rawSuits.swords
          : DEFAULT_DECK_POOL.suits.swords,
      pentacles:
        typeof rawSuits.pentacles === "boolean"
          ? rawSuits.pentacles
          : DEFAULT_DECK_POOL.suits.pentacles,
    },
    excludedCardIds: Array.isArray(obj.excludedCardIds)
      ? obj.excludedCardIds.filter((x): x is string => typeof x === "string")
      : [],
  });

  // Never allow a persisted empty pool (0 cards)
  if (getPoolCardIds(normalized).length === 0) {
    return DEFAULT_DECK_POOL;
  }
  return normalized;
}

export function getDeckPoolShortLabel(
  config: DeckPoolConfig,
  activeCount?: number
): string {
  const count = activeCount ?? getPoolCardIds(config).length;
  const preset = DECK_POOL_PRESETS.find((p) => p.id === config.presetId);
  if (preset) {
    return `${preset.shortLabel} · ${count}张`;
  }
  return `自定义 · ${count}张`;
}

export function getDeckPoolTitle(config: DeckPoolConfig): string {
  const preset = DECK_POOL_PRESETS.find((p) => p.id === config.presetId);
  if (preset) return preset.nameZh;
  const count = getPoolCardIds(config).length;
  return `自定义牌池（${count} 张）`;
}
