"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  Flame,
  Frame,
  Moon,
  RotateCcw,
  Sparkles,
  Sun,
  Wand2,
} from "lucide-react";
import type {
  ClothDetailSettings,
  ClothLightingId,
  ClothMaterialId,
  ClothMotifId,
  ThemePreset,
} from "@/types/tarot";
import {
  CLOTH_LIGHTINGS,
  CLOTH_MATERIALS,
  CLOTH_MOTIFS,
  CLOTH_REALISM_PRESETS,
  DEFAULT_CLOTH_DETAIL,
  getProceduralFabricTiles,
  type GeneratedMaterialTiles,
} from "@/lib/cloth-textures";
import { soundEngine } from "@/lib/sound";

export interface ClothDetailControlsProps {
  theme: ThemePreset;
  detail: ClothDetailSettings;
  soundEnabled: boolean;
  compact?: boolean;
  onChange: (patch: Partial<ClothDetailSettings>) => void;
  onApplyPreset: (settings: ClothDetailSettings) => void;
}

function isSameDetail(a: ClothDetailSettings, b: ClothDetailSettings): boolean {
  return (
    a.material === b.material &&
    a.textureIntensity === b.textureIntensity &&
    a.foldDepth === b.foldDepth &&
    a.motif === b.motif &&
    a.motifOpacity === b.motifOpacity &&
    a.lighting === b.lighting &&
    a.vignetteStrength === b.vignetteStrength &&
    a.goldTrim === b.goldTrim &&
    a.interactiveSheen === b.interactiveSheen &&
    a.particleDensity === b.particleDensity
  );
}

function LightingIcon({
  id,
  className,
}: {
  id: ClothLightingId;
  className?: string;
}) {
  if (id === "candlelight") return <Flame className={className} />;
  if (id === "moonlight") return <Moon className={className} />;
  if (id === "spotlight") return <Sun className={className} />;
  return <Sparkles className={className} />;
}

interface SliderRowProps {
  label: string;
  hint: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}

