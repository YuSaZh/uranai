import type { DeckDefinition, DeckId } from "@/types/tarot";
import muchaManifest from "../../public/decks/mucha-hamster/manifest.json";

export const MUCHA_AVAILABLE_SLUGS = new Set<string>(
  muchaManifest.availableSlugs,
);

export const MUCHA_HAS_CUSTOM_BACK = Boolean(muchaManifest.hasCustomBack);

export const DEFAULT_DECK_ID = "rider-waite" as const;

export const DECKS: DeckDefinition[] = [
  {
    id: "rider-waite",
    nameZh: "经典韦特塔罗",
    nameEn: "Rider-Waite-Smith",
    subtitle: "1909 经典公版高清 · 全 78 张",
    description:
      "帕梅拉·科尔曼·史密斯绘制的现代塔罗基石之作，高清修复完整收录 22 张大阿卡纳与 56 张小阿卡纳。",
    totalCards: 78,
    basePath: "/decks/rws",
    badge: "全套 78 张",
    frameStyle: "classic-gold",
    aspectClass: "aspect-[7/12]",
  },
  {
    id: "mucha-hamster",
    nameZh: "穆夏仓鼠塔罗",
    nameEn: "Mucha Hamster Tarot",
    subtitle: `新艺术石版画高清典藏 · ${MUCHA_AVAILABLE_SLUGS.size}/78 张实装`,
    description:
      MUCHA_AVAILABLE_SLUGS.size >= 78
        ? "融合阿尔丰斯·穆夏新艺术装饰弧线、植物花环与治愈系仓鼠主角的全套 78 张原创高清牌组与专属双鼠星夜牌背。"
        : `融合阿尔丰斯·穆夏新艺术装饰弧线、植物花环与治愈系仓鼠主角的原创高清牌组。现已实装 ${MUCHA_AVAILABLE_SLUGS.size} 张原画（含全套大阿卡纳、权杖、圣杯、宝剑）与专属牌背，剩余星币组以新艺术金箔纹章优雅呈现。`,
    totalCards: 78,
    basePath: "/decks/mucha-hamster",
    backImage: "/decks/mucha-hamster/card-back.webp",
    availableSlugs: Array.from(MUCHA_AVAILABLE_SLUGS),
    badge:
      MUCHA_AVAILABLE_SLUGS.size >= 78
        ? "全套 78 张"
        : `高清实装 ${MUCHA_AVAILABLE_SLUGS.size}/78`,
    frameStyle: "art-nouveau",
    aspectClass: "aspect-[848/1264]",
  },
];

export function getDeckById(id: DeckId): DeckDefinition {
  return DECKS.find((deck) => deck.id === id) ?? DECKS[0];
}

export function getDeckAspectClass(deckId: DeckId): string {
  return getDeckById(deckId).aspectClass;
}

export function getCardImagePath(deckId: DeckId, slug: string): string | null {
  if (deckId === "rider-waite") {
    return `/decks/rws/${slug}.webp`;
  }
  if (deckId === "mucha-hamster") {
    return MUCHA_AVAILABLE_SLUGS.has(slug)
      ? `/decks/mucha-hamster/${slug}.webp`
      : null;
  }
  return null;
}

export function getDeckBackImagePath(deckId: DeckId): string | null {
  if (deckId === "mucha-hamster" && MUCHA_HAS_CUSTOM_BACK) {
    return "/decks/mucha-hamster/card-back.webp";
  }
  return null;
}
