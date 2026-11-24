"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  Download,
  Upload,
  ChevronDown,
  Trash2,
  Sparkles,
  Compass,
  Cloud,
  HardDrive,
  FileText,
  Check,
  AlertCircle,
} from "lucide-react";
import { useUranai } from "@/context/UranaiProvider";
import { getCardById } from "@/data/tarot-cards";
import { getCategoryById, getSpreadById } from "@/data/spreads";
import { getThemeById } from "@/data/themes";
import { getCardImagePath, getDeckAspectClass } from "@/data/decks";
import {
  exportReadingsToJson,
  getLocalDateKey,
  parseImportedReadings,
} from "@/lib/storage";
import { soundEngine } from "@/lib/sound";
import { CardInspectorModal } from "@/components/tarot/CardInspectorModal";
import { TarotMarkdown } from "@/components/reading/AiInterpretationPanel";
import type { DeckId, ReadingRecord, TarotCard } from "@/types/tarot";

type HistoryFilter = "all" | "daily" | "spread";

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}年${m}月${d}日 ${hh}:${mm}`;
}

export default function HistoryPage() {
  const {
    readings,
    prefs,
    theme,
    syncState,
    hydrated,
    updateReading,
    deleteReading,
    importReadings,
    setDeckId,
  } = useUranai();

  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [inspectTarget, setInspectTarget] = useState<{
    card: TarotCard;
    reversed: boolean;
    deckId: DeckId;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const noteTimerRef = useRef<number | null>(null);

  const stats = useMemo(() => {
    const dailyCount = readings.filter((r) => r.mode === "daily").length;
    const spreadCount = readings.filter((r) => r.mode === "spread").length;
    return { total: readings.length, dailyCount, spreadCount };
  }, [readings]);

  const filteredReadings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return readings.filter((record) => {
      if (filter !== "all" && record.mode !== filter) return false;
      if (!q) return true;

      const spread = getSpreadById(record.spreadId);
      const category = getCategoryById(record.category);
      const cardMatches = record.cards.some((dc) => {
        const card = getCardById(dc.cardId);
        if (!card) return false;
        return (
          card.nameZh.toLowerCase().includes(q) ||
          card.nameEn.toLowerCase().includes(q)
        );
      });

      return (
        record.question.toLowerCase().includes(q) ||
        (record.notes?.toLowerCase().includes(q) ?? false) ||
        spread.nameZh.toLowerCase().includes(q) ||
        category.nameZh.toLowerCase().includes(q) ||
        cardMatches
      );
    });
  }, [filter, readings, searchQuery]);

  const handleExport = () => {
    const json = exportReadingsToJson(readings);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `uranai-readings-${getLocalDateKey()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    soundEngine.playHoverTick(prefs.soundEnabled);
    setStatusBanner({
      type: "success",
      text: `已导出 ${readings.length} 条占卜记录到本地 JSON 文件。`,
    });
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseImportedReadings(text);
      if (!parsed.ok) {
        setStatusBanner({ type: "error", text: parsed.error });
        return;
      }

      const importedCount = importReadings(parsed.readings);
      soundEngine.playChime(prefs.soundEnabled);
      setStatusBanner({
        type: "success",
        text: `成功导入并合并 ${importedCount} 条占卜记录。`,
      });
    } catch {
      setStatusBanner({ type: "error", text: "读取导入文件失败，请稍后重试。" });
    }
  };

  const handleNoteChange = (record: ReadingRecord, nextNotes: string) => {
    updateReading(record.id, { notes: nextNotes });
    setSavedNoteId(record.id);
    if (noteTimerRef.current) window.clearTimeout(noteTimerRef.current);
    noteTimerRef.current = window.setTimeout(() => setSavedNoteId(null), 1600);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="font-display text-xs tracking-[0.26em] text-[var(--accent)] uppercase">
            Divination Chronicle
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-wide text-[var(--text-primary)] sm:text-3xl">
            占卜历史卷轴
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            珍藏每一次与星穹的对话，随时回溯牌阵、AI 解读与个人复盘笔记。
          </p>
        </div>

        {/* Export / Import */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={readings.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-glass)] px-3.5 py-2 text-xs font-medium text-[var(--text-secondary)] backdrop-blur-md transition hover:border-[var(--border-accent)] hover:text-[var(--text-primary)] disabled:opacity-45"
          >
            <Download className="h-3.5 w-3.5 text-[var(--accent)]" />
            导出 JSON
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-3.5 py-2 text-xs font-medium text-[var(--accent-strong)] transition hover:brightness-110 active:scale-95"
          >
            <Upload className="h-3.5 w-3.5" />
            导入备份
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>
      </header>

      {/* Summary Stats Strip */}
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="uranai-glass rounded-2xl p-3.5">
          <div className="text-[11px] text-[var(--text-muted)]">全部记录</div>
          <div className="font-display mt-1 text-2xl font-semibold text-[var(--text-primary)]">
            {hydrated ? stats.total : "—"}
          </div>
        </div>
        <div className="uranai-glass rounded-2xl p-3.5">
          <div className="text-[11px] text-[var(--text-muted)]">每日神谕</div>
          <div className="font-display mt-1 text-2xl font-semibold text-[var(--accent-strong)]">
            {hydrated ? stats.dailyCount : "—"}
          </div>
        </div>
        <div className="uranai-glass rounded-2xl p-3.5">
          <div className="text-[11px] text-[var(--text-muted)]">问题牌阵</div>
          <div className="font-display mt-1 text-2xl font-semibold text-[var(--text-primary)]">
            {hydrated ? stats.spreadCount : "—"}
          </div>
        </div>
        <div className="uranai-glass flex flex-col justify-between rounded-2xl p-3.5">
          <div className="text-[11px] text-[var(--text-muted)]">同步状态</div>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--accent-strong)]">
            {syncState === "synced" || syncState === "syncing" ? (
              <Cloud className="h-4 w-4 shrink-0" />
            ) : (
              <HardDrive className="h-4 w-4 shrink-0" />
            )}
            <span>
              {syncState === "synced"
                ? "Supabase 云同步"
                : syncState === "syncing"
                  ? "正在同步…"
                  : syncState === "error"
                    ? "同步暂遇异常"
                    : "本地安全存储"}
            </span>
          </div>
        </div>
      </section>

      {/* Status banner */}
      {statusBanner && (
        <div
          className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-xs ${
            statusBanner.type === "success"
              ? "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--text-primary)]"
              : "border-rose-400/40 bg-rose-950/30 text-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusBanner.type === "success" ? (
              <Check className="h-4 w-4 text-[var(--accent)]" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-300" />
            )}
            <span>{statusBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-[11px] opacity-75 hover:opacity-100"
          >
            关闭
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {(
            [
              { id: "all", label: `全部 (${stats.total})` },
              { id: "daily", label: `每日占卜 (${stats.dailyCount})` },
              { id: "spread", label: `问题牌阵 (${stats.spreadCount})` },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                filter === item.id
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-glass)] text-[var(--text-secondary)] hover:border-[var(--border-accent)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索问题、牌名或复盘笔记…"
            className="w-full rounded-full border border-[var(--border-subtle)] bg-[var(--bg-glass)] py-2 pr-4 pl-10 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] backdrop-blur-md focus:border-[var(--accent)] focus:outline-none"
          />
        </div>
      </section>

      {/* Readings Chronicle List */}
      {!hydrated ? (
        <div className="space-y-3">
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              className="uranai-glass h-28 animate-pulse rounded-3xl"
            />
          ))}
        </div>
      ) : filteredReadings.length === 0 ? (
        <div className="uranai-glass flex flex-col items-center justify-center rounded-3xl px-6 py-14 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent)]">
            <FileText className="h-5 w-5" />
          </span>
          <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
            {readings.length === 0 ? "尚无占卜卷轴记录" : "未找到匹配的记录"}
          </h2>
          <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-[var(--text-secondary)]">
            {readings.length === 0
              ? "完成一次每日一牌抽取或自定义问题牌阵后，所有牌面与解读将自动镌刻于此。"
              : "尝试更换筛选标签或清空关键词重新检索。"}
          </p>
          {readings.length === 0 && (
            <div className="mt-5 flex flex-wrap justify-center gap-2.5">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--accent-contrast)]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                抽取今日神谕
              </Link>
              <Link
                href="/reading"
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-4 py-2 text-xs font-medium text-[var(--accent-strong)]"
              >
                <Compass className="h-3.5 w-3.5" />
                开启问题占卜
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredReadings.map((record) => {
            const isExpanded = expandedId === record.id;
            const spread = getSpreadById(record.spreadId);
            const category = getCategoryById(record.category);
            const recordTheme = getThemeById(record.themeId);
            const titleText =
              record.question.trim() ||
              (record.mode === "daily" ? "今日神谕指引" : `${spread.nameZh}占卜`);

            return (
              <article
                key={record.id}
                className="uranai-glass overflow-hidden rounded-3xl transition-colors"
              >
                {/* Header Summary */}
                <div className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span>{formatTimestamp(record.createdAt)}</span>
                      <span>·</span>
                      <span className="rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent-strong)]">
                        {record.mode === "daily" ? "每日神谕" : spread.nameZh}
                      </span>
                      {record.mode === "spread" && (
                        <span className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                          {category.icon} {category.nameZh}
                        </span>
                      )}
                    </div>

                    {/* Active cloth swatch pill */}
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/75 px-2.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: recordTheme.swatches[2] }}
                      />
                      {recordTheme.nameZh}
                    </span>
                  </div>

                  {/* Question & Expand Trigger */}
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playHoverTick(prefs.soundEnabled);
                      setExpandedId(isExpanded ? null : record.id);
                      setConfirmDeleteId(null);
                    }}
                    className="mt-2.5 flex w-full items-start justify-between gap-3 text-left"
                  >
                    <h2 className="font-display text-base font-semibold leading-snug text-[var(--text-primary)] sm:text-lg">
                      {titleText}
                    </h2>
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-300 ${
                          isExpanded ? "rotate-180 text-[var(--accent)]" : ""
                        }`}
                      />
                    </span>
                  </button>

                  {/* Mini Drawn Card Thumbnails (Tap any to inspect in 3D!) */}
                  <div className="mt-3.5 flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                    {record.cards.map((dc) => {
                      const card = getCardById(dc.cardId);
                      if (!card) return null;
                      const slot = spread.slots[dc.slotIndex];
                      const imgUrl = getCardImagePath(record.deckId, card.slug);

                      return (
                        <button
                          key={`${record.id}-${dc.slotIndex}-${dc.cardId}`}
                          type="button"
                          onClick={() => {
                            soundEngine.playHoverTick(prefs.soundEnabled);
                            setInspectTarget({
                              card,
                              reversed: dc.reversed,
                              deckId: record.deckId,
                            });
                          }}
                          className="group flex shrink-0 items-center gap-2.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/75 p-1.5 pr-3 text-left transition hover:border-[var(--border-accent)] active:scale-95"
                        >
                          <div
                            className={`relative h-14 ${getDeckAspectClass(record.deckId)} shrink-0 overflow-hidden rounded-lg border border-[var(--border-accent)] bg-black/35`}
                          >
                            {imgUrl ? (
                              <img
                                src={imgUrl}
                                alt={card.nameZh}
                                className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                                  dc.reversed ? "rotate-180" : ""
                                }`}
                              />
                            ) : (
                              <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-[#2b2012] to-[#120d08] text-[9px] text-[var(--accent)]">
                                <span>✦</span>
                                <span className="font-display">
                                  {card.romanNumeral || card.number}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            {slot && record.mode === "spread" && (
                              <div className="text-[10px] text-[var(--text-muted)]">
                                {dc.slotIndex + 1}. {slot.labelZh}
                              </div>
                            )}
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-[var(--text-primary)]">
                                {card.nameZh}
                              </span>
                              <span
                                className={`rounded px-1 py-0.5 text-[9px] font-medium ${
                                  dc.reversed
                                    ? "bg-rose-500/20 text-rose-300"
                                    : "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                                }`}
                              >
                                {dc.reversed ? "逆位" : "正位"}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Expandable Details: AI Reading + Personal Reflection Notes + Delete */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden border-t border-[var(--border-subtle)]"
                    >
                      <div className="space-y-4 bg-[var(--bg-surface)]/45 p-4 sm:p-5">
                        {/* AI Interpretation */}
                        {record.aiInterpretation ? (
                          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/45 p-4">
                            <div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-[var(--accent)]">
                              <Sparkles className="h-3.5 w-3.5" />
                              AI 深度推理解读存档
                            </div>
                            <TarotMarkdown content={record.aiInterpretation} />
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-3 text-xs text-[var(--text-muted)]">
                            本次占卜尚未生成 AI 综合推理解读。点击上方任意牌面缩略图可打开 3D 鉴赏卡义。
                          </div>
                        )}

                        {/* Editable Personal Reflection Notes */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label
                              htmlFor={`notes-${record.id}`}
                              className="text-xs font-medium text-[var(--text-secondary)]"
                            >
                              个人复盘笔记
                            </label>
                            {savedNoteId === record.id && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                                <Check className="h-3 w-3" />
                                已自动保存
                              </span>
                            )}
                          </div>
                          <textarea
                            id={`notes-${record.id}`}
                            rows={3}
                            value={record.notes ?? ""}
                            onChange={(e) => handleNoteChange(record, e.target.value)}
                            placeholder="记录当时的心境、后续应验的细节或灵感觉察…"
                            className="w-full resize-y rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/65 px-3.5 py-2.5 text-xs leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                          />
                        </div>

                        {/* Delete Action */}
                        <div className="flex items-center justify-end gap-2 pt-1">
                          {confirmDeleteId === record.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded-full border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-[var(--text-secondary)]"
                              >
                                取消
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  deleteReading(record.id);
                                  setConfirmDeleteId(null);
                                  setExpandedId(null);
                                }}
                                className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-rose-500"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                确认删除
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(record.id)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition hover:border-rose-400/50 hover:text-rose-300"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              删除记录
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </article>
            );
          })}
        </div>
      )}

      {/* Full 3D Card Inspector Modal */}
      <CardInspectorModal
        card={inspectTarget?.card ?? null}
        reversed={inspectTarget?.reversed ?? false}
        deckId={inspectTarget?.deckId ?? prefs.deckId}
        themeId={theme.id}
        gyroEnabled={prefs.gyroEnabled}
        soundEnabled={prefs.soundEnabled}
        onDeckChange={(nextDeckId) => {
          setDeckId(nextDeckId);
          setInspectTarget((prev) =>
            prev ? { ...prev, deckId: nextDeckId } : null
          );
        }}
        onClose={() => setInspectTarget(null)}
      />
    </div>
  );
}