function SliderRow({ label, hint, value, disabled, onChange }: SliderRowProps) {
  return (
    <div
      className={`space-y-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/65 px-3 py-2.5 transition-opacity ${
        disabled ? "opacity-45" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="text-xs font-medium text-[var(--text-primary)]">
            {label}
          </span>
          <span className="ml-2 hidden text-[11px] text-[var(--text-muted)] sm:inline">
            {hint}
          </span>
        </div>
        <span className="shrink-0 rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--accent-strong)]">
          {value}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="uranai-range w-full"
      />
    </div>
  );
}

export function ClothDetailControls({
  theme,
  detail,
  soundEnabled,
  compact = false,
  onChange,
  onApplyPreset,
}: ClothDetailControlsProps) {
  const [tileMap, setTileMap] = useState<
    Partial<Record<ClothMaterialId, GeneratedMaterialTiles>>
  >({});

  // Pre-generate tiny cached procedural tiles for all 5 fabric swatches on client mount
  useEffect(() => {
    const next: Partial<Record<ClothMaterialId, GeneratedMaterialTiles>> = {};
    for (const m of CLOTH_MATERIALS) {
      const generated = getProceduralFabricTiles(m.id, theme.isLight);
      if (generated) next[m.id] = generated;
    }
    setTileMap(next);
  }, [theme.isLight]);

  const activeTiles = tileMap[detail.material];
  const activeMaterial = useMemo(
    () =>
      CLOTH_MATERIALS.find((m) => m.id === detail.material) ??
      CLOTH_MATERIALS[0],
    [detail.material]
  );
  const activeLighting = useMemo(
    () =>
      CLOTH_LIGHTINGS.find((l) => l.id === detail.lighting) ??
      CLOTH_LIGHTINGS[0],
    [detail.lighting]
  );

  const clothGradient =
    theme.cssVars["--cloth-gradient"] ?? theme.cssVars["--bg-base"] ?? "#110f1d";
  const accentColor = theme.cssVars["--accent"] ?? "#d4af37";
  const textureScale = detail.textureIntensity / 100;
  const foldScale = detail.foldDepth / 100;
  const vignetteScale = detail.vignetteStrength / 100;

  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      {/* 1. Live Fabric Macro Swatch Preview */}
      <div
        className={`relative overflow-hidden rounded-2xl border border-[var(--border-accent)] shadow-inner ${
          compact ? "h-24" : "h-32 sm:h-36"
        }`}
        style={{ background: clothGradient }}
      >
        {/* Procedural Weave */}
        {activeTiles && (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("${activeTiles.weaveUrl}")`,
              backgroundRepeat: "repeat",
              backgroundSize: `${Math.round(activeMaterial.tileSize * 0.78)}px ${Math.round(activeMaterial.tileSize * 0.78)}px`,
              opacity: textureScale * (theme.isLight ? 0.54 : 0.68),
              mixBlendMode: "hard-light",
            }}
          />
        )}
        {/* Crushed Nap Clouds */}
        {activeTiles && (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("${activeTiles.cloudUrl}")`,
              backgroundRepeat: "repeat",
              backgroundSize: "320px 320px",
              opacity: textureScale * 0.42,
              mixBlendMode: "hard-light",
            }}
          />
        )}
        {/* 3D Drape Folds */}
        {foldScale > 0.01 && (
          <div
            className="absolute inset-0"
            style={{
              opacity: foldScale * 0.5,
              mixBlendMode: "hard-light",
              background:
                "linear-gradient(124deg, rgba(0,0,0,0.46) 0%, rgba(255,255,255,0.24) 18%, rgba(0,0,0,0.34) 36%, rgba(255,255,255,0.18) 54%, rgba(0,0,0,0.36) 76%, rgba(255,255,255,0.2) 92%, rgba(0,0,0,0.44) 100%)",
            }}
          />
        )}
        {/* Lighting Pool */}
        <div
          className="absolute inset-0"
          style={{
            background:
              detail.lighting === "candlelight"
                ? "radial-gradient(ellipse 65% 75% at 48% 45%, rgba(255,200,110,0.28) 0%, transparent 74%)"
                : detail.lighting === "moonlight"
                  ? "radial-gradient(ellipse 75% 70% at 22% 18%, rgba(175,212,255,0.28) 0%, transparent 76%)"
                  : detail.lighting === "spotlight"
                    ? "radial-gradient(circle at 50% 50%, rgba(255,244,212,0.24) 0%, rgba(0,0,0,0.52) 86%)"
                    : "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.08) 0%, transparent 75%)",
          }}
        />
        {/* Miniature Motif Ring */}
        {detail.motif !== "minimal" && detail.motifOpacity > 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <svg
              viewBox="0 0 120 120"
              className="h-24 w-24"
              style={{
                color: accentColor,
                opacity: (detail.motifOpacity / 100) * 0.45,
                filter: "drop-shadow(0 1px 1.2px rgba(0,0,0,0.7))",
              }}
            >
              <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <circle
                cx="60"
                cy="60"
                r="42"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.7"
                strokeDasharray="3 4"
              />
              <circle cx="60" cy="60" r="24" fill="none" stroke="currentColor" strokeWidth="0.9" />
              <rect
                x="34"
                y="34"
                width="52"
                height="52"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.75"
                transform="rotate(45 60 60)"
              />
            </svg>
          </div>
        )}
        {/* Gold Trim Preview */}
        {detail.goldTrim && (
          <div
            className="pointer-events-none absolute inset-2 rounded-xl"
            style={{
              border: `1px solid ${accentColor}58`,
            }}
          >
            <div
              className="absolute inset-1 rounded-lg"
              style={{ border: `1px dashed ${accentColor}48` }}
            />
          </div>
        )}
        {/* Vignette Preview */}
        {vignetteScale > 0.01 && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: theme.isLight
                ? `radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(86,62,32,${(0.32 * vignetteScale).toFixed(3)}) 100%)`
                : `radial-gradient(ellipse at 50% 50%, transparent 42%, rgba(0,0,0,${(0.75 * vignetteScale).toFixed(3)}) 100%)`,
            }}
          />
        )}

        {/* Overlay Info Badges */}
        <div className="relative z-10 flex h-full flex-col justify-between p-3">
          <div className="flex items-start justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
              <Wand2 className="h-3 w-3 text-[#f0d27a]" />
              实时材质预览 · {activeMaterial.nameZh}
            </span>
            <button
              type="button"
              onClick={() => {
                soundEngine.playHoverTick(soundEnabled);
                onApplyPreset(DEFAULT_CLOTH_DETAIL);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/45 px-2.5 py-1 text-[11px] text-white/90 backdrop-blur-md transition hover:bg-black/65 active:scale-95"
            >
              <RotateCcw className="h-3 w-3" />
              恢复默认
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-white/90">
            <span className="rounded-full bg-black/45 px-2 py-0.5 backdrop-blur-sm">
              纹理 {detail.textureIntensity}%
            </span>
            <span className="rounded-full bg-black/45 px-2 py-0.5 backdrop-blur-sm">
              褶皱 {detail.foldDepth}%
            </span>
            <span className="rounded-full bg-black/45 px-2 py-0.5 backdrop-blur-sm">
              {activeLighting.nameZh}
            </span>
            {detail.goldTrim && (
              <span className="rounded-full bg-black/45 px-2 py-0.5 backdrop-blur-sm">
                金线锁边
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. One-Tap Realism Presets */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wide text-[var(--text-primary)]">
            一键拟真桌布方案
          </span>
          <span className="text-[11px] text-[var(--text-muted)]">
            快速切换高阶搭配
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CLOTH_REALISM_PRESETS.map((preset) => {
            const active = isSameDetail(detail, preset.settings);
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  soundEngine.playChime(soundEnabled);
                  onApplyPreset(preset.settings);
                }}
                className={`flex flex-col rounded-xl border px-3 py-2 text-left transition active:scale-[0.98] ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_0_16px_var(--cloth-glow)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 hover:border-[var(--border-accent)]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    {preset.nameZh}
                  </span>
                  {active && (
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-contrast)]">
                      <Check className="h-2.5 w-2.5" />
                    </span>
                  )}
                </div>
                <span className="mt-0.5 line-clamp-1 text-[10px] text-[var(--text-muted)]">
                  {preset.tagline}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Fabric Material Selector with Live Micro-Weave Thumbnails */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wide text-[var(--text-primary)]">
            织物肌理材质
          </span>
          <span className="text-[11px] text-[var(--text-muted)]">
            {activeMaterial.desc}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {CLOTH_MATERIALS.map((mat) => {
            const active = detail.material === mat.id;
            const matTiles = tileMap[mat.id];
            return (
              <button
                key={mat.id}
                type="button"
                onClick={() => {
                  soundEngine.playHoverTick(soundEnabled);
                  onChange({ material: mat.id });
                }}
                className={`group flex flex-col overflow-hidden rounded-xl border p-2 text-left transition active:scale-[0.98] ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]/60"
                    : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 hover:border-[var(--border-accent)]"
                }`}
              >
                <div
                  className="relative mb-2 h-11 w-full overflow-hidden rounded-lg border border-white/15"
                  style={{ background: clothGradient }}
                >
                  {matTiles && (
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `url("${matTiles.weaveUrl}")`,
                        backgroundRepeat: "repeat",
                        backgroundSize: `${Math.round(mat.tileSize * 0.6)}px ${Math.round(mat.tileSize * 0.6)}px`,
                        opacity: theme.isLight ? 0.56 : 0.72,
                        mixBlendMode: "hard-light",
                      }}
                    />
                  )}
                  {matTiles && (
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `url("${matTiles.cloudUrl}")`,
                        backgroundRepeat: "repeat",
                        backgroundSize: "180px 180px",
                        opacity: 0.34,
                        mixBlendMode: "hard-light",
                      }}
                    />
                  )}
                  {active && (
                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] shadow">
                      <Check className="h-2.5 w-2.5" />
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  {mat.nameZh}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  {mat.nameEn}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Embroidered Altar Motif & Tabletop Lighting */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {/* Motif */}
        <div className="space-y-2">
          <span className="block text-xs font-semibold tracking-wide text-[var(--text-primary)]">
            金线刺绣图腾
          </span>
          <div className="flex flex-wrap gap-1.5">
            {CLOTH_MOTIFS.map((m) => {
              const active = detail.motif === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  title={m.desc}
                  onClick={() => {
                    soundEngine.playHoverTick(soundEnabled);
                    const nextPatch: Partial<ClothDetailSettings> = {
                      motif: m.id as ClothMotifId,
                    };
                    if (m.id !== "minimal" && detail.motifOpacity === 0) {
                      nextPatch.motifOpacity = 55;
                    }
                    onChange(nextPatch);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 text-[var(--text-secondary)] hover:border-[var(--border-accent)]"
                  }`}
                >
                  {m.nameZh}
                </button>
              );
            })}
          </div>
        </div>

        {/* Lighting */}
        <div className="space-y-2">
          <span className="block text-xs font-semibold tracking-wide text-[var(--text-primary)]">
            桌面环境光照
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {CLOTH_LIGHTINGS.map((light) => {
              const active = detail.lighting === light.id;
              return (
                <button
                  key={light.id}
                  type="button"
                  title={light.desc}
                  onClick={() => {
                    soundEngine.playHoverTick(soundEnabled);
                    onChange({ lighting: light.id });
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition active:scale-95 ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 text-[var(--text-secondary)] hover:border-[var(--border-accent)]"
                  }`}
                >
                  <LightingIcon id={light.id} className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{light.nameZh}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. Five Precision Tactile Realism Sliders */}
      <div className="space-y-2">
        <span className="block text-xs font-semibold tracking-wide text-[var(--text-primary)]">
          拟真光学与质感精调
        </span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <SliderRow
            label="织物纹理质感"
            hint="绒毛 / 经纬纤维清晰度"
            value={detail.textureIntensity}
            onChange={(v) => onChange({ textureIntensity: v })}
          />
          <SliderRow
            label="立体褶皱垂坠"
            hint="桌布铺展起伏明暗"
            value={detail.foldDepth}
            onChange={(v) => onChange({ foldDepth: v })}
          />
          <SliderRow
            label="刺绣暗纹显影"
            hint="金线图腾浮雕浓度"
            value={detail.motifOpacity}
            disabled={detail.motif === "minimal"}
            onChange={(v) => onChange({ motifOpacity: v })}
          />
          <SliderRow
            label="桌缘暗角氛围"
            hint="四周深邃聚光压暗"
            value={detail.vignetteStrength}
            onChange={(v) => onChange({ vignetteStrength: v })}
          />
          <div className="sm:col-span-2">
            <SliderRow
              label="星尘浮光粒子"
              hint="桌布上方漂浮的星尘、萤火或纸尘密度（0% 完全关闭）"
              value={detail.particleDensity}
              onChange={(v) => onChange({ particleDensity: v })}
            />
          </div>
        </div>
      </div>

      {/* 6. Tactile Finish Toggles */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          role="switch"
          aria-checked={detail.goldTrim}
          onClick={() => {
            soundEngine.playHoverTick(soundEnabled);
            onChange({ goldTrim: !detail.goldTrim });
          }}
          className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 px-3 py-2.5 text-left transition hover:border-[var(--border-accent)]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Frame className="h-4 w-4 shrink-0 text-[var(--accent)]" />
            <div className="min-w-0">
              <div className="text-xs font-medium text-[var(--text-primary)]">
                桌布金线锁边与四角星徽
              </div>
              <div className="truncate text-[10px] text-[var(--text-muted)]">
                祭坛边沿手工金丝双线车缝与角饰
              </div>
            </div>
          </div>
          <span
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
              detail.goldTrim
                ? "border-[var(--accent)] bg-[var(--accent)]"
                : "border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full shadow transition-transform ${
                detail.goldTrim
                  ? "translate-x-5.5 bg-[var(--accent-contrast)]"
                  : "translate-x-1 bg-[var(--text-muted)]"
              }`}
            />
          </span>
        </button>

        <button
          type="button"
          role="switch"
          aria-checked={detail.interactiveSheen}
          onClick={() => {
            soundEngine.playHoverTick(soundEnabled);
            onChange({ interactiveSheen: !detail.interactiveSheen });
          }}
          className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 px-3 py-2.5 text-left transition hover:border-[var(--border-accent)]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Sparkles className="h-4 w-4 shrink-0 text-[var(--accent)]" />
            <div className="min-w-0">
              <div className="text-xs font-medium text-[var(--text-primary)]">
                指尖 / 陀螺仪绒面追光
              </div>
              <div className="truncate text-[10px] text-[var(--text-muted)]">
                随手势移动或手机倾斜流动丝绒反光
              </div>
            </div>
          </div>
          <span
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
              detail.interactiveSheen
                ? "border-[var(--accent)] bg-[var(--accent)]"
                : "border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full shadow transition-transform ${
                detail.interactiveSheen
                  ? "translate-x-5.5 bg-[var(--accent-contrast)]"
                  : "translate-x-1 bg-[var(--text-muted)]"
              }`}
            />
          </span>
        </button>
      </div>
    </div>
  );
}
