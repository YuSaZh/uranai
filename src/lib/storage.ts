import type {
  AiConfig,
  ClothDetailSettings,
  ClothLightingId,
  ClothMaterialId,
  ClothMotifId,
  DeckId,
  DrawnCard,
  ReadingCategoryId,
  ReadingRecord,
  SpreadId,
  ThemeId,
  UserPreferences,
} from "@/types/tarot";
import { DEFAULT_THEME_ID, THEMES } from "@/data/themes";
import { DEFAULT_DECK_ID, DECKS } from "@/data/decks";
import { READING_CATEGORIES, SPREADS } from "@/data/spreads";
import {
  CLOTH_LIGHTINGS,
  CLOTH_MATERIALS,
  CLOTH_MOTIFS,
  DEFAULT_CLOTH_DETAIL,
} from "@/lib/cloth-textures";
import { DEFAULT_DECK_POOL, sanitizeDeckPool } from "@/lib/deck-pool";
import { getSupabaseClient } from "@/lib/supabase";

export const STORAGE_KEYS = {
  PREFS: "uranai_prefs_v1",
  READINGS: "uranai_readings_v1",
  AI: "uranai_ai_v1",
} as const;

export const DEFAULT_PREFS: UserPreferences = {
  themeId: DEFAULT_THEME_ID,
  deckId: DEFAULT_DECK_ID,
  soundEnabled: true,
  hapticsEnabled: true,
  gyroEnabled: true,
  allowReversed: true,
  clothDetail: DEFAULT_CLOTH_DETAIL,
  deckPool: DEFAULT_DECK_POOL,
};

export const DEFAULT_AI_CONFIG: AiConfig = {
  mode: "server",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
};

const VALID_THEME_IDS = new Set<string>(THEMES.map((t) => t.id));
const VALID_DECK_IDS = new Set<string>(DECKS.map((d) => d.id));
const VALID_CATEGORY_IDS = new Set<string>(READING_CATEGORIES.map((c) => c.id));
const VALID_SPREAD_IDS = new Set<string>(SPREADS.map((s) => s.id));
const VALID_CLOTH_MATERIALS = new Set<string>(CLOTH_MATERIALS.map((m) => m.id));
const VALID_CLOTH_MOTIFS = new Set<string>(CLOTH_MOTIFS.map((m) => m.id));
const VALID_CLOTH_LIGHTINGS = new Set<string>(CLOTH_LIGHTINGS.map((l) => l.id));

function clampPct(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function sanitizeClothDetail(value: unknown): ClothDetailSettings {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_CLOTH_DETAIL };
  }
  const raw = value as Partial<ClothDetailSettings>;
  return {
    material:
      typeof raw.material === "string" && VALID_CLOTH_MATERIALS.has(raw.material)
        ? (raw.material as ClothMaterialId)
        : DEFAULT_CLOTH_DETAIL.material,
    textureIntensity: clampPct(
      raw.textureIntensity,
      DEFAULT_CLOTH_DETAIL.textureIntensity
    ),
    foldDepth: clampPct(raw.foldDepth, DEFAULT_CLOTH_DETAIL.foldDepth),
    motif:
      typeof raw.motif === "string" && VALID_CLOTH_MOTIFS.has(raw.motif)
        ? (raw.motif as ClothMotifId)
        : DEFAULT_CLOTH_DETAIL.motif,
    motifOpacity: clampPct(raw.motifOpacity, DEFAULT_CLOTH_DETAIL.motifOpacity),
    lighting:
      typeof raw.lighting === "string" && VALID_CLOTH_LIGHTINGS.has(raw.lighting)
        ? (raw.lighting as ClothLightingId)
        : DEFAULT_CLOTH_DETAIL.lighting,
    vignetteStrength: clampPct(
      raw.vignetteStrength,
      DEFAULT_CLOTH_DETAIL.vignetteStrength
    ),
    goldTrim:
      typeof raw.goldTrim === "boolean"
        ? raw.goldTrim
        : DEFAULT_CLOTH_DETAIL.goldTrim,
    interactiveSheen:
      typeof raw.interactiveSheen === "boolean"
        ? raw.interactiveSheen
        : DEFAULT_CLOTH_DETAIL.interactiveSheen,
    particleDensity: clampPct(
      raw.particleDensity,
      DEFAULT_CLOTH_DETAIL.particleDensity
    ),
  };
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function sanitizeThemeId(value: unknown): ThemeId {
  return typeof value === "string" && VALID_THEME_IDS.has(value)
    ? (value as ThemeId)
    : DEFAULT_THEME_ID;
}

