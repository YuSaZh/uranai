"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import type {
  AiConfig,
  ClothDetailSettings,
  DeckDefinition,
  DeckId,
  DeckPoolConfig,
  ReadingRecord,
  ThemeId,
  ThemePreset,
  UserPreferences,
} from "@/types/tarot";
import { sanitizeDeckPool } from "@/lib/deck-pool";
import { getThemeById } from "@/data/themes";
import { getDeckById } from "@/data/decks";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import {
  DEFAULT_AI_CONFIG,
  DEFAULT_PREFS,
  deleteReadingFromCloud,
  getLocalDateKey,
  loadLocalAiConfig,
  loadLocalPrefs,
  loadLocalReadings,
  mergeReadingsLists,
  pushPrefsToCloud,
  pushReadingToCloud,
  saveLocalAiConfig,
  saveLocalPrefs,
  saveLocalReadings,
  sortReadingsDesc,
  syncFromCloud,
} from "@/lib/storage";

export type SyncState = "local" | "syncing" | "synced" | "error";

export interface AuthActionResult {
  ok: boolean;
  error?: string;
  needsConfirmation?: boolean;
}

export interface UranaiContextValue {
  prefs: UserPreferences;
  theme: ThemePreset;
  deck: DeckDefinition;
  aiConfig: AiConfig;
  readings: ReadingRecord[];
  hydrated: boolean;
  user: User | null;
  supabaseEnabled: boolean;
  syncState: SyncState;
  syncError: string | null;
  setThemeId: (themeId: ThemeId) => void;
  setDeckId: (deckId: DeckId) => void;
  updatePrefs: (patch: Partial<UserPreferences>) => void;
  updateClothDetail: (patch: Partial<ClothDetailSettings>) => void;
  updateDeckPool: (next: DeckPoolConfig) => void;
  setAiConfig: (next: AiConfig) => void;
  addReading: (record: ReadingRecord) => void;
  updateReading: (id: string, patch: Partial<ReadingRecord>) => void;
  deleteReading: (id: string) => void;
  importReadings: (incoming: ReadingRecord[]) => number;
  getTodayDailyReading: () => ReadingRecord | undefined;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signUp: (email: string, password: string) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
}

const UranaiContext = createContext<UranaiContextValue | null>(null);

function getAccentContrast(themeId: ThemeId): string {
  if (themeId === "parchment-linen" || themeId === "lunar-ink") {
    return "#faf6f0";
  }
  return "#120e07";
}

function applyThemeToDocument(theme: ThemePreset): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", theme.id);
  root.setAttribute("data-light", theme.isLight ? "true" : "false");

  for (const [key, value] of Object.entries(theme.cssVars)) {
    root.style.setProperty(key, value);
  }
  root.style.setProperty("--accent-contrast", getAccentContrast(theme.id));

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta && theme.cssVars["--bg-base"]) {
    themeColorMeta.setAttribute("content", theme.cssVars["--bg-base"]);
  }
}

