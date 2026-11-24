"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUranai } from "@/context/UranaiProvider";
import { getCardById } from "@/data/tarot-cards";
import { getLocalDateKey } from "@/lib/storage";
import { soundEngine } from "@/lib/sound";
import { CardInspectorModal } from "@/components/tarot/CardInspectorModal";
import { DeckPoolModal } from "@/components/tarot/DeckPoolModal";
import { VirtualTableCanvas } from "@/components/table/VirtualTableCanvas";
import { TableReadingDrawer } from "@/components/table/TableReadingDrawer";
import { getSpreadById } from "@/data/spreads";
import type { TablePlacedCard, TableSpreadId } from "@/components/table/types";
import type {
  DeckPoolConfig,
  DrawnCard,
  ReadingCategoryId,
  ReadingRecord,
  SpreadId,
  TarotCard,
} from "@/types/tarot";

type InspectCardInput =
  | TarotCard
  | string
  | { card: TarotCard; reversed: boolean }
  | { cardId: string; reversed: boolean };

function resolveRecordSpreadId(
  spreadId: TableSpreadId,
  cardCount: number
): SpreadId {
  if (spreadId !== "free") {
    return spreadId;
  }
  if (cardCount <= 1) return "single";
  if (cardCount === 3) return "time-flow";
  if (cardCount === 5) return "cross-five";
  if (cardCount === 6) return "love-mirror";
  if (cardCount >= 7) return "celtic-cross";
  return "time-flow";
}

function toDrawnCards(cards: TablePlacedCard[]): DrawnCard[] {
  return [...cards]
    .sort((a, b) => a.slotIndex - b.slotIndex)
    .map((item, idx) => ({
      cardId: item.cardId,
      slotIndex: item.slotIndex >= 0 ? item.slotIndex : idx,
      reversed: item.reversed,
      revealed: item.revealed,
    }));
}

