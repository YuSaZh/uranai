"use client";

import React, { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sparkles,
  Compass,
  BookOpen,
  ScrollText,
  SlidersHorizontal,
  Layers,
  Palette,
  Check,
  X,
} from "lucide-react";
import { useUranai } from "@/context/UranaiProvider";
import { THEMES } from "@/data/themes";
import { DECKS, getCardImagePath } from "@/data/decks";
import { ClothStage } from "@/components/tarot/ClothStage";
import { soundEngine } from "@/lib/sound";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "今日", icon: Sparkles },
  { href: "/reading", label: "占卜", icon: Compass },
  { href: "/gallery", label: "图鉴", icon: BookOpen },
  { href: "/history", label: "记录", icon: ScrollText },
  { href: "/settings", label: "设置", icon: SlidersHorizontal },
];

type QuickSheetMode = "cloth" | "deck" | null;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { theme, deck, prefs, setThemeId, setDeckId } = useUranai();
  const [sheet, setSheet] = useState<QuickSheetMode>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheet(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const shortDeckLabel = deck.id === "mucha-hamster" ? "穆夏仓鼠" : "伟特";
  const shortClothLabel = theme.nameZh.slice(0, 4);

  return (
    <div className="relative min-h-dvh w-full text-[var(--text-primary)]">
      {/* Persistent full-bleed reading cloth stage */}
      <ClothStage theme={theme} />

      {/* Top frosted luxury header */}
      <header className="pt-safe sticky top-0 z-30 w-full px-3 sm:px-5">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between rounded-2xl px-3.5 uranai-glass sm:px-5">
          <Link
            href="/"
            className="group flex items-center gap-2.5 focus:outline-none"
          >
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-[0_0_16px_var(--cloth-glow)] transition-transform duration-300 group-hover:scale-105">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 fill-current"
                aria-hidden="true"
              >
                <path d="M12 1.8l2.15 7.05L21.2 11l-7.05 2.15L12 20.2l-2.15-7.05L2.8 11l7.05-2.15L12 1.8z" />
              </svg>
            </span>
            <div className="flex flex-col leading-none">
              <span className="font-display text-sm font-semibold tracking-[0.26em] text-[var(--text-primary)] sm:text-[0.95rem]">
                URANAI
              </span>
              <span className="mt-0.5 text-[10px] tracking-[0.14em] text-[var(--text-muted)]">
                星穹塔罗
              </span>
            </div>
          </Link>

          {/* 1-tap quick Cloth & Deck pills */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                soundEngine.playHoverTick(prefs.soundEnabled);
                setSheet((prev) => (prev === "cloth" ? null : "cloth"));
              }}
              aria-label="切换占卜桌布"
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition active:scale-95 sm:px-3 ${
                sheet === "cloth"
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 text-[var(--text-secondary)] hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]"
              }`}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/30 shadow-sm"
                style={{
                  background: `linear-gradient(135deg, ${theme.swatches[1]}, ${theme.swatches[2]})`,
                }}
              />
              <span className="max-w-[4.5rem] truncate">{shortClothLabel}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playHoverTick(prefs.soundEnabled);
                setSheet((prev) => (prev === "deck" ? null : "deck"));
              }}
              aria-label="切换塔罗卡组"
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition active:scale-95 sm:px-3 ${
                sheet === "deck"
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 text-[var(--text-secondary)] hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Layers className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span>{shortDeckLabel}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main page container */}
      <main className="relative z-10 mx-auto w-full max-w-4xl px-4 pt-5 pb-32 sm:px-6 sm:pt-7 sm:pb-36">
        {children}
      </main>

      {/* Floating mobile-first bottom navigation dock */}
      <nav
        aria-label="主导航"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))]"
      >
        <div className="pointer-events-auto flex w-full max-w-md items-center justify-around rounded-[1.6rem] p-1.5 uranai-glass-strong">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => soundEngine.playHoverTick(prefs.soundEnabled)}
                className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl py-2 text-[11px] font-medium transition-colors ${
                  active
                    ? "text-[var(--accent-strong)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="uranai-nav-pill"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    className="absolute inset-0.5 rounded-2xl border border-[var(--border-accent)] bg-[var(--accent-soft)] shadow-[0_0_20px_var(--cloth-glow)]"
                  />
                )}
                <Icon className="relative z-10 h-[18px] w-[18px]" />
                <span className="relative z-10 tracking-wide">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Quick Cloth / Deck Frosted Bottom Sheet & Popover */}
      <AnimatePresence>
        {sheet !== null && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSheet(null)}
              className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 32, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
              className="uranai-glass-strong relative z-10 w-full max-w-lg rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl sm:p-6"
            >
              {/* Drag handle indicator on mobile */}
              <div className="mx-auto mb-3.5 h-1 w-10 rounded-full bg-[var(--border-accent)] opacity-60 sm:hidden" />

              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent)]">
                    {sheet === "cloth" ? (
                      <Palette className="h-4 w-4" />
                    ) : (
                      <Layers className="h-4 w-4" />
                    )}
                  </span>
                  <div>
                    <h2 className="font-display text-base font-semibold tracking-wide text-[var(--text-primary)]">
                      {sheet === "cloth" ? "更换占卜桌布" : "切换塔罗卡组"}
                    </h2>
                    <p className="text-xs text-[var(--text-muted)]">
                      {sheet === "cloth"
                        ? "实时切换织物氛围、星尘光影与殿堂色调"
                        : "自由穿梭于古典韦特与新艺术原创牌组之间"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSheet(null)}
                  aria-label="关闭面板"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] text-[var(--text-muted)] transition hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {sheet === "cloth" ? (
                <div className="space-y-2.5">
                  {THEMES.map((preset) => {
                    const isSelected = preset.id === theme.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          soundEngine.playHoverTick(prefs.soundEnabled);
                          setThemeId(preset.id);
                        }}
                        className={`flex w-full items-center gap-3.5 rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                          isSelected
                            ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_0_24px_var(--cloth-glow)]"
                            : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/75 hover:border-[var(--border-accent)]"
                        }`}
                      >
                        {/* Swatch medallion */}
                        <div className="flex shrink-0 items-center -space-x-1.5">
                          {preset.swatches.slice(0, 3).map((hex, idx) => (
                            <span
                              key={idx}
                              className="h-7 w-7 rounded-full border border-white/25 shadow-md"
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-display text-sm font-semibold text-[var(--text-primary)]">
                              {preset.nameZh}
                            </span>
                            <span className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                              {preset.clothNameZh}
                            </span>
                          </div>
                          <p className="mt-0.5 line-clamp-1 text-xs text-[var(--text-secondary)]">
                            {preset.tagline}
                          </p>
                        </div>

                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                            isSelected
                              ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]"
                              : "border-[var(--border-subtle)]"
                          }`}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {DECKS.map((item) => {
                    const isSelected = item.id === deck.id;
                    const previewImg =
                      getCardImagePath(item.id, "00-the-fool") ||
                      item.backImage ||
                      "/decks/rws/00-the-fool.webp";

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          soundEngine.playCardFlip(prefs.soundEnabled);
                          setDeckId(item.id);
                          setSheet(null);
                        }}
                        className={`group flex flex-col justify-between rounded-2xl border p-3.5 text-left transition active:scale-[0.99] ${
                          isSelected
                            ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_0_24px_var(--cloth-glow)]"
                            : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/75 hover:border-[var(--border-accent)]"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`relative h-20 ${item.aspectClass} shrink-0 overflow-hidden rounded-lg border border-[var(--border-accent)] bg-black/30 shadow-md`}
                          >
                            <img
                              src={previewImg}
                              alt={item.nameZh}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-display text-sm font-semibold text-[var(--text-primary)]">
                                {item.nameZh}
                              </span>
                              {isSelected && (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-contrast)]">
                                  <Check className="h-3 w-3" />
                                </span>
                              )}
                            </div>
                            <span className="mt-1 inline-block rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent-strong)]">
                              {item.badge}
                            </span>
                            <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                              {item.subtitle}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
