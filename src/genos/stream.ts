/**
 * Direct Cerebras streaming (OpenAI-compatible chat completions) with a real
 * tool-calling loop: rounds that finish in tool_calls execute the tools
 * (web_search) and feed results back as `tool` messages until the model
 * streams the screen itself. There is no server - the app prepends the
 * generated system prompt and holds the conversation. Cerebras allows
 * browser origins (Access-Control-Allow-Origin: *), so this same path
 * serves native and web builds.
 */

import { fetch as expoFetch } from "expo/fetch";
import { CEREBRAS_BASE_URL, GENOS_MODEL, cerebrasKey } from "../config";
import { SYSTEM_PROMPT } from "./generated/system-prompt";
import { TOOLS_PROMPT_SECTION, TOOL_DEFS, executeTool, toolsAvailable } from "./tools/search";

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface StreamEndInfo {
  /** Provider reported finish_reason "length" - the screen was cut short. */
  truncated: boolean;
  /** Stream ended without [DONE] or a finish_reason - likely dropped mid-flight. */
  dropped: boolean;
}

/** Sentinel error for tool rounds refused by the caller (prefetch quota). */
export const NEEDS_LIVE_DATA = "needs live data";

/** Rounds that may end in tool calls before we force a plain generation. */
const MAX_TOOL_ROUNDS = 3;

interface StreamHandlers {
  onDelta: (text: string) => void;
  onDone: (info: StreamEndInfo) => void;
  onError: (err: Error) => void;
  /**
   * The model requested tools. Return "abort" to refuse execution (used by
   * speculative prefetch so search quota only burns on screens the user
   * actually opens); "continue" executes the calls and streams the next round.
   */
  onToolRound?: (calls: Array<{ name: string; args: Record<string, unknown> }>) => "continue" | "abort";
  signal?: AbortSignal;
}

/**
 * Incremental UTF-8 decoding. Hermes/Expo provide TextDecoder in current
 * runtimes; the manual path keeps us safe if the global is missing, holding
 * incomplete trailing multi-byte sequences between chunks.
 */
