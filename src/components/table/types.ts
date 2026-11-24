import type { SpreadId } from "@/types/tarot";

export type TableSpreadId = "free" | SpreadId;
export type TablePhase = "stack" | "wash" | "ribbon" | "focus";

export interface TablePlacedCard {
  uid: string;
  cardId: string;
  slotIndex: number;
  reversed: boolean;
  revealed: boolean;
  xPct: number; // 0..100 percent of table canvas width
  yPct: number; // 0..100 percent of table canvas height
  rotation: number; // degrees on cloth (e.g. 90 for Celtic Cross crossing card or slight natural scatter)
  zIndex: number;
}