function sanitizeDeckId(value: unknown): DeckId {
  return typeof value === "string" && VALID_DECK_IDS.has(value)
    ? (value as DeckId)
    : DEFAULT_DECK_ID;
}

function sanitizeCategoryId(value: unknown): ReadingCategoryId {
  return typeof value === "string" && VALID_CATEGORY_IDS.has(value)
    ? (value as ReadingCategoryId)
    : "general";
}

function sanitizeSpreadId(value: unknown): SpreadId {
  return typeof value === "string" && VALID_SPREAD_IDS.has(value)
    ? (value as SpreadId)
    : "single";
}

export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function loadLocalPrefs(): UserPreferences {
  if (!isBrowser()) return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.PREFS);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      themeId: sanitizeThemeId(parsed.themeId),
      deckId: sanitizeDeckId(parsed.deckId),
      soundEnabled:
        typeof parsed.soundEnabled === "boolean"
          ? parsed.soundEnabled
          : DEFAULT_PREFS.soundEnabled,
      hapticsEnabled:
        typeof parsed.hapticsEnabled === "boolean"
          ? parsed.hapticsEnabled
          : DEFAULT_PREFS.hapticsEnabled,
      gyroEnabled:
        typeof parsed.gyroEnabled === "boolean"
          ? parsed.gyroEnabled
          : DEFAULT_PREFS.gyroEnabled,
      allowReversed:
        typeof parsed.allowReversed === "boolean"
          ? parsed.allowReversed
          : DEFAULT_PREFS.allowReversed,
      clothDetail: sanitizeClothDetail(parsed.clothDetail),
      deckPool: sanitizeDeckPool(parsed.deckPool),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function saveLocalPrefs(prefs: UserPreferences): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.PREFS, JSON.stringify(prefs));
  } catch {
    // Storage quota or restricted mode
  }
}

export function loadLocalAiConfig(): AiConfig {
  if (!isBrowser()) return DEFAULT_AI_CONFIG;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.AI);
    if (!raw) return DEFAULT_AI_CONFIG;
    const parsed = JSON.parse(raw) as Partial<AiConfig>;
    return {
      mode: parsed.mode === "custom" ? "custom" : "server",
      baseUrl:
        typeof parsed.baseUrl === "string" && parsed.baseUrl.trim()
          ? parsed.baseUrl
          : DEFAULT_AI_CONFIG.baseUrl,
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      model:
        typeof parsed.model === "string" && parsed.model.trim()
          ? parsed.model
          : DEFAULT_AI_CONFIG.model,
    };
  } catch {
    return DEFAULT_AI_CONFIG;
  }
}

export function saveLocalAiConfig(config: AiConfig): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.AI, JSON.stringify(config));
  } catch {
    // Ignore storage error
  }
}

function isValidDrawnCard(value: unknown): value is DrawnCard {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.cardId === "string" &&
    obj.cardId.length > 0 &&
    typeof obj.slotIndex === "number" &&
    Number.isFinite(obj.slotIndex) &&
    typeof obj.reversed === "boolean" &&
    typeof obj.revealed === "boolean"
  );
}

export function sanitizeReadingRecord(input: unknown): ReadingRecord | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;

  if (typeof raw.id !== "string" || !raw.id.trim()) return null;
  const mode = raw.mode === "daily" || raw.mode === "spread" ? raw.mode : null;
  if (!mode) return null;

  if (!Array.isArray(raw.cards) || raw.cards.length === 0) return null;
  const cards = raw.cards.filter(isValidDrawnCard);
  if (cards.length === 0) return null;

  const createdAt =
    typeof raw.createdAt === "string" && !Number.isNaN(Date.parse(raw.createdAt))
      ? raw.createdAt
      : new Date().toISOString();

  const updatedAt =
    typeof raw.updatedAt === "string" && !Number.isNaN(Date.parse(raw.updatedAt))
      ? raw.updatedAt
      : createdAt;

  const dateKey =
    typeof raw.dateKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.dateKey)
      ? raw.dateKey
      : getLocalDateKey(new Date(createdAt));

  return {
    id: raw.id.trim(),
    mode,
    dateKey,
    category: sanitizeCategoryId(raw.category),
    question: typeof raw.question === "string" ? raw.question : "",
    spreadId: sanitizeSpreadId(raw.spreadId),
    deckId: sanitizeDeckId(raw.deckId),
    themeId: sanitizeThemeId(raw.themeId),
    cards,
    aiInterpretation:
      typeof raw.aiInterpretation === "string" ? raw.aiInterpretation : undefined,
    notes: typeof raw.notes === "string" ? raw.notes : undefined,
    createdAt,
    updatedAt,
  };
}

