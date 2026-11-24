"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  Square,
  KeyRound,
  AlertCircle,
  Wand2,
} from "lucide-react";

export interface AiReadingCardInput {
  slotLabel: string;
  slotDescription?: string;
  nameZh: string;
  nameEn: string;
  reversed: boolean;
  keywords?: string[];
  meaning?: string;
}

export interface AiCustomPayload {
  mode: "server" | "custom";
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AiInterpretationPanelProps {
  mode: "daily" | "spread";
  question?: string;
  category?: string;
  spreadName?: string;
  cards: AiReadingCardInput[];
  initialInterpretation?: string;
  customAi?: AiCustomPayload;
  disabled?: boolean;
  disabledHint?: string;
  onInterpretationComplete?: (fullText: string) => void;
  className?: string;
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;
  let keyCounter = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(
        <strong
          key={`b-${keyCounter++}`}
          className="font-semibold text-[var(--uranai-text)] underline decoration-[var(--uranai-border-strong)] decoration-1 underline-offset-4"
        >
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(
        <em key={`i-${keyCounter++}`} className="italic opacity-90">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code
          key={`c-${keyCounter++}`}
          className="rounded px-1.5 py-0.5 text-[0.85em] bg-[var(--uranai-accent-soft)] text-[var(--uranai-accent)]"
        >
          {token.slice(1, -1)}
        </code>
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export function TarotMarkdown({
  content,
  streaming = false,
}: {
  content: string;
  streaming?: boolean;
}) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<div key={`hr-${blockKey++}`} className="gold-divider my-4 opacity-70" />);
      i += 1;
      continue;
    }

    // Headings (#, ##, ###, ####)
    const headingMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].trim();
      blocks.push(
        <div
          key={`h-${blockKey++}`}
          className={
            level <= 2
              ? "mt-5 mb-2.5 flex items-center gap-2 border-b border-[var(--uranai-border)] pb-1.5 first:mt-0"
              : "mt-5 mb-2 flex items-center gap-2 first:mt-0"
          }
        >
          <span
            aria-hidden="true"
            className="text-xs text-[var(--uranai-accent)]"
          >
            ✦
          </span>
          <h4 className="font-display text-[0.98rem] font-semibold tracking-wide text-[var(--uranai-accent)]">
            {renderInlineMarkdown(headingText)}
          </h4>
        </div>
      );
      i += 1;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push(
        <blockquote
          key={`q-${blockKey++}`}
          className="my-3 rounded-r-xl border-l-2 border-[var(--uranai-accent)] bg-[var(--uranai-accent-soft)] px-4 py-2.5 text-[0.92rem] leading-relaxed text-[var(--uranai-text)]/95 italic"
        >
          {quoteLines.map((qLine, idx) => (
            <p key={idx} className={idx > 0 ? "mt-1.5" : ""}>
              {renderInlineMarkdown(qLine)}
            </p>
          ))}
        </blockquote>
      );
      continue;
    }

    // Unordered list
    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${blockKey++}`} className="my-2.5 space-y-2">
          {items.map((item, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2.5 text-[0.92rem] leading-relaxed text-[var(--uranai-text)]/90"
            >
              <span
                aria-hidden="true"
                className="mt-[0.42rem] h-1.5 w-1.5 shrink-0 rotate-45 bg-[var(--uranai-accent)]"
              />
              <span className="flex-1">{renderInlineMarkdown(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+[.、)]\s+/.test(trimmed)) {
      const items: Array<{ num: string; text: string }> = [];
      while (i < lines.length && /^\d+[.、)]\s+/.test(lines[i].trim())) {
        const m = /^(\d+)[.、)]\s+(.+)$/.exec(lines[i].trim());
        if (m) {
          items.push({ num: m[1], text: m[2] });
        }
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${blockKey++}`} className="my-2.5 space-y-2.5">
          {items.map((item, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2.5 text-[0.92rem] leading-relaxed text-[var(--uranai-text)]/90"
            >
              <span className="font-display mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--uranai-border-strong)] bg-[var(--uranai-accent-soft)] text-[0.7rem] font-semibold text-[var(--uranai-accent)]">
                {item.num}
              </span>
              <span className="flex-1">{renderInlineMarkdown(item.text)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Regular paragraph (merge consecutive plain lines)
    const paraLines: string[] = [trimmed];
    i += 1;
    while (i < lines.length) {
      const nextTrimmed = lines[i].trim();
      if (
        !nextTrimmed ||
        /^(#{1,4}\s+|>\s?|[-*•]\s+|\d+[.、)]\s+|-{3,}|\*{3,}|_{3,})/.test(nextTrimmed)
      ) {
        break;
      }
      paraLines.push(nextTrimmed);
      i += 1;
    }

    blocks.push(
      <p
        key={`p-${blockKey++}`}
        className="my-2.5 text-[0.93rem] leading-[1.82] text-[var(--uranai-text)]/90"
      >
        {renderInlineMarkdown(paraLines.join(" "))}
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {blocks}
      {streaming && (
        <span
          aria-label="正在推演解读"
          className="ml-1 inline-flex items-center gap-1 align-middle text-[var(--uranai-accent)]"
        >
          <span className="inline-block h-3.5 w-1.5 animate-pulse rounded-full bg-[var(--uranai-accent)] shadow-[0_0_10px_var(--uranai-accent)]" />
        </span>
      )}
    </div>
  );
}

interface StreamDeltaEvent {
  delta?: string;
  error?: string;
}

interface ApiErrorPayload {
  error?: string;
  message?: string;
}

export function AiInterpretationPanel({
  mode,
  question,
  category,
  spreadName,
  cards,
  initialInterpretation = "",
  customAi,
  disabled = false,
  disabledHint,
  onInterpretationComplete,
  className = "",
}: AiInterpretationPanelProps) {
  const [content, setContent] = useState<string>(initialInterpretation);
  const [streaming, setStreaming] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noApiKey, setNoApiKey] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const abortRef = useRef<AbortController | null>(null);
  const isStreamingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isStreamingRef.current) {
      setContent(initialInterpretation);
      setErrorMessage(null);
      setNoApiKey(false);
    }
  }, [initialInterpretation]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    isStreamingRef.current = false;
    setStreaming(false);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!content.trim()) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback ignored on restricted clipboard contexts
    }
  }, [content]);

  const handleGenerate = useCallback(async () => {
    if (disabled || cards.length === 0) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    isStreamingRef.current = true;

    setStreaming(true);
    setErrorMessage(null);
    setNoApiKey(false);
    setContent("");

    let accumulated = "";

    try {
      const response = await fetch("/api/reading", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode,
          question,
          category,
          spreadName,
          cards,
          customAi,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let payload: ApiErrorPayload = {};
        try {
          payload = (await response.json()) as ApiErrorPayload;
        } catch {
          // ignore
        }

        if (payload.error === "NO_API_KEY") {
          setNoApiKey(true);
          setErrorMessage(
            payload.message ||
              "尚未配置 AI API Key。你可以在「设置」页面填写自定义 OpenAI 兼容接口密钥，或在服务器 .env 中配置 AI_API_KEY。"
          );
        } else {
          setErrorMessage(
            payload.message || `AI 解读请求失败（HTTP ${response.status}），请检查配置后重试。`
          );
        }
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setErrorMessage("未收到有效的流式解读数据。");
        return;
      }

      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      const processLine = (rawLine: string) => {
        const line = rawLine.trim();
        if (!line || !line.startsWith("data:")) return;
        const dataStr = line.slice(5).trim();
        if (!dataStr || dataStr === "[DONE]") return;

        try {
          const parsed = JSON.parse(dataStr) as StreamDeltaEvent;
          if (parsed.error) {
            setErrorMessage(parsed.error);
          } else if (typeof parsed.delta === "string" && parsed.delta.length > 0) {
            accumulated += parsed.delta;
            setContent(accumulated);
          }
        } catch {
          // Ignore non-JSON keep-alive lines
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          processLine(line);
        }
      }

      buffer += decoder.decode();
      if (buffer.trim()) {
        for (const line of buffer.split(/\r?\n/)) {
          processLine(line);
        }
      }

      if (accumulated.trim()) {
        onInterpretationComplete?.(accumulated.trim());
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        if (accumulated.trim()) {
          onInterpretationComplete?.(accumulated.trim());
        }
        return;
      }
      setErrorMessage(
        err instanceof Error ? err.message : "连接 AI 推理解读服务失败，请稍后重试。"
      );
    } finally {
      isStreamingRef.current = false;
      setStreaming(false);
      abortRef.current = null;
    }
  }, [
    cards,
    category,
    customAi,
    disabled,
    mode,
    onInterpretationComplete,
    question,
    spreadName,
  ]);

  const hasContent = content.trim().length > 0;

  return (
    <section
      className={`uranai-glass gold-shimmer-border relative overflow-hidden rounded-2xl p-4 sm:p-5 ${className}`}
    >
      {/* Ambient top glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 right-8 h-32 w-48 rounded-full opacity-25 blur-3xl"
        style={{ background: "var(--uranai-accent)" }}
      />

      {/* Header */}
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--uranai-border-strong)] bg-[var(--uranai-accent-soft)] text-[var(--uranai-accent)]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold tracking-wide text-[var(--uranai-text)]">
              AI 深度推理解读
            </h3>
            <p className="text-xs text-[var(--uranai-text-muted)]">
              {streaming
                ? "正在编织牌阵象征与星象脉络…"
                : hasContent
                  ? "已结合问题、牌位与正逆位生成综合解析"
                  : "结合提问语境与所有牌位联动，呈现定制化洞察"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasContent && !streaming && (
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--uranai-border)] bg-[var(--uranai-surface)] px-3 py-1.5 text-xs font-medium text-[var(--uranai-text-muted)] transition hover:border-[var(--uranai-border-strong)] hover:text-[var(--uranai-text)] active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[var(--uranai-accent)]" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  复制
                </>
              )}
            </button>
          )}

          {streaming ? (
            <button
              type="button"
              onClick={handleStop}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--uranai-border-strong)] bg-[var(--uranai-accent-soft)] px-3.5 py-1.5 text-xs font-medium text-[var(--uranai-accent)] transition hover:brightness-110 active:scale-95"
            >
              <Square className="h-3 w-3 fill-current" />
              停止生成
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={disabled || cards.length === 0}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--uranai-border-strong)] bg-[var(--uranai-accent)] px-4 py-2 text-xs font-semibold tracking-wide text-[var(--accent-contrast)] shadow-[0_6px_22px_var(--uranai-accent-glow)] transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {hasContent ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  重新解读
                </>
              ) : (
                <>
                  <Wand2 className="h-3.5 w-3.5" />
                  开启 AI 深度推理解读
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {disabled && disabledHint && !hasContent && (
        <p className="mt-3 rounded-xl border border-[var(--uranai-border)] bg-[var(--uranai-accent-soft)]/50 px-3.5 py-2 text-xs text-[var(--uranai-text-muted)]">
          ✦ {disabledHint}
        </p>
      )}

      {/* No API Key inline golden prompt */}
      {noApiKey && (
        <div className="mt-4 rounded-xl border border-[var(--uranai-border-strong)] bg-[var(--uranai-accent-soft)] p-4">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-[var(--uranai-accent)]" />
            <div className="flex-1 space-y-2.5">
              <p className="text-sm font-medium text-[var(--uranai-text)]">
                尚未配置 AI 推理密钥
              </p>
              <p className="text-xs leading-relaxed text-[var(--uranai-text-muted)]">
                {errorMessage}
              </p>
              <Link
                href="/settings#ai-config"
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--uranai-border-strong)] bg-[var(--uranai-accent)] px-4 py-1.5 text-xs font-semibold text-[var(--accent-contrast)] transition hover:brightness-110"
              >
                <KeyRound className="h-3.5 w-3.5" />
                前往设置配置 AI 接口 →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Other errors */}
      {errorMessage && !noApiKey && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-400/35 bg-rose-950/25 p-3.5 text-xs text-rose-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
          <div className="space-y-1">
            <p className="font-medium">解牌传输遇到小波折</p>
            <p className="opacity-85 leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Streaming placeholder before first token */}
      {streaming && !hasContent && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-[var(--uranai-border)] bg-[var(--uranai-surface)] px-4 py-5">
          <div className="h-2.5 w-2.5 animate-ping rounded-full bg-[var(--uranai-accent)]" />
          <span className="text-sm text-[var(--uranai-text-muted)]">
            星穹正在凝聚牌面意象，请稍候片刻…
          </span>
        </div>
      )}

      {/* Rendered Markdown output */}
      {hasContent && (
        <div className="mt-4 border-t border-[var(--uranai-border)] pt-4">
          <TarotMarkdown content={content} streaming={streaming} />
        </div>
      )}
    </section>
  );
}