export default function VirtualTablePage() {
  const router = useRouter();
  const { prefs, theme, deck, addReading, updateReading, setDeckId, updateDeckPool } =
    useUranai();

  const [spreadId, setSpreadId] = useState<TableSpreadId>("free");
  const [category, setCategory] = useState<ReadingCategoryId>("general");
  const [question, setQuestion] = useState<string>("");
  const [placedCards, setPlacedCards] = useState<TablePlacedCard[]>([]);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [deckPoolOpen, setDeckPoolOpen] = useState<boolean>(false);
  const [querentFacing, setQuerentFacing] = useState<boolean>(false);
  const [inspectTarget, setInspectTarget] = useState<{
    card: TarotCard;
    reversed: boolean;
  } | null>(null);
  const [aiInterpretation, setAiInterpretation] = useState<string>("");
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);

  const [canFullscreen, setCanFullscreen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);

  const savedRecordIdRef = useRef<string | null>(null);
  const placedCardsRef = useRef<TablePlacedCard[]>(placedCards);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  savedRecordIdRef.current = savedRecordId;
  placedCardsRef.current = placedCards;

  // Screen Wake Lock API: keep iPad/tablet screen awake while lying flat on a table
  useEffect(() => {
    if (typeof navigator === "undefined" || typeof document === "undefined") {
      return;
    }

    const wakeLockApi =
      "wakeLock" in navigator
        ? (navigator.wakeLock as WakeLock | undefined)
        : undefined;

    if (!wakeLockApi || typeof wakeLockApi.request !== "function") {
      setWakeLockActive(false);
      return;
    }

    let disposed = false;

    const releaseSentinel = () => {
      const current = wakeLockRef.current;
      wakeLockRef.current = null;
      if (current && !current.released) {
        void current.release().catch(() => undefined);
      }
    };

    const acquireWakeLock = async () => {
      if (disposed || document.visibilityState !== "visible") return;
      if (wakeLockRef.current && !wakeLockRef.current.released) {
        setWakeLockActive(true);
        return;
      }

      try {
        const sentinel = await wakeLockApi.request("screen");
        if (disposed) {
          void sentinel.release().catch(() => undefined);
          return;
        }
        wakeLockRef.current = sentinel;
        setWakeLockActive(true);

        const handleRelease = () => {
          if (wakeLockRef.current === sentinel) {
            wakeLockRef.current = null;
          }
          if (!disposed) {
            setWakeLockActive(false);
          }
        };

        sentinel.addEventListener("release", handleRelease, { once: true });
      } catch {
        if (!disposed) {
          setWakeLockActive(false);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void acquireWakeLock();
      }
    };

    void acquireWakeLock();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      releaseSentinel();
      setWakeLockActive(false);
    };
  }, []);

  // Fullscreen API support detection & state sync
  useEffect(() => {
    if (typeof document === "undefined") return;

    const supported =
      Boolean(document.documentElement.requestFullscreen) &&
      document.fullscreenEnabled !== false;
    setCanFullscreen(supported);
    setIsFullscreen(Boolean(document.fullscreenElement));

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (typeof document === "undefined") return;
    soundEngine.playHoverTick(prefs.soundEnabled);

    void (async () => {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else if (
          typeof document.documentElement.requestFullscreen === "function"
        ) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // Ignore browser/PWA fullscreen policy errors gracefully
      }
    })();
  }, [prefs.soundEnabled]);

  const handleOpenClothSheet = useCallback(() => {
    soundEngine.playHoverTick(prefs.soundEnabled);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent<"cloth" | "deck">("uranai:open-sheet", {
          detail: "cloth",
        })
      );
    }
  }, [prefs.soundEnabled]);

  const handleOpenDeckSheet = useCallback(() => {
    soundEngine.playHoverTick(prefs.soundEnabled);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent<"cloth" | "deck">("uranai:open-sheet", {
          detail: "deck",
        })
      );
    }
  }, [prefs.soundEnabled]);

  const handleInspectCard = useCallback(
    (input: InspectCardInput, reversedArg?: boolean) => {
      if (typeof input === "string") {
        const resolved = getCardById(input);
        if (resolved) {
          setInspectTarget({ card: resolved, reversed: Boolean(reversedArg) });
        }
        return;
      }
      if ("card" in input) {
        setInspectTarget({ card: input.card, reversed: input.reversed });
        return;
      }
      if ("cardId" in input) {
        const resolved = getCardById(input.cardId);
        if (resolved) {
          setInspectTarget({ card: resolved, reversed: input.reversed });
        }
        return;
      }
      setInspectTarget({ card: input, reversed: Boolean(reversedArg) });
    },
    []
  );

  const persistReading = useCallback(
    (overrideAiText?: string): string | null => {
      if (placedCards.length === 0) return null;

      const drawn = toDrawnCards(placedCards);
      const effectiveQuestion = question.trim() || "虚拟桌面占卜";
      const recordSpreadId = resolveRecordSpreadId(spreadId, drawn.length);
      const nextAiText =
        overrideAiText !== undefined ? overrideAiText : aiInterpretation;
      const nowIso = new Date().toISOString();

      if (savedRecordIdRef.current) {
        const existingId = savedRecordIdRef.current;
        updateReading(existingId, {
          category,
          question: effectiveQuestion,
          spreadId: recordSpreadId,
          deckId: deck.id,
          themeId: theme.id,
          cards: drawn,
          ...(nextAiText ? { aiInterpretation: nextAiText } : {}),
        });
        return existingId;
      }

      const newId = `table-${Date.now()}`;
      const record: ReadingRecord = {
        id: newId,
        mode: "spread",
        dateKey: getLocalDateKey(),
        category,
        question: effectiveQuestion,
        spreadId: recordSpreadId,
        deckId: deck.id,
        themeId: theme.id,
        cards: drawn,
        ...(nextAiText ? { aiInterpretation: nextAiText } : {}),
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      savedRecordIdRef.current = newId;
      setSavedRecordId(newId);
      addReading(record);
      return newId;
    },
    [
      addReading,
      aiInterpretation,
      category,
      deck.id,
      placedCards,
      question,
      spreadId,
      theme.id,
      updateReading,
    ]
  );

  const handleSaveHistory = useCallback(() => {
    const recordId = persistReading();
    if (recordId) {
      soundEngine.playChime(prefs.soundEnabled);
    }
  }, [persistReading, prefs.soundEnabled]);

  const handleAiComplete = useCallback(
    (text: string) => {
      setAiInterpretation(text);
      persistReading(text);
    },
    [persistReading]
  );

  const handleRevealAll = useCallback(() => {
    const current = placedCardsRef.current;
    const hasHidden = current.some((card) => !card.revealed);
    if (!hasHidden) return;

    soundEngine.playCardFlip(prefs.soundEnabled);
    if (
      prefs.hapticsEnabled &&
      typeof navigator !== "undefined" &&
      "vibrate" in navigator
    ) {
      navigator.vibrate([12, 24, 14]);
    }

    const next = current.map((card) =>
      card.revealed ? card : { ...card, revealed: true }
    );
    setPlacedCards(next);

    if (savedRecordIdRef.current) {
      updateReading(savedRecordIdRef.current, {
        cards: toDrawnCards(next),
      });
    }
  }, [prefs.hapticsEnabled, prefs.soundEnabled, updateReading]);

  const handleResetTable = useCallback(() => {
    soundEngine.playShuffle(prefs.soundEnabled);
    savedRecordIdRef.current = null;
    setPlacedCards([]);
    setAiInterpretation("");
    setSavedRecordId(null);
    setDrawerOpen(false);
    setInspectTarget(null);
  }, [prefs.soundEnabled]);

  const handleToggleQuerentFacing = useCallback(() => {
    soundEngine.playHoverTick(prefs.soundEnabled);
    setQuerentFacing((prev) => !prev);
  }, [prefs.soundEnabled]);

  const handleOpenDrawer = useCallback(() => {
    soundEngine.playHoverTick(prefs.soundEnabled);
    setDrawerOpen(true);
  }, [prefs.soundEnabled]);

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const handleOpenDeckPoolModal = useCallback(() => {
    setDeckPoolOpen(true);
  }, []);

  const handleCloseDeckPoolModal = useCallback(() => {
    setDeckPoolOpen(false);
  }, []);

  const handleApplyDeckPool = useCallback(
    (nextPool: DeckPoolConfig) => {
      updateDeckPool(nextPool);
    },
    [updateDeckPool]
  );

  const handleCloseInspector = useCallback(() => {
    setInspectTarget(null);
  }, []);

  const handleExit = useCallback(() => {
    soundEngine.playHoverTick(prefs.soundEnabled);
    if (typeof document !== "undefined" && document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
    router.push("/");
  }, [prefs.soundEnabled, router]);

  const activeSpreadMeta =
    spreadId === "free" ? null : getSpreadById(spreadId);

  return (
    <div className="relative h-[100dvh] w-[100dvw] overflow-hidden">
      <VirtualTableCanvas
        deckId={deck.id}
        themeId={theme.id}
        spreadId={spreadId}
        deckPool={prefs.deckPool}
        allowReversed={prefs.allowReversed}
        soundEnabled={prefs.soundEnabled}
        hapticsEnabled={prefs.hapticsEnabled}
        gyroEnabled={prefs.gyroEnabled}
        placedCards={placedCards}
        onPlacedCardsChange={setPlacedCards}
        onSpreadChange={setSpreadId}
        onInspectCard={handleInspectCard}
        onOpenDrawer={handleOpenDrawer}
        onOpenClothSheet={handleOpenClothSheet}
        onOpenDeckSheet={handleOpenDeckSheet}
        onOpenDeckPoolModal={handleOpenDeckPoolModal}
        onResetTable={handleResetTable}
        querentFacing={querentFacing}
        onToggleQuerentFacing={handleToggleQuerentFacing}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        canFullscreen={canFullscreen}
        wakeLockActive={wakeLockActive}
        onExit={handleExit}
      />

      <DeckPoolModal
        open={deckPoolOpen}
        value={prefs.deckPool}
        minRequiredCards={activeSpreadMeta?.cardCount ?? 1}
        spreadLabel={activeSpreadMeta?.nameZh ?? "自由排布"}
        soundEnabled={prefs.soundEnabled}
        onApply={handleApplyDeckPool}
        onClose={handleCloseDeckPoolModal}
      />

      <TableReadingDrawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        placedCards={placedCards}
        spreadId={spreadId}
        category={category}
        onCategoryChange={setCategory}
        question={question}
        onQuestionChange={setQuestion}
        deckId={deck.id}
        themeId={theme.id}
        soundEnabled={prefs.soundEnabled}
        querentFacing={querentFacing}
        onToggleQuerentFacing={handleToggleQuerentFacing}
        onInspectCard={handleInspectCard}
        onRevealAll={handleRevealAll}
        savedRecordId={savedRecordId}
        aiInterpretation={aiInterpretation}
        onAiComplete={handleAiComplete}
        onSaveHistory={handleSaveHistory}
      />

      <CardInspectorModal
        card={inspectTarget?.card ?? null}
        reversed={inspectTarget?.reversed ?? false}
        deckId={deck.id}
        themeId={theme.id}
        gyroEnabled={prefs.gyroEnabled}
        soundEnabled={prefs.soundEnabled}
        onDeckChange={setDeckId}
        onClose={handleCloseInspector}
      />
    </div>
  );
}
