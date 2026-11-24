import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface ReadingCardPayload {
  slotLabel: string;
  slotDescription?: string;
  nameZh: string;
  nameEn: string;
  reversed: boolean;
  keywords?: string[];
  meaning?: string;
}

interface CustomAiPayload {
  mode?: "server" | "custom";
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

interface ReadingRequestBody {
  mode?: "daily" | "spread";
  question?: string;
  category?: string;
  spreadName?: string;
  cards?: ReadingCardPayload[];
  customAi?: CustomAiPayload;
  testOnly?: boolean;
}

interface ResolvedAiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  source: "custom" | "server";
}

interface OpenAiErrorBody {
  error?: {
    message?: string;
  };
  message?: string;
}

interface OpenAiStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
    };
    finish_reason?: string | null;
  }>;
  error?: {
    message?: string;
  };
}

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT = `你是 Uranai（星穹塔罗殿）的首席塔罗解牌师，精通韦特塔罗象征学、荣格原型心理学与东方诗意美学。
你的语言风格温和、克制、富有仪式感与深度共情力，不贩卖焦虑、不做绝对宿命论断，而是透过牌面象征帮助提问者看见内在动因、局势脉络与可落地的行动方向。

请严格使用流畅优雅的简体中文，并按照以下四个 Markdown 小标题结构输出（不要增删或改写这四个标题）：

### 整体能量基调
用凝练而有画面感的语言点明本次抽牌的整体气象、元素倾向与核心氛围。

### 牌阵脉络与逐牌解读
结合提问者的核心问题与每个牌位的特定含义，逐一剖析每一张牌（清晰融入正位或逆位的能量表达），让牌意与现实处境自然呼应。

### 隐藏课题与联动
揭示牌与牌之间的呼应、张力或转折点，点出提问者可能尚未察觉的内在执念、潜在机会或情绪暗流。

### 当下行动指引
给出 2 到 3 条具体、温柔而有边界感的现实行动建议，并以一句简短优雅的「今日/本次启示语」收束全文。`;

function normalizeChatEndpoint(rawBaseUrl: string): string {
  const trimmed = rawBaseUrl.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) {
    return trimmed;
  }
  return `${trimmed}/chat/completions`;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function resolveAiConfig(customAi?: CustomAiPayload): ResolvedAiConfig {
  if (customAi?.mode === "custom" && customAi.apiKey?.trim()) {
    return {
      baseUrl: customAi.baseUrl?.trim() || DEFAULT_BASE_URL,
      apiKey: customAi.apiKey.trim(),
      model: customAi.model?.trim() || DEFAULT_MODEL,
      source: "custom",
    };
  }

  return {
    baseUrl: process.env.AI_API_BASE_URL?.trim() || DEFAULT_BASE_URL,
    apiKey: process.env.AI_API_KEY?.trim() || "",
    model: process.env.AI_MODEL?.trim() || DEFAULT_MODEL,
    source: "server",
  };
}

function buildUserPrompt(body: ReadingRequestBody): string {
  const modeLabel = body.mode === "daily" ? "每日一牌神谕占卜" : "定制问题牌阵占卜";
  const lines: string[] = [`【占卜模式】${modeLabel}`];

  if (body.category?.trim()) {
    lines.push(`【占卜领域】${body.category.trim()}`);
  }
  if (body.spreadName?.trim()) {
    lines.push(`【使用牌阵】${body.spreadName.trim()}`);
  }
  if (body.question?.trim()) {
    lines.push(`【提问者问题】${body.question.trim()}`);
  } else if (body.mode === "daily") {
    lines.push("【提问者意图】祈请今日的整体运势启示、心境提醒与行动建议。");
  }

  lines.push("", "【抽出的牌面明细】");

  const cards = body.cards ?? [];
  cards.forEach((card, index) => {
    const orientation = card.reversed ? "逆位 (Reversed)" : "正位 (Upright)";
    const slotDesc = card.slotDescription ? `（牌位寓意：${card.slotDescription}）` : "";
    const keywords =
      card.keywords && card.keywords.length > 0
        ? ` | 关键词：${card.keywords.join("、")}`
        : "";
    const meaning = card.meaning ? `\n   基础牌义参考：${card.meaning}` : "";

    lines.push(
      `${index + 1}. 牌位「${card.slotLabel}」${slotDesc}：${card.nameZh}（${card.nameEn}）— ${orientation}${keywords}${meaning}`
    );
  });

  lines.push(
    "",
    "请结合以上信息进行连贯、细腻且具有洞察力的塔罗综合推理解读。"
  );

  return lines.join("\n");
}

