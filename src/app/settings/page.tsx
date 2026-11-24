"use client";

import React, { useState } from "react";
import {
  Palette,
  Layers,
  Volume2,
  Vibrate,
  Compass,
  RotateCcw,
  Sparkles,
  Eye,
  EyeOff,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Cloud,
  CloudOff,
  RefreshCw,
  LogOut,
  Mail,
  Lock,
  ShieldCheck,
  Sun,
  Moon,
} from "lucide-react";
import { useUranai } from "@/context/UranaiProvider";
import { THEMES } from "@/data/themes";
import { DECKS, getCardImagePath } from "@/data/decks";
import { soundEngine } from "@/lib/sound";
import { requestGyroPermission, type GyroPermissionResult } from "@/lib/gyroscope";
import type { AiConfig } from "@/types/tarot";

const MODEL_PRESETS = [
  "gpt-4o-mini",
  "deepseek-chat",
  "gemini-2.5-flash",
  "gpt-4.1-mini",
];

const ENDPOINT_PRESETS: Array<{ label: string; url: string; model: string }> = [
  { label: "OpenAI", url: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { label: "DeepSeek", url: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  {
    label: "Gemini (OpenAI)",
    url: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.5-flash",
  },
  {
    label: "OpenRouter",
    url: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4o-mini",
  },
];

interface ToggleRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  extra?: React.ReactNode;
}

function ToggleRow({
  icon,
  title,
  description,
  checked,
  onChange,
  extra,
}: ToggleRowProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 p-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent)]">
          {icon}
        </div>
        <div className="space-y-0.5">
          <div className="text-sm font-medium text-[var(--text-primary)]">
            {title}
          </div>
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
            {description}
          </p>
          {extra && <div className="pt-2">{extra}</div>}
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 self-end items-center rounded-full border transition-colors sm:self-center ${
          checked
            ? "border-[var(--accent)] bg-[var(--accent)]"
            : "border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full shadow-md transition-transform ${
            checked
              ? "translate-x-6 bg-[var(--accent-contrast)]"
              : "translate-x-1 bg-[var(--text-muted)]"
          }`}
        />
      </button>
    </div>
  );
}

interface TestConnectionResponse {
  ok?: boolean;
  model?: string;
  error?: string;
}

export default function SettingsPage() {
  const {
    prefs,
    theme,
    deck,
    aiConfig,
    user,
    supabaseEnabled,
    syncState,
    syncError,
    setThemeId,
    setDeckId,
    updatePrefs,
    setAiConfig,
    signIn,
    signUp,
    signOut,
    syncNow,
  } = useUranai();

  const [showApiKey, setShowApiKey] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const [gyroStatus, setGyroStatus] = useState<GyroPermissionResult | null>(null);
  const [requestingGyro, setRequestingGyro] = useState(false);

  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const updateAiField = <K extends keyof AiConfig>(key: K, value: AiConfig[K]) => {
    setAiConfig({ ...aiConfig, [key]: value });
    setTestResult(null);
  };

  const handleRequestGyro = async () => {
    setRequestingGyro(true);
    try {
      const result = await requestGyroPermission();
      setGyroStatus(result);
      if (result === "granted") {
        updatePrefs({ gyroEnabled: true });
        soundEngine.playChime(prefs.soundEnabled);
      }
    } finally {
      setRequestingGyro(false);
    }
  };

  const handleTestAiConnection = async () => {
    setTestingAi(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testOnly: true,
          customAi: aiConfig,
        }),
      });
      const data = (await res.json()) as TestConnectionResponse;
      if (res.ok && data.ok) {
        soundEngine.playChime(prefs.soundEnabled);
        setTestResult({
          ok: true,
          message: `连接成功！模型「${data.model || aiConfig.model}」响应正常。`,
        });
      } else {
        setTestResult({
          ok: false,
          message: data.error || `测试失败（HTTP ${res.status}）`,
        });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : "网络连接失败，请稍后重试。",
      });
    } finally {
      setTestingAi(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      setAuthMessage({
        type: "error",
        text: "请输入有效的邮箱地址，且密码长度不少于 6 位。",
      });
      return;
    }

    setAuthLoading(true);
    setAuthMessage(null);
    try {
      if (authMode === "signin") {
        const res = await signIn(email, password);
        if (res.ok) {
          setAuthMessage({ type: "success", text: "登录成功，正在同步云端记录…" });
          setPassword("");
        } else {
          setAuthMessage({ type: "error", text: res.error || "登录失败，请检查账号密码。" });
        }
      } else {
        const res = await signUp(email, password);
        if (res.ok) {
          setAuthMessage({
            type: "success",
            text: res.needsConfirmation
              ? "注册成功！请查收邮箱中的验证链接后登录。"
              : "注册并登录成功，云端同步已开启！",
          });
          setPassword("");
        } else {
          setAuthMessage({ type: "error", text: res.error || "注册失败，请稍后重试。" });
        }
      }
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <header className="space-y-1.5">
        <p className="font-display text-xs tracking-[0.26em] text-[var(--accent)] uppercase">
          Sanctuary Preferences
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-wide text-[var(--text-primary)] sm:text-3xl">
          殿堂设置与偏好
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          定制你的占卜桌布、典藏卡组、触感仪式、AI 推理接口与云端多端同步。
        </p>
      </header>

      {/* Section 1: Cloth & Theme Presets */}
      <section className="uranai-glass rounded-3xl p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent)]">
            <Palette className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold tracking-wide text-[var(--text-primary)]">
              占卜桌布与视觉主题
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              5 款专属织物与光影氛围，轻触即刻流转全局视觉
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {THEMES.map((preset) => {
            const active = preset.id === theme.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  soundEngine.playHoverTick(prefs.soundEnabled);
                  setThemeId(preset.id);
                }}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border p-3.5 text-left transition active:scale-[0.99] ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]/60 shadow-[0_0_24px_var(--cloth-glow)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/75 hover:border-[var(--border-accent)]"
                }`}
              >
                {/* Cloth fabric preview swatch banner */}
                <div
                  className="relative mb-3 h-14 w-full overflow-hidden rounded-xl border border-white/15"
                  style={{ background: preset.cssVars["--cloth-gradient"] }}
                >
                  <div className="absolute inset-0 flex items-center justify-between px-3">
                    <div className="flex items-center -space-x-1.5">
                      {preset.swatches.map((hex, idx) => (
                        <span
                          key={idx}
                          className="h-5 w-5 rounded-full border border-white/30 shadow"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[10px] text-white/90 backdrop-blur-sm">
                      {preset.isLight ? (
                        <>
                          <Sun className="h-2.5 w-2.5" />
                          日间
                        </>
                      ) : (
                        <>
                          <Moon className="h-2.5 w-2.5" />
                          夜色
                        </>
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-display text-sm font-semibold text-[var(--text-primary)]">
                      {preset.nameZh}
                    </div>
                    <div className="text-[11px] text-[var(--accent)]">
                      {preset.clothNameZh}
                    </div>
                  </div>
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                      active
                        ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]"
                        : "border-[var(--border-subtle)]"
                    }`}
                  >
                    {active && <Check className="h-3.5 w-3.5" />}
                  </span>
                </div>

                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                  {preset.tagline}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Section 2: Tarot Deck Selection */}
      <section className="uranai-glass rounded-3xl p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent)]">
            <Layers className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold tracking-wide text-[var(--text-primary)]">
              塔罗卡组选择
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              数据驱动式卡组体系，随时切换整套卡面画风与牌背纹章
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {DECKS.map((item) => {
            const active = item.id === deck.id;
            const sampleSlugs = ["00-the-fool", "02-the-high-priestess", "19-the-sun"];
            const previewUrls = sampleSlugs.map(
              (slug) => getCardImagePath(item.id, slug) || `/decks/rws/${slug}.webp`
            );

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  soundEngine.playCardFlip(prefs.soundEnabled);
                  setDeckId(item.id);
                }}
                className={`group flex flex-col justify-between rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]/60 shadow-[0_0_24px_var(--cloth-glow)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/75 hover:border-[var(--border-accent)]"
                }`}
              >
                {/* Live miniature card fan preview */}
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="relative flex h-24 items-center pl-2">
                    {previewUrls.map((url, idx) => (
                      <div
                        key={url}
                        className={`relative h-[86px] ${item.aspectClass} overflow-hidden rounded-lg border border-[var(--border-accent)] bg-black/30 shadow-lg transition-transform duration-300 group-hover:-translate-y-1`}
                        style={{
                          marginLeft: idx === 0 ? 0 : -16,
                          transform: `rotate(${(idx - 1) * 7}deg)`,
                          zIndex: idx + 1,
                        }}
                      >
                        <img
                          src={url}
                          alt={`${item.nameZh} 预览 ${idx + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                    {item.backImage && (
                      <div
                        className={`relative h-[86px] ${item.aspectClass} overflow-hidden rounded-lg border border-[var(--accent)] bg-black/40 shadow-lg`}
                        style={{
                          marginLeft: -16,
                          transform: "rotate(12deg)",
                          zIndex: 4,
                        }}
                      >
                        <img
                          src={item.backImage}
                          alt={`${item.nameZh} 专属牌背`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                  </div>

                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                      active
                        ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]"
                        : "border-[var(--border-subtle)]"
                    }`}
                  >
                    {active && <Check className="h-4 w-4" />}
                  </span>
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-base font-semibold text-[var(--text-primary)]">
                      {item.nameZh}
                    </span>
                    <span className="rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--accent-strong)]">
                      {item.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--accent)]">
                    {item.nameEn} · {item.subtitle}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Section 3: Tactile & Ritual Settings */}
      <section className="uranai-glass rounded-3xl p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent)]">
            <Compass className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold tracking-wide text-[var(--text-primary)]">
              拟真触感与仪式设置
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              调节洗牌纸张声效、触觉震动、手机陀螺仪追光与逆位抽牌规则
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <ToggleRow
            icon={<Volume2 className="h-4 w-4" />}
            title="Web Audio 拟真音效"
            description="洗牌叠纸摩挲声、扇形滑牌轻响、3D 翻牌共鸣与成阵星铃。"
            checked={prefs.soundEnabled}
            onChange={(next) => {
              updatePrefs({ soundEnabled: next });
              if (next) soundEngine.playChime(true);
            }}
          />

          <ToggleRow
            icon={<Vibrate className="h-4 w-4" />}
            title="手机触觉震动反馈"
            description="在支持震动的移动设备上，于切牌、选牌与翻牌瞬间给予轻柔触感。"
            checked={prefs.hapticsEnabled}
            onChange={(next) => {
              updatePrefs({ hapticsEnabled: next });
              if (next && typeof navigator !== "undefined" && "vibrate" in navigator) {
                navigator.vibrate(14);
              }
            }}
          />

          <ToggleRow
            icon={<Compass className="h-4 w-4" />}
            title="陀螺仪烫金追光"
            description="轻晃手机即可令 3D 塔罗牌随角度倾斜并折射细腻的金箔光泽。"
            checked={prefs.gyroEnabled}
            onChange={(next) => updatePrefs({ gyroEnabled: next })}
            extra={
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleRequestGyro}
                  disabled={requestingGyro}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent-strong)] transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                >
                  {requestingGyro ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Compass className="h-3.5 w-3.5" />
                  )}
                  授权手机陀螺仪
                </button>
                {gyroStatus === "granted" && (
                  <span className="text-xs text-emerald-400">
                    ✦ 已授权陀螺仪追光
                  </span>
                )}
                {gyroStatus === "denied" && (
                  <span className="text-xs text-amber-300">
                    系统未授权方向传感器，请在 Safari/浏览器隐私设置中允许
                  </span>
                )}
                {gyroStatus === "unsupported" && (
                  <span className="text-xs text-[var(--text-muted)]">
                    当前设备无陀螺仪，已自动启用鼠标/触控倾斜追光
                  </span>
                )}
              </div>
            }
          />

          <ToggleRow
            icon={<RotateCcw className="h-4 w-4" />}
            title="允许逆位抽牌"
            description="开启后每张牌将以经典概率呈现正位或逆位；关闭则仅抽取正位牌。"
            checked={prefs.allowReversed}
            onChange={(next) => updatePrefs({ allowReversed: next })}
          />
        </div>
      </section>

      {/* Section 4: AI Reading Configuration */}
      <section
        id="ai-config"
        className="uranai-glass gold-shimmer-border scroll-mt-24 rounded-3xl p-5 sm:p-6"
      >
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent)]">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold tracking-wide text-[var(--text-primary)]">
              AI 推理解读配置
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              支持 OpenAI 兼容协议（OpenAI / DeepSeek / Gemini / OpenRouter 等）
            </p>
          </div>
        </div>

        {/* Mode Radio Cards */}
        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => updateAiField("mode", "server")}
            className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition ${
              aiConfig.mode === "server"
                ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 hover:border-[var(--border-accent)]"
            }`}
          >
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                aiConfig.mode === "server"
                  ? "border-[var(--accent)] bg-[var(--accent)]"
                  : "border-[var(--border-accent)]"
              }`}
            >
              {aiConfig.mode === "server" && (
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-contrast)]" />
              )}
            </span>
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                服务端默认接口
              </div>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                使用部署服务器环境变量中配置的统一 AI 密钥与模型。
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => updateAiField("mode", "custom")}
            className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition ${
              aiConfig.mode === "custom"
                ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 hover:border-[var(--border-accent)]"
            }`}
          >
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                aiConfig.mode === "custom"
                  ? "border-[var(--accent)] bg-[var(--accent)]"
                  : "border-[var(--border-accent)]"
              }`}
            >
              {aiConfig.mode === "custom" && (
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-contrast)]" />
              )}
            </span>
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                自定义 OpenAI 兼容 API
              </div>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                密钥仅存于本地浏览器，请求时直连你指定的模型服务。
              </p>
            </div>
          </button>
        </div>

        {/* Custom AI Inputs */}
        {aiConfig.mode === "custom" && (
          <div className="mb-4 space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/65 p-4">
            {/* Quick provider fill */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-[var(--text-muted)]">
                常用接口快捷填充
              </span>
              <div className="flex flex-wrap gap-1.5">
                {ENDPOINT_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      setAiConfig({
                        ...aiConfig,
                        mode: "custom",
                        baseUrl: preset.url,
                        model: preset.model,
                      })
                    }
                    className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/80 px-2.5 py-1 text-[11px] text-[var(--text-secondary)] transition hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="ai-base-url"
                className="block text-xs font-medium text-[var(--text-secondary)]"
              >
                API Base URL
              </label>
              <input
                id="ai-base-url"
                type="url"
                value={aiConfig.baseUrl}
                onChange={(e) => updateAiField("baseUrl", e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/75 px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="ai-api-key"
                className="block text-xs font-medium text-[var(--text-secondary)]"
              >
                API Key
              </label>
              <div className="relative">
                <input
                  id="ai-api-key"
                  type={showApiKey ? "text" : "password"}
                  value={aiConfig.apiKey}
                  onChange={(e) => updateAiField("apiKey", e.target.value)}
                  placeholder="sk-..."
                  autoComplete="off"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/75 py-2.5 pr-11 pl-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((v) => !v)}
                  aria-label={showApiKey ? "隐藏 API Key" : "显示 API Key"}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-lg p-1.5 text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent)]" />
                仅保存于当前设备的 LocalStorage，不会同步至 Supabase 云端数据库。
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="ai-model"
                className="block text-xs font-medium text-[var(--text-secondary)]"
              >
                模型名称 (Model)
              </label>
              <input
                id="ai-model"
                type="text"
                value={aiConfig.model}
                onChange={(e) => updateAiField("model", e.target.value)}
                placeholder="gpt-4o-mini"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/75 px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
              />
              <div className="flex flex-wrap gap-1.5">
                {MODEL_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => updateAiField("model", preset)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                      aiConfig.model === preset
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                        : "border-[var(--border-subtle)] bg-[var(--bg-elevated)]/70 text-[var(--text-secondary)] hover:border-[var(--border-accent)]"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Test connection bar */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleTestAiConnection}
            disabled={testingAi}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border-accent)] bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--accent-contrast)] shadow-[0_6px_22px_var(--cloth-glow)] transition hover:brightness-110 active:scale-95 disabled:opacity-50"
          >
            {testingAi ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {testingAi ? "正在测试连通性…" : "测试连接"}
          </button>

          {testResult && (
            <div
              className={`flex items-center gap-1.5 text-xs ${
                testResult.ok ? "text-emerald-400" : "text-rose-300"
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>
      </section>

      {/* Section 5: Supabase Cloud Multi-Device Sync */}
      <section className="uranai-glass rounded-3xl p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent)]">
              {supabaseEnabled ? (
                <Cloud className="h-4 w-4" />
              ) : (
                <CloudOff className="h-4 w-4" />
              )}
            </span>
            <div>
              <h2 className="font-display text-base font-semibold tracking-wide text-[var(--text-primary)]">
                Supabase 云端多端同步
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {supabaseEnabled
                  ? "登录后自动跨设备同步桌布偏好与全部历史占卜记录"
                  : "当前使用零配置本地存储，记录安全保存于本设备浏览器"}
              </p>
            </div>
          </div>

          <span className="rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent-strong)]">
            {syncState === "synced"
              ? "云端已同步"
              : syncState === "syncing"
                ? "同步中…"
                : syncState === "error"
                  ? "同步异常"
                  : "本地模式"}
          </span>
        </div>

        {supabaseEnabled ? (
          user ? (
            <div className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-[var(--text-muted)]">当前登录账号</div>
                  <div className="mt-0.5 text-sm font-medium text-[var(--text-primary)]">
                    {user.email}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void syncNow()}
                    disabled={syncState === "syncing"}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-3.5 py-1.5 text-xs font-medium text-[var(--accent-strong)] transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${
                        syncState === "syncing" ? "animate-spin" : ""
                      }`}
                    />
                    立即云端同步
                  </button>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] px-3.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:border-rose-400/50 hover:text-rose-300"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    退出登录
                  </button>
                </div>
              </div>
              {syncError && (
                <p className="text-xs text-rose-300">同步提示：{syncError}</p>
              )}
            </div>
          ) : (
            <form
              onSubmit={handleAuthSubmit}
              className="space-y-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 p-4"
            >
              <div className="inline-flex rounded-full border border-[var(--border-subtle)] bg-[var(--bg-base)]/60 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signin");
                    setAuthMessage(null);
                  }}
                  className={`rounded-full px-4 py-1 text-xs font-medium transition ${
                    authMode === "signin"
                      ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                      : "text-[var(--text-secondary)]"
                  }`}
                >
                  邮箱登录
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signup");
                    setAuthMessage(null);
                  }}
                  className={`rounded-full px-4 py-1 text-xs font-medium transition ${
                    authMode === "signup"
                      ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                      : "text-[var(--text-secondary)]"
                  }`}
                >
                  注册新账号
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="邮箱地址"
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/75 py-2.5 pr-3.5 pl-9 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="密码（至少 6 位）"
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/75 py-2.5 pr-3.5 pl-9 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={authLoading}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2 text-xs font-semibold text-[var(--accent-contrast)] transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                >
                  {authLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {authMode === "signin" ? "登录并同步" : "创建同步账号"}
                </button>
                {authMessage && (
                  <span
                    className={`text-xs ${
                      authMessage.type === "success"
                        ? "text-emerald-400"
                        : "text-rose-300"
                    }`}
                  >
                    {authMessage.text}
                  </span>
                )}
              </div>
            </form>
          )
        ) : (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/65 p-4 text-xs leading-relaxed text-[var(--text-secondary)]">
            <p className="font-medium text-[var(--text-primary)]">
              ✦ 本地浏览器存储已就绪 — 无需任何云端配置即可完整使用全部功能
            </p>
            <p className="mt-2">
              如需开启多设备云端同步，可在部署环境 <code className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[var(--accent-strong)]">.env</code> 中填写{" "}
              <code className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[var(--accent-strong)]">NEXT_PUBLIC_SUPABASE_URL</code> 与{" "}
              <code className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[var(--accent-strong)]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>，并在 Supabase SQL Editor 中执行{" "}
              <code className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[var(--accent-strong)]">supabase/migrations/001_init.sql</code> 建表脚本。
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
