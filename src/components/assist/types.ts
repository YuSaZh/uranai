import type { ReadingCategoryId, SpreadId, TarotCard } from "@/types/tarot";

export type AssistSpreadId = "free" | SpreadId;

export interface AssistSelectedCard {
  /** Unique selection entry ID */
  uid: string;
  cardId: string;
  reversed: boolean;
  /** Optional custom slot label override in free mode */
  customSlotLabel?: string;
}

export interface AssistQuickLookupTarget {
  card: TarotCard;
  reversed: boolean;
  /** Present when this card is already in the selected spread tray */
  selectedUid?: string;
  slotLabel?: string;
}

export type AssistSuitFilter =
  | "all"
  | "major"
  | "wands"
  | "cups"
  | "swords"
  | "pentacles";

export type AssistRankFilter = "all" | "pips" | "court";

export type AssistReadingTab =
  | "general"
  | "love"
  | "career"
  | "wealth"
  | "advice";

export interface AssistReadingDomainConfig {
  categoryId: ReadingCategoryId;
  question: string;
  spreadId: AssistSpreadId;
}