function createUtf8Decoder(): (chunk: Uint8Array) => string {
  if (typeof TextDecoder !== "undefined") {
    const td = new TextDecoder();
    return (chunk) => td.decode(chunk, { stream: true });
  }
  let pending: number[] = [];
  return (chunk) => {
    const bytes = [...pending, ...chunk];
    pending = [];
    // Hold back a trailing incomplete multi-byte sequence.
    let end = bytes.length;
    for (let i = Math.max(0, bytes.length - 3); i < bytes.length; i++) {
      const b = bytes[i];
      const need = b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : b >= 0xc0 ? 2 : 0;
      if (need > 0 && i + need > bytes.length) {
        end = i;
        break;
      }
    }
    pending = bytes.slice(end);
    let out = "";
    let i = 0;
    while (i < end) {
      const b = bytes[i];
      let cp: number;
      if (b < 0x80) {
        cp = b;
        i += 1;
      } else if (b < 0xe0) {
        cp = ((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f);
        i += 2;
      } else if (b < 0xf0) {
        cp = ((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f);
        i += 3;
      } else {
        cp =
          ((b & 0x07) << 18) |
          ((bytes[i + 1] & 0x3f) << 12) |
          ((bytes[i + 2] & 0x3f) << 6) |
          (bytes[i + 3] & 0x3f);
        i += 4;
      }
      out += String.fromCodePoint(cp);
    }
    return out;
  };
}

/** System prompt + optional tools section + today's date line. */
function systemPrompt(): string {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    SYSTEM_PROMPT + (toolsAvailable() ? TOOLS_PROMPT_SECTION : "") + `\n\nToday is ${today}.`
  );
}

interface RoundResult {
  finish: "content" | "tool_calls";
  content: string;
  toolCalls: ToolCall[];
  info: StreamEndInfo;
}

/**
 * One streamed completion. Content deltas are forwarded live; tool-call
 * deltas are accumulated by index (Cerebras sends whole calls per chunk, but
 * the accumulator also handles OpenAI-style split `arguments` fragments).
 */
async function streamRound(
  convo: ChatMessage[],
  includeTools: boolean,
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<RoundResult> {
  const apiKey = cerebrasKey.get();
  if (!apiKey) throw new Error("No Cerebras API key set");

  const res = await expoFetch(`${CEREBRAS_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GENOS_MODEL,
      messages: [{ role: "system", content: systemPrompt() }, ...convo],
      ...(includeTools ? { tools: TOOL_DEFS } : {}),
      stream: true,
      temperature: 0.8,
      max_completion_tokens: 3072,
    }),
    signal,
  });
  if (res.status === 401 || res.status === 403) {
    cerebrasKey.markRejected(apiKey);
    throw new Error("Cerebras rejected the API key - enter a valid key");
  }
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail.slice(0, 500) || `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decode = createUtf8Decoder();
  let buffer = "";
  let sawDone = false;
  let finishReason: string | null = null;
  let content = "";
  const toolCalls = new Map<number, ToolCall>();

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decode(value);
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload) continue;
      if (payload === "[DONE]") {
        sawDone = true;
        continue;
      }

      let chunk: {
        error?: { message?: string } | string;
        choices?: Array<{
          delta?: {
            content?: string;
            tool_calls?: Array<{
              index?: number;
              id?: string;
              function?: { name?: string; arguments?: string };
            }>;
          };
          finish_reason?: string | null;
        }>;
      };
      try {
        chunk = JSON.parse(payload);
      } catch {
        continue;
      }
      if (chunk.error) {
        const msg = typeof chunk.error === "string" ? chunk.error : chunk.error.message;
        throw new Error(msg || "stream error");
      }
      const choice = chunk.choices?.[0];
      if (choice?.finish_reason) finishReason = choice.finish_reason;
      const delta = choice?.delta;
      if (delta?.content) {
        content += delta.content;
        onDelta(delta.content);
      }
      for (const tc of delta?.tool_calls ?? []) {
        const idx = tc.index ?? 0;
        const cur = toolCalls.get(idx) ?? {
          id: "",
          type: "function" as const,
          function: { name: "", arguments: "" },
        };
        if (tc.id) cur.id = tc.id;
        if (tc.function?.name) cur.function.name = tc.function.name;
        if (tc.function?.arguments) cur.function.arguments += tc.function.arguments;
        toolCalls.set(idx, cur);
      }
    }
  }

  const dropped = !sawDone && !finishReason;
  if (dropped && !content && toolCalls.size === 0) {
    throw new Error("stream dropped before any content arrived");
  }
  return {
    finish: finishReason === "tool_calls" && toolCalls.size > 0 ? "tool_calls" : "content",
    content,
    toolCalls: [...toolCalls.entries()].sort(([a], [b]) => a - b).map(([, tc]) => tc),
    info: { truncated: finishReason === "length", dropped },
  };
}

export async function streamScreen(messages: ChatMessage[], handlers: StreamHandlers) {
  const { onDelta, onDone, onError, onToolRound, signal } = handlers;
  const convo: ChatMessage[] = [...messages];

  try {
    for (let round = 0; ; round++) {
      // Past the round budget, stop offering tools - forces a screen.
      const includeTools = toolsAvailable() && round < MAX_TOOL_ROUNDS;
      const result = await streamRound(convo, includeTools, onDelta, signal);

      if (result.finish !== "tool_calls") {
        onDone(result.info);
        return;
      }

      const calls = result.toolCalls.map((tc) => {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          // malformed arguments - executeTool reports the empty query
        }
        return { name: tc.function.name, args };
      });

      if ((onToolRound?.(calls) ?? "continue") === "abort") {
        throw new Error(NEEDS_LIVE_DATA);
      }

      convo.push({
        role: "assistant",
        content: result.content || null,
        tool_calls: result.toolCalls,
      });
      const outputs = await Promise.all(calls.map((c) => executeTool(c.name, c.args, signal)));
      if (signal?.aborted) return;
      result.toolCalls.forEach((tc, i) => {
        convo.push({ role: "tool", tool_call_id: tc.id, content: outputs[i] });
      });
    }
  } catch (err) {
    if (signal?.aborted) return;
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}