export function sortReadingsDesc(readings: ReadingRecord[]): ReadingRecord[] {
  return [...readings].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
  );
}

export function loadLocalReadings(): ReadingRecord[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.READINGS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const valid: ReadingRecord[] = [];
    for (const item of parsed) {
      const sanitized = sanitizeReadingRecord(item);
      if (sanitized) valid.push(sanitized);
    }
    return sortReadingsDesc(valid);
  } catch {
    return [];
  }
}

export function saveLocalReadings(readings: ReadingRecord[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(
      STORAGE_KEYS.READINGS,
      JSON.stringify(sortReadingsDesc(readings))
    );
  } catch {
    // Ignore storage quota error
  }
}

export function mergeReadingsLists(
  base: ReadingRecord[],
  incoming: ReadingRecord[]
): ReadingRecord[] {
  const byId = new Map<string, ReadingRecord>();

  for (const record of base) {
    byId.set(record.id, record);
  }

  for (const record of incoming) {
    const existing = byId.get(record.id);
    if (!existing) {
      byId.set(record.id, record);
      continue;
    }
    const existingTs = Date.parse(existing.updatedAt || existing.createdAt);
    const incomingTs = Date.parse(record.updatedAt || record.createdAt);
    if (incomingTs >= existingTs) {
      byId.set(record.id, record);
    }
  }

  return sortReadingsDesc(Array.from(byId.values()));
}

interface ExportEnvelope {
  app: "uranai";
  version: 1;
  exportedAt: string;
  readings: ReadingRecord[];
}

export function exportReadingsToJson(readings: ReadingRecord[]): string {
  const envelope: ExportEnvelope = {
    app: "uranai",
    version: 1,
    exportedAt: new Date().toISOString(),
    readings: sortReadingsDesc(readings),
  };
  return JSON.stringify(envelope, null, 2);
}

export function parseImportedReadings(
  rawJson: string
): { ok: true; readings: ReadingRecord[] } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(rawJson) as unknown;
    let list: unknown[] | null = null;

    if (Array.isArray(parsed)) {
      list = parsed;
    } else if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as { readings?: unknown }).readings)
    ) {
      list = (parsed as { readings: unknown[] }).readings;
    }

    if (!list) {
      return {
        ok: false,
        error: "文件格式不受支持：请导入 Uranai 导出的占卜记录 JSON 文件。",
      };
    }

    const valid: ReadingRecord[] = [];
    for (const item of list) {
      const sanitized = sanitizeReadingRecord(item);
      if (sanitized) valid.push(sanitized);
    }

    if (valid.length === 0) {
      return {
        ok: false,
        error: "未在文件中找到有效的占卜记录数据。",
      };
    }

    return { ok: true, readings: sortReadingsDesc(valid) };
  } catch {
    return {
      ok: false,
      error: "JSON 文件解析失败，请确认文件完整无损坏。",
    };
  }
}

// ============================================================================
// Supabase Cloud Sync Helpers
// ============================================================================

interface CloudPrefsRow {
  user_id: string;
  theme_id: string;
  deck_id: string;
  sound_enabled: boolean;
  haptics_enabled: boolean;
  gyro_enabled: boolean;
  allow_reversed: boolean;
  cloth_detail?: unknown;
  deck_pool?: unknown;
  updated_at: string;
}

