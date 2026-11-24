export type ArcanaType = "major" | "minor";
export type SuitType = "major" | "wands" | "cups" | "swords" | "pentacles";
export type DeckId = "rider-waite" | "mucha-hamster";
export type ThemeId =
  | "celestial-velvet"
  | "emerald-salon"
  | "astral-nebula"
  | "parchment-linen"
  | "lunar-ink";
export type ReadingCategoryId =
  | "love"
  | "career"
  | "wealth"
  | "study"
  | "decision"
  | "general";
export type SpreadId =
  | "single"
  | "time-flow"
  | "action-insight"
  | "cross-five"
  | "love-mirror"
  | "celtic-cross";

export interface TarotCard {
  id: string;
  index: number;
  slug: string;
  arcana: ArcanaType;
  suit: SuitType;
  number: number;
  romanNumeral?: string;
  nameZh: string;
  nameEn: string;
  element: string;
  astrology: string;
  keywordsUpright: string[];
  keywordsReversed: string[];
  meaningUpright: string;
  meaningReversed: string;
  loveUpright: string;
  loveReversed: string;
  careerUpright: string;
  careerReversed: string;
  wealthUpright: string;
  wealthReversed: string;
  adviceUpright: string;
  adviceReversed: string;
  affirmation: string;
}

export interface SpreadSlot {
  index: number;
  labelZh: string;
  labelEn: string;
  description: string;
  x: number;
  y: number;
  rotation?: number;
}

export interface SpreadDefinition {
  id: SpreadId;
  nameZh: string;
  nameEn: string;
  cardCount: number;
  difficulty: "入门" | "进阶" | "深度";
  summary: string;
  recommendedFor: ReadingCategoryId[];
  slots: SpreadSlot[];
}

export interface ReadingCategory {
  id: ReadingCategoryId;
  nameZh: string;
  nameEn: string;
  icon: string;
  sampleQuestions: string[];
}

export interface ThemePreset {
  id: ThemeId;
  nameZh: string;
  nameEn: string;
  clothNameZh: string;
  tagline: string;
  isLight: boolean;
  swatches: [string, string, string, string];
  cssVars: Record<string, string>;
  particleColor: string;
  particleSecondary: string;
  particleStyle: "stardust" | "firefly" | "aurora" | "linen-motes" | "ink-mist";
  cardEdgeColor: string;
  foilGradient: string;
}

export interface DeckDefinition {
  id: DeckId;
  nameZh: string;
  nameEn: string;
  subtitle: string;
  description: string;
  totalCards: number;
  basePath: string;
  backImage?: string;
  availableSlugs?: string[];
  badge: string;
  frameStyle: "classic-gold" | "art-nouveau";
}

export interface DrawnCard {
  cardId: string;
  slotIndex: number;
  reversed: boolean;
  revealed: boolean;
}

export interface ReadingRecord {
  id: string;
  mode: "daily" | "spread";
  dateKey?: string;
  category: ReadingCategoryId;
  question: string;
  spreadId: SpreadId;
  deckId: DeckId;
  themeId: ThemeId;
  cards: DrawnCard[];
  aiInterpretation?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AiConfig {
  mode: "server" | "custom";
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface UserPreferences {
  themeId: ThemeId;
  deckId: DeckId;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  gyroEnabled: boolean;
  allowReversed: boolean;
}