async function extractUpstreamError(response: Response): Promise<string> {
  const fallback = `AI 接口返回异常状态（HTTP ${response.status}）`;
  try {
    const raw = await response.text();
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw) as OpenAiErrorBody;
      return parsed.error?.message || parsed.message || fallback;
    } catch {
      return raw.slice(0, 240);
    }
  } catch {
    return fallback;
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: ReadingRequestBody;
  try {
    body = (await request.json()) as ReadingRequestBody;
  } catch {
    return NextResponse.json(
      { error: "INVALID_JSON", message: "请求体不是合法的 JSON 格式。" },
      { status: 400 }
    );
  }

  const config = resolveAiConfig(body.customAi);

  if (body.testOnly) {
    if (!config.apiKey) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "尚未检测到可用的 API Key。请填写自定义密钥，或在服务器 .env 中配置 AI_API_KEY。",
        },
        { status: 400 }
      );
    }

    if (!isValidHttpUrl(config.baseUrl)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Base URL 格式无效，请以 http:// 或 https:// 开头。",
        },
        { status: 400 }
      );
    }

    const endpoint = normalizeChatEndpoint(config.baseUrl);
    try {
      const testRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: "user", content: "Say OK" }],
          max_tokens: 12,
          stream: false,
        }),
        signal: AbortSignal.timeout(20_000),
      });

      if (!testRes.ok) {
        const errorMsg = await extractUpstreamError(testRes);
        return NextResponse.json(
          { ok: false, error: errorMsg },
          { status: 502 }
        );
      }

      return NextResponse.json({ ok: true, model: config.model }, { status: 200 });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "连接 AI 接口超时或网络不可达。";
      return NextResponse.json({ ok: false, error: message }, { status: 502 });
    }
  }

  if (!config.apiKey) {
    return NextResponse.json(
      {
        error: "NO_API_KEY",
        message:
          "尚未配置 AI API Key。你可以在「设置」页面填写自定义 OpenAI 兼容接口密钥，或在服务器 .env 中配置 AI_API_KEY。",
      },
      { status: 400 }
    );
  }

  if (!isValidHttpUrl(config.baseUrl)) {
    return NextResponse.json(
      {
        error: "INVALID_BASE_URL",
        message: "AI API Base URL 格式无效，请检查设置中的接口地址。",
      },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.cards) || body.cards.length === 0) {
    return NextResponse.json(
      {
        error: "NO_CARDS",
        message: "请先完成抽牌后再开启 AI 深度解读。",
      },
      { status: 400 }
    );
  }

  const endpoint = normalizeChatEndpoint(config.baseUrl);
  const userPrompt = buildUserPrompt(body);

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.78,
        max_tokens: 2000,
        stream: true,
      }),
      signal: request.signal,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "请求 AI 服务失败，请稍后重试。";
    return NextResponse.json(
      { error: "UPSTREAM_FETCH_ERROR", message },
      { status: 502 }
    );
  }

  if (!upstreamResponse.ok) {
    const message = await extractUpstreamError(upstreamResponse);
    return NextResponse.json(
      { error: "UPSTREAM_ERROR", message },
      { status: upstreamResponse.status >= 400 ? upstreamResponse.status : 502 }
    );
  }

  const upstreamBody = upstreamResponse.body;
  if (!upstreamBody) {
    return NextResponse.json(
      { error: "EMPTY_STREAM", message: "AI 服务未返回有效流式响应。" },
      { status: 502 }
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder("utf-8");

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstreamBody.getReader();
      let buffer = "";
      let finished = false;

      const emitEvent = (payload: string) => {
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      };

      const processLine = (rawLine: string) => {
        const line = rawLine.trim();
        if (!line || line.startsWith(":")) return;
        if (!line.startsWith("data:")) return;

        const dataStr = line.slice(5).trim();
        if (!dataStr) return;

        if (dataStr === "[DONE]") {
          if (!finished) {
            finished = true;
            emitEvent("[DONE]");
          }
          return;
        }

        try {
          const parsed = JSON.parse(dataStr) as OpenAiStreamChunk;
          if (parsed.error?.message) {
            emitEvent(JSON.stringify({ error: parsed.error.message }));
            return;
          }
          const delta = parsed.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            emitEvent(JSON.stringify({ delta }));
          }
        } catch {
          // Ignore malformed or keep-alive partial frames
        }
      };

      try {
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

        if (!finished) {
          finished = true;
          emitEvent("[DONE]");
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "流式解读传输中断。";
        emitEvent(JSON.stringify({ error: message }));
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