export function UranaiProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [aiConfig, setAiConfigState] = useState<AiConfig>(DEFAULT_AI_CONFIG);
  const [readings, setReadings] = useState<ReadingRecord[]>([]);
  const [hydrated, setHydrated] = useState<boolean>(false);

  const [user, setUser] = useState<User | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("local");
  const [syncError, setSyncError] = useState<string | null>(null);

  const supabaseEnabled = isSupabaseConfigured();

  const prefsRef = useRef<UserPreferences>(prefs);
  const readingsRef = useRef<ReadingRecord[]>(readings);
  const userRef = useRef<User | null>(user);

  prefsRef.current = prefs;
  readingsRef.current = readings;
  userRef.current = user;

  const theme = useMemo(() => getThemeById(prefs.themeId), [prefs.themeId]);
  const deck = useMemo(() => getDeckById(prefs.deckId), [prefs.deckId]);

  // Apply CSS custom properties whenever theme changes
  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const performCloudSync = useCallback(async (targetUser: User) => {
    setSyncState("syncing");
    setSyncError(null);
    try {
      const merged = await syncFromCloud(
        targetUser.id,
        prefsRef.current,
        readingsRef.current
      );
      setPrefs(merged.prefs);
      saveLocalPrefs(merged.prefs);
      setReadings(merged.readings);
      saveLocalReadings(merged.readings);
      setSyncState("synced");
    } catch (err) {
      setSyncState("error");
      setSyncError(
        err instanceof Error ? err.message : "云端同步失败，请稍后重试。"
      );
    }
  }, []);

  // Hydrate local storage and initialize Supabase auth session
  useEffect(() => {
    const initialPrefs = loadLocalPrefs();
    const initialAi = loadLocalAiConfig();
    const initialReadings = loadLocalReadings();

    prefsRef.current = initialPrefs;
    readingsRef.current = initialReadings;

    setPrefs(initialPrefs);
    setAiConfigState(initialAi);
    setReadings(initialReadings);
    setHydrated(true);

    const supabase = getSupabaseClient();
    if (!supabase) {
      setSyncState("local");
      return;
    }

    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser);
      userRef.current = sessionUser;
      if (sessionUser) {
        void performCloudSync(sessionUser);
      } else {
        setSyncState("local");
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) return;
        const nextUser = session?.user ?? null;
        setUser(nextUser);
        userRef.current = nextUser;
        if (nextUser) {
          void performCloudSync(nextUser);
        } else {
          setSyncState("local");
          setSyncError(null);
        }
      }
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [performCloudSync]);

  const updatePrefs = useCallback((patch: Partial<UserPreferences>) => {
    setPrefs((prev) => {
      const next: UserPreferences = { ...prev, ...patch };
      prefsRef.current = next;
      saveLocalPrefs(next);

      const currentUser = userRef.current;
      if (currentUser) {
        setSyncState("syncing");
        void pushPrefsToCloud(currentUser.id, next).then((ok) => {
          setSyncState(ok ? "synced" : "error");
        });
      }
      return next;
    });
  }, []);

  const updateClothDetail = useCallback(
    (patch: Partial<ClothDetailSettings>) => {
      setPrefs((prev) => {
        const next: UserPreferences = {
          ...prev,
          clothDetail: {
            ...prev.clothDetail,
            ...patch,
          },
        };
        prefsRef.current = next;
        saveLocalPrefs(next);
        return next;
      });
    },
    []
  );

  const updateDeckPool = useCallback((nextPool: DeckPoolConfig) => {
    const sanitized = sanitizeDeckPool(nextPool);
    setPrefs((prev) => {
      const next: UserPreferences = {
        ...prev,
        deckPool: sanitized,
      };
      prefsRef.current = next;
      saveLocalPrefs(next);
      return next;
    });
  }, []);

  const setThemeId = useCallback(
    (themeId: ThemeId) => {
      updatePrefs({ themeId });
    },
    [updatePrefs]
  );

  const setDeckId = useCallback(
    (deckId: DeckId) => {
      updatePrefs({ deckId });
    },
    [updatePrefs]
  );

  const setAiConfig = useCallback((next: AiConfig) => {
    setAiConfigState(next);
    saveLocalAiConfig(next);
  }, []);

  const addReading = useCallback((record: ReadingRecord) => {
    const normalized: ReadingRecord = {
      ...record,
      dateKey: record.dateKey || getLocalDateKey(new Date(record.createdAt)),
      updatedAt: record.updatedAt || record.createdAt,
    };

    setReadings((prev) => {
      const next = sortReadingsDesc([
        normalized,
        ...prev.filter((r) => r.id !== normalized.id),
      ]);
      readingsRef.current = next;
      saveLocalReadings(next);
      return next;
    });

    const currentUser = userRef.current;
    if (currentUser) {
      setSyncState("syncing");
      void pushReadingToCloud(currentUser.id, normalized).then((ok) => {
        setSyncState(ok ? "synced" : "error");
      });
    }
  }, []);

  const updateReading = useCallback(
    (id: string, patch: Partial<ReadingRecord>) => {
      let updatedRecord: ReadingRecord | null = null;

      setReadings((prev) => {
        const next = prev.map((record) => {
          if (record.id !== id) return record;
          updatedRecord = {
            ...record,
            ...patch,
            id: record.id,
            updatedAt: new Date().toISOString(),
          };
          return updatedRecord;
        });
        const sorted = sortReadingsDesc(next);
        readingsRef.current = sorted;
        saveLocalReadings(sorted);
        return sorted;
      });

      const currentUser = userRef.current;
      if (currentUser && updatedRecord) {
        const recordToPush: ReadingRecord = updatedRecord;
        setSyncState("syncing");
        void pushReadingToCloud(currentUser.id, recordToPush).then((ok) => {
          setSyncState(ok ? "synced" : "error");
        });
      }
    },
    []
  );

  const deleteReading = useCallback((id: string) => {
    setReadings((prev) => {
      const next = prev.filter((record) => record.id !== id);
      readingsRef.current = next;
      saveLocalReadings(next);
      return next;
    });

    const currentUser = userRef.current;
    if (currentUser) {
      setSyncState("syncing");
      void deleteReadingFromCloud(currentUser.id, id).then((ok) => {
        setSyncState(ok ? "synced" : "error");
      });
    }
  }, []);

  const importReadings = useCallback((incoming: ReadingRecord[]): number => {
    const existingIds = new Set(readingsRef.current.map((r) => r.id));
    const addedCount = incoming.filter((r) => !existingIds.has(r.id)).length;
    const merged = mergeReadingsLists(readingsRef.current, incoming);

    readingsRef.current = merged;
    setReadings(merged);
    saveLocalReadings(merged);

    const currentUser = userRef.current;
    if (currentUser) {
      setSyncState("syncing");
      void Promise.all(
        incoming.map((record) => pushReadingToCloud(currentUser.id, record))
      ).then((results) => {
        setSyncState(results.every(Boolean) ? "synced" : "error");
      });
    }

    return addedCount > 0 ? addedCount : incoming.length;
  }, []);

  const getTodayDailyReading = useCallback((): ReadingRecord | undefined => {
    const todayKey = getLocalDateKey();
    return readings.find(
      (record) =>
        record.mode === "daily" &&
        (record.dateKey === todayKey ||
          getLocalDateKey(new Date(record.createdAt)) === todayKey)
    );
  }, [readings]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return { ok: false, error: "当前站点尚未配置 Supabase 云端同步环境变量。" };
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { ok: false, error: error.message };
      }

      return { ok: true };
    },
    []
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return { ok: false, error: "当前站点尚未配置 Supabase 云端同步环境变量。" };
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        return { ok: false, error: error.message };
      }

      return {
        ok: true,
        needsConfirmation: !data.session,
      };
    },
    []
  );

  const signOut = useCallback(async (): Promise<void> => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    userRef.current = null;
    setSyncState("local");
    setSyncError(null);
  }, []);

  const syncNow = useCallback(async (): Promise<void> => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    await performCloudSync(currentUser);
  }, [performCloudSync]);

  const value = useMemo<UranaiContextValue>(
    () => ({
      prefs,
      theme,
      deck,
      aiConfig,
      readings,
      hydrated,
      user,
      supabaseEnabled,
      syncState,
      syncError,
      setThemeId,
      setDeckId,
      updatePrefs,
      updateClothDetail,
      updateDeckPool,
      setAiConfig,
      addReading,
      updateReading,
      deleteReading,
      importReadings,
      getTodayDailyReading,
      signIn,
      signUp,
      signOut,
      syncNow,
    }),
    [
      prefs,
      theme,
      deck,
      aiConfig,
      readings,
      hydrated,
      user,
      supabaseEnabled,
      syncState,
      syncError,
      setThemeId,
      setDeckId,
      updatePrefs,
      updateClothDetail,
      updateDeckPool,
      setAiConfig,
      addReading,
      updateReading,
      deleteReading,
      importReadings,
      getTodayDailyReading,
      signIn,
      signUp,
      signOut,
      syncNow,
    ]
  );

  return (
    <UranaiContext.Provider value={value}>{children}</UranaiContext.Provider>
  );
}

export function useUranai(): UranaiContextValue {
  const ctx = useContext(UranaiContext);
  if (!ctx) {
    throw new Error("useUranai must be used inside <UranaiProvider>.");
  }
  return ctx;
}