interface CloudReadingRow {
  id: string;
  user_id: string;
  mode: string;
  date_key: string;
  category: string | null;
  question: string | null;
  spread_id: string | null;
  deck_id: string;
  theme_id: string;
  cards: unknown;
  ai_interpretation: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function toCloudReadingRow(
  userId: string,
  record: ReadingRecord
): CloudReadingRow {
  const nowIso = new Date().toISOString();
  return {
    id: record.id,
    user_id: userId,
    mode: record.mode,
    date_key: record.dateKey || getLocalDateKey(new Date(record.createdAt)),
    category: record.category,
    question: record.question,
    spread_id: record.spreadId,
    deck_id: record.deckId,
    theme_id: record.themeId,
    cards: record.cards,
    ai_interpretation: record.aiInterpretation ?? null,
    notes: record.notes ?? null,
    created_at: record.createdAt,
    updated_at: record.updatedAt || nowIso,
  };
}

function fromCloudReadingRow(row: CloudReadingRow): ReadingRecord | null {
  return sanitizeReadingRecord({
    id: row.id,
    mode: row.mode,
    dateKey: row.date_key,
    category: row.category ?? "general",
    question: row.question ?? "",
    spreadId: row.spread_id ?? "single",
    deckId: row.deck_id,
    themeId: row.theme_id,
    cards: row.cards,
    aiInterpretation: row.ai_interpretation ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export async function pushPrefsToCloud(
  userId: string,
  prefs: UserPreferences
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: userId,
      theme_id: prefs.themeId,
      deck_id: prefs.deckId,
      sound_enabled: prefs.soundEnabled,
      haptics_enabled: prefs.hapticsEnabled,
      gyro_enabled: prefs.gyroEnabled,
      allow_reversed: prefs.allowReversed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  return !error;
}

export async function pushReadingToCloud(
  userId: string,
  record: ReadingRecord
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("readings")
    .upsert(toCloudReadingRow(userId, record), { onConflict: "id" });

  return !error;
}

export async function deleteReadingFromCloud(
  userId: string,
  readingId: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("readings")
    .delete()
    .eq("id", readingId)
    .eq("user_id", userId);

  return !error;
}

export async function syncFromCloud(
  userId: string,
  localPrefs: UserPreferences,
  localReadings: ReadingRecord[]
): Promise<{
  prefs: UserPreferences;
  readings: ReadingRecord[];
}> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { prefs: localPrefs, readings: localReadings };
  }

  const [prefsResult, readingsResult] = await Promise.all([
    supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("readings")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  if (prefsResult.error) {
    throw new Error(prefsResult.error.message);
  }
  if (readingsResult.error) {
    throw new Error(readingsResult.error.message);
  }

  let mergedPrefs = localPrefs;
  const cloudPrefsRow = prefsResult.data as CloudPrefsRow | null;
  if (cloudPrefsRow) {
    mergedPrefs = {
      themeId: sanitizeThemeId(cloudPrefsRow.theme_id),
      deckId: sanitizeDeckId(cloudPrefsRow.deck_id),
      soundEnabled: Boolean(cloudPrefsRow.sound_enabled),
      hapticsEnabled: Boolean(cloudPrefsRow.haptics_enabled),
      gyroEnabled: Boolean(cloudPrefsRow.gyro_enabled),
      allowReversed: Boolean(cloudPrefsRow.allow_reversed),
      clothDetail: sanitizeClothDetail(
        cloudPrefsRow.cloth_detail ?? localPrefs.clothDetail
      ),
      deckPool: sanitizeDeckPool(
        cloudPrefsRow.deck_pool ?? localPrefs.deckPool
      ),
    };
  } else {
    await pushPrefsToCloud(userId, localPrefs);
  }

  const cloudRows = (readingsResult.data as CloudReadingRow[] | null) ?? [];
  const cloudReadings: ReadingRecord[] = [];
  const cloudMap = new Map<string, ReadingRecord>();

  for (const row of cloudRows) {
    const record = fromCloudReadingRow(row);
    if (record) {
      cloudReadings.push(record);
      cloudMap.set(record.id, record);
    }
  }

  const mergedReadings = mergeReadingsLists(localReadings, cloudReadings);

  // Push any local-only or newer local records up to Supabase
  const recordsToPush = mergedReadings.filter((record) => {
    const cloudRecord = cloudMap.get(record.id);
    if (!cloudRecord) return true;
    const localTs = Date.parse(record.updatedAt || record.createdAt);
    const cloudTs = Date.parse(cloudRecord.updatedAt || cloudRecord.createdAt);
    return localTs > cloudTs;
  });

  if (recordsToPush.length > 0) {
    await supabase
      .from("readings")
      .upsert(
        recordsToPush.map((r) => toCloudReadingRow(userId, r)),
        { onConflict: "id" }
      );
  }

  return {
    prefs: mergedPrefs,
    readings: mergedReadings,
  };
}
