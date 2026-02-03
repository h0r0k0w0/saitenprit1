import { NextResponse } from "next/server";

const MODEL_MAP = {
  "gpt-5.2-2025-12-11": "openai",
  "claude-opus-4-5-20251101": "anthropic",
  "gemini-3-pro-preview": "gemini"
} as const;

type Provider = (typeof MODEL_MAP)[keyof typeof MODEL_MAP];

type RequestPayload = {
  model: keyof typeof MODEL_MAP;
  provider?: Provider;
  scenario: string;
  response: string;
  promptTemplate: string;
  openAi?: {
    maxCompletionTokens: number;
    reasoningEffort?: string;
    verbosity?: string;
  };
  gemini?: {
    temperature: number;
    maxOutputTokens: number;
    thinkingLevel?: string;
  };
  apiKeys?: {
    openai?: string;
    anthropic?: string;
    gemini?: string;
  };
  seeds: number[];
};

function buildPrompt(template: string, scenario: string, response: string) {
  if (template.includes("<<<ここにシナリオ>>>") || template.includes("<<<ここに自由記述回答>>>")) {
    return template
      .replace("<<<ここにシナリオ>>>", scenario.trim())
      .replace("<<<ここに自由記述回答>>>", response.trim());
  }

  return `${template.trim()}\n\n【SCENARIO】\n${scenario.trim()}\n\n【RESPONSE】\n${response.trim()}`;
}

function assertEnv(provider: Provider, apiKeys?: RequestPayload["apiKeys"]) {
  if (provider === "openai" && !(apiKeys?.openai || process.env.OPENAI_API_KEY)) {
    throw new Error("OPENAI_API_KEY が設定されていません。");
  }
  if (provider === "anthropic" && !(apiKeys?.anthropic || process.env.ANTHROPIC_API_KEY)) {
    throw new Error("ANTHROPIC_API_KEY が設定されていません。");
  }
  if (provider === "gemini" && !(apiKeys?.gemini || process.env.GEMINI_API_KEY)) {
    throw new Error("GEMINI_API_KEY が設定されていません。");
  }
}

function extractOpenAiText(data: any) {
  const message = data?.choices?.[0]?.message?.content;
  if (typeof message === "string") {
    return message;
  }
  return "";
}

function extractAnthropicText(data: any) {
  const content = data?.content;
  if (Array.isArray(content)) {
    return content.map((item: any) => item?.text).filter(Boolean).join("\n");
  }
  return "";
}

function extractGeminiText(data: any) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    return parts.map((item: any) => item?.text).filter(Boolean).join("\n");
  }
  return "";
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as RequestPayload;
    const provider = payload.provider ?? MODEL_MAP[payload.model];
    if (!provider) {
      return NextResponse.json({ error: "未対応のモデルです。" }, { status: 400 });
    }
    console.info("[evaluate] request", {
      model: payload.model,
      provider,
      seedCount: payload.seeds?.length ?? 0
    });

    const seeds = payload.seeds?.filter((seed) => Number.isInteger(seed)).slice(0, 10);
    if (!seeds || seeds.length === 0) {
      return NextResponse.json({ error: "seedを1つ以上指定してください。" }, { status: 400 });
    }

    assertEnv(provider, payload.apiKeys);

    const prompt = buildPrompt(payload.promptTemplate, payload.scenario, payload.response);
    // OpenAIのパラメータはUIから渡されます。未指定時はここがデフォルトです。
    const openAiConfig = payload.openAi ?? {
      maxCompletionTokens: 1200,
      reasoningEffort: "medium",
      verbosity: "medium"
    };
    const results = await Promise.all(
      seeds.map(async (seed) => {
        try {
          let responseData: any;
          let text = "";

          if (provider === "openai") {
            console.info("[evaluate] openai request", { seed });
            const apiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${payload.apiKeys?.openai || process.env.OPENAI_API_KEY}`
              },
              body: JSON.stringify({
                model: payload.model,
                messages: [{ role: "user", content: prompt }],
                max_completion_tokens: openAiConfig.maxCompletionTokens,
                seed,
                reasoning_effort: openAiConfig.reasoningEffort,
                verbosity: openAiConfig.verbosity
              })
            });
            responseData = await apiResponse.json();
            if (!apiResponse.ok) {
              console.error("[evaluate] openai error", { seed, error: responseData?.error });
              return {
                seed,
                stage: "openai",
                error: responseData?.error?.message || "OpenAI APIエラー",
                raw: responseData
              };
            }
            text = extractOpenAiText(responseData);
          }

          if (provider === "anthropic") {
            // Anthropicのパラメータはここでモデル別に固定できます。
            const anthropicConfig = {
              temperature: 0.2,
              maxTokens: 1200
            };
            console.info("[evaluate] anthropic request", { seed });
            const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": payload.apiKeys?.anthropic ?? process.env.ANTHROPIC_API_KEY ?? "",
                "anthropic-version": "2023-06-01"
              },
              body: JSON.stringify({
                model: payload.model,
                max_tokens: anthropicConfig.maxTokens,
                temperature: anthropicConfig.temperature,
                messages: [{ role: "user", content: prompt }]
              })
            });
            responseData = await apiResponse.json();
            if (!apiResponse.ok) {
              console.error("[evaluate] anthropic error", { seed, error: responseData?.error });
              return {
                seed,
                stage: "anthropic",
                error: responseData?.error?.message || "Anthropic APIエラー",
                raw: responseData
              };
            }
            text = extractAnthropicText(responseData);
          }

          if (provider === "gemini") {
            // GeminiのパラメータはUIから渡されます。未指定時はここがデフォルトです。
            const geminiConfig = payload.gemini ?? {
              temperature: 1,
              maxOutputTokens: 65536,
              thinkingLevel: "high"
            };
            console.info("[evaluate] gemini request", { seed });
            const apiResponse = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${payload.model}:generateContent?key=${
                payload.apiKeys?.gemini || process.env.GEMINI_API_KEY
              }`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  contents: [{ role: "user", parts: [{ text: prompt }] }],
                  generationConfig: {
                    temperature: geminiConfig.temperature,
                    maxOutputTokens: geminiConfig.maxOutputTokens,
                    seed,
                    thinkingConfig: {
                      thinkingLevel: geminiConfig.thinkingLevel
                    }
                  }
                })
              }
            );
            responseData = await apiResponse.json();
            if (!apiResponse.ok) {
              console.error("[evaluate] gemini error", { seed, error: responseData?.error });
              return {
                seed,
                stage: "gemini",
                error: responseData?.error?.message || "Gemini APIエラー",
                raw: responseData
              };
            }
            text = extractGeminiText(responseData);
          }

          return { seed, text, raw: responseData };
        } catch (error) {
          const message = error instanceof Error ? error.message : "不明なエラーです。";
          console.error("[evaluate] request failed", { seed, error: message });
          return { seed, stage: "request", error: message };
        }
      })
    );

    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラーです。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
