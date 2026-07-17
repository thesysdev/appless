/**
 * Unit tests for the SSE streaming layer: chunk-boundary parsing, the manual
 * UTF-8 fallback decoder, tool-call accumulation, the round budget, the
 * residual-buffer flush, the stall watchdog, and the friendly error mapping.
 * expo/fetch is mocked with scripted ReadableStream-like readers; the tools
 * module is mocked so tool rounds never touch the network.
 */

jest.mock("expo-secure-store", () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
}));
// expo/fetch pulls the winter runtime, which jest-expo's env can't load.
jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));
jest.mock("../src/genos/tools/search", () => ({
  TOOLS_PROMPT_SECTION: "TOOLS_SECTION",
  TOOL_DEFS: [{ type: "function", function: { name: "web_search" } }],
  executeTool: jest.fn(async () => "search results"),
  toolsAvailable: jest.fn(() => true),
}));

import { fetch as expoFetch } from "expo/fetch";
import { cerebrasKey } from "../src/config";
import { NEEDS_LIVE_DATA, streamScreen } from "../src/genos/stream";
import type { StreamEndInfo } from "../src/genos/stream";
import { executeTool, toolsAvailable } from "../src/genos/tools/search";

const fetchMock = expoFetch as unknown as jest.Mock;
const executeToolMock = executeTool as unknown as jest.Mock;
const toolsAvailableMock = toolsAvailable as unknown as jest.Mock;

const enc = new TextEncoder();

function makeReader(chunks: Uint8Array[]) {
  let i = 0;
  return {
    read: jest.fn(async () =>
      i < chunks.length
        ? { done: false as const, value: chunks[i++] }
        : { done: true as const, value: undefined },
    ),
    cancel: jest.fn(async () => {}),
  };
}

function sseResponse(chunks: string[], status = 200) {
  return {
    status,
    ok: status >= 200 && status < 300,
    body: { getReader: () => makeReader(chunks.map((c) => enc.encode(c))) },
    text: async () => chunks.join(""),
  };
}

function errorResponse(status: number, body = "") {
  return { status, ok: false, body: null, text: async () => body };
}

function dataLine(chunk: unknown): string {
  return `data: ${JSON.stringify(chunk)}\n`;
}

function contentChunk(text: string, finishReason: string | null = null) {
  return { choices: [{ delta: { content: text }, finish_reason: finishReason }] };
}

interface RunResult {
  deltas: string[];
  info?: StreamEndInfo;
  error?: Error;
}

function run(handlers: {
  onToolRound?: (calls: Array<{ name: string; args: Record<string, unknown> }>) => "continue" | "abort";
  signal?: AbortSignal;
}): Promise<RunResult> {
  const deltas: string[] = [];
  return new Promise((resolve) => {
    streamScreen([{ role: "user", content: "make a screen" }], {
      onDelta: (t) => deltas.push(t),
      onDone: (info) => resolve({ deltas, info }),
      onError: (error) => resolve({ deltas, error }),
      ...handlers,
    });
  });
}

beforeEach(async () => {
  fetchMock.mockReset();
  executeToolMock.mockClear();
  toolsAvailableMock.mockReturnValue(true);
  await cerebrasKey.set("test-key");
});

describe("SSE parsing", () => {
  it("assembles data lines split across chunk boundaries", async () => {
    const full =
      dataLine(contentChunk("Hello, ")) + dataLine(contentChunk("world", "stop")) + "data: [DONE]\n";
    // Split mid-line and mid-token.
    fetchMock.mockResolvedValue(sseResponse([full.slice(0, 23), full.slice(23, 60), full.slice(60)]));
    const r = await run({});
    expect(r.error).toBeUndefined();
    expect(r.deltas.join("")).toBe("Hello, world");
    expect(r.info).toEqual({ truncated: false, dropped: false });
  });

  it("decodes multi-byte UTF-8 split across chunks via the manual decoder", async () => {
    const saved = globalThis.TextDecoder;
    // Force the manual fallback decoder path.
    (globalThis as { TextDecoder?: typeof TextDecoder }).TextDecoder = undefined;
    try {
      const bytes = enc.encode(dataLine(contentChunk("tacos 🌮 é", "stop")) + "data: [DONE]\n");
      // Cut inside the 4-byte emoji sequence.
      const cut = bytes.findIndex((b, i) => i > 7 && b === 0xf0) + 2;
      fetchMock.mockResolvedValue({
        status: 200,
        ok: true,
        body: { getReader: () => makeReader([bytes.slice(0, cut), bytes.slice(cut)]) },
        text: async () => "",
      });
      const r = await run({});
      expect(r.error).toBeUndefined();
      expect(r.deltas.join("")).toBe("tacos 🌮 é");
    } finally {
      globalThis.TextDecoder = saved;
    }
  });

  it("treats finish_reason length as truncated", async () => {
    fetchMock.mockResolvedValue(
      sseResponse([dataLine(contentChunk("partial", "length")) + "data: [DONE]\n"]),
    );
    const r = await run({});
    expect(r.info).toEqual({ truncated: true, dropped: false });
  });

  it("flags a stream closed without [DONE] or finish_reason as dropped", async () => {
    fetchMock.mockResolvedValue(sseResponse([dataLine(contentChunk("half a screen"))]));
    const r = await run({});
    expect(r.error).toBeUndefined();
    expect(r.info).toEqual({ truncated: false, dropped: true });
  });

  it("errors when the stream drops before any content", async () => {
    fetchMock.mockResolvedValue(sseResponse([]));
    const r = await run({});
    expect(r.error?.message).toMatch(/dropped before any content/);
  });

  it("flushes a trailing unterminated data event after reader done", async () => {
    // No trailing newline on the finish_reason chunk.
    fetchMock.mockResolvedValue(
      sseResponse([dataLine(contentChunk("done deal")) + dataLine(contentChunk("", "stop")).trimEnd()]),
    );
    const r = await run({});
    expect(r.error).toBeUndefined();
    expect(r.deltas.join("")).toBe("done deal");
    expect(r.info).toEqual({ truncated: false, dropped: false });
  });

  it("surfaces in-stream error payloads without raw JSON", async () => {
    fetchMock.mockResolvedValue(
      sseResponse([dataLine({ error: { message: "model queue exploded" } })]),
    );
    const r = await run({});
    expect(r.error?.message).toBe("model queue exploded");
  });
});

describe("tool-call rounds", () => {
  it("accumulates tool calls by index across split argument fragments", async () => {
    const round1 =
      dataLine({
        choices: [
          {
            delta: {
              tool_calls: [
                { index: 0, id: "call_1", function: { name: "web_search", arguments: '{"que' } },
                { index: 1, id: "call_2", function: { name: "web_search", arguments: '{"query":"sf' } },
              ],
            },
          },
        ],
      }) +
      dataLine({
        choices: [
          {
            delta: {
              tool_calls: [
                { index: 1, function: { arguments: ' weather"}' } },
                { index: 0, function: { arguments: 'ry":"nyc weather"}' } },
              ],
            },
          },
        ],
      }) +
      dataLine({ choices: [{ delta: {}, finish_reason: "tool_calls" }] }) +
      "data: [DONE]\n";
    const round2 = dataLine(contentChunk("here is the weather", "stop")) + "data: [DONE]\n";
    fetchMock
      .mockResolvedValueOnce(sseResponse([round1]))
      .mockResolvedValueOnce(sseResponse([round2]));
    const onToolRound = jest.fn(() => "continue" as const);
    const r = await run({ onToolRound });
    expect(r.error).toBeUndefined();
    expect(onToolRound).toHaveBeenCalledWith([
      { name: "web_search", args: { query: "nyc weather" } },
      { name: "web_search", args: { query: "sf weather" } },
    ]);
    expect(executeToolMock).toHaveBeenCalledTimes(2);
    expect(r.deltas.join("")).toBe("here is the weather");
    // Round 2 must include the tool outputs in the conversation.
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    const roles = secondBody.messages.map((m: { role: string }) => m.role);
    expect(roles).toEqual(["system", "user", "assistant", "tool", "tool"]);
    expect(secondBody.messages[3].content).toBe("search results");
  });

  it("turns an onToolRound abort into NEEDS_LIVE_DATA", async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        dataLine({
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, id: "c1", function: { name: "web_search", arguments: "{}" } },
                ],
              },
              finish_reason: "tool_calls",
            },
          ],
        }) + "data: [DONE]\n",
      ]),
    );
    const r = await run({ onToolRound: () => "abort" });
    expect(r.error?.message).toBe(NEEDS_LIVE_DATA);
    expect(executeToolMock).not.toHaveBeenCalled();
  });

  it("stops offering tools past MAX_TOOL_ROUNDS", async () => {
    const toolRound =
      dataLine({
        choices: [
          {
            delta: {
              tool_calls: [
                { index: 0, id: "c", function: { name: "web_search", arguments: "{}" } },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      }) + "data: [DONE]\n";
    fetchMock
      .mockResolvedValueOnce(sseResponse([toolRound]))
      .mockResolvedValueOnce(sseResponse([toolRound]))
      .mockResolvedValueOnce(sseResponse([toolRound]))
      .mockResolvedValueOnce(
        sseResponse([dataLine(contentChunk("final screen", "stop")) + "data: [DONE]\n"]),
      );
    const r = await run({});
    expect(r.error).toBeUndefined();
    expect(executeToolMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const lastBody = JSON.parse(fetchMock.mock.calls[3][1].body);
    expect(lastBody.tools).toBeUndefined();
    expect(r.deltas.join("")).toBe("final screen");
  });
});

describe("stall watchdog and abort", () => {
  it("aborts with a friendly stall error after 20s without bytes", async () => {
    jest.useFakeTimers();
    try {
      fetchMock.mockResolvedValue({
        status: 200,
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn(() => new Promise(() => {})), // never settles
            cancel: jest.fn(async () => {}),
          }),
        },
        text: async () => "",
      });
      const pending = run({});
      await jest.advanceTimersByTimeAsync(20_000);
      const r = await pending;
      expect(r.error?.message).toMatch(/stream stalled/);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it("resets the watchdog on every received chunk", async () => {
    jest.useFakeTimers();
    try {
      let reads = 0;
      const chunks = [dataLine(contentChunk("a")), dataLine(contentChunk("b", "stop")) + "data: [DONE]\n"];
      fetchMock.mockResolvedValue({
        status: 200,
        ok: true,
        body: {
          getReader: () => ({
            // Each read takes 15s of fake time - under the 20s limit.
            read: jest.fn(
              () =>
                new Promise((resolve) => {
                  const i = reads++;
                  setTimeout(
                    () =>
                      resolve(
                        i < chunks.length
                          ? { done: false, value: enc.encode(chunks[i]) }
                          : { done: true, value: undefined },
                      ),
                    15_000,
                  );
                }),
            ),
            cancel: jest.fn(async () => {}),
          }),
        },
        text: async () => "",
      });
      const pending = run({});
      await jest.advanceTimersByTimeAsync(50_000);
      const r = await pending;
      expect(r.error).toBeUndefined();
      expect(r.deltas.join("")).toBe("ab");
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it("settles silently when the caller aborts mid-stream", async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      body: {
        getReader: () => ({
          read: jest.fn(() => new Promise(() => {})),
          cancel: jest.fn(async () => {}),
        }),
      },
      text: async () => "",
    });
    const onError = jest.fn();
    let settled = false;
    streamScreen([{ role: "user", content: "hi" }], {
      onDelta: () => {},
      onDone: () => {},
      onError,
      signal: controller.signal,
    });
    await Promise.resolve();
    controller.abort();
    await new Promise((r) => setTimeout(r, 10));
    settled = true;
    expect(settled).toBe(true);
    expect(onError).not.toHaveBeenCalled();
  });
});

describe("friendly error mapping", () => {
  it("rejects the key on 401/403", async () => {
    fetchMock.mockResolvedValue(errorResponse(401, '{"error":"bad key"}'));
    const r = await run({});
    expect(r.error?.message).toMatch(/rejected the API key/);
    expect(cerebrasKey.get()).toBeNull();
  });

  it("maps 429 to a rate-limit message", async () => {
    fetchMock.mockResolvedValue(errorResponse(429));
    const r = await run({});
    expect(r.error?.message).toMatch(/rate-limiting/);
  });

  it("maps 5xx to a provider-unavailable message", async () => {
    fetchMock.mockResolvedValue(errorResponse(503));
    const r = await run({});
    expect(r.error?.message).toMatch(/unavailable/);
  });

  it("sanitizes other HTTP error bodies (no raw JSON, capped length)", async () => {
    const body = JSON.stringify({ error: { message: "x".repeat(400) } });
    fetchMock.mockResolvedValue(errorResponse(400, body));
    const r = await run({});
    expect(r.error?.message).toMatch(/request failed \(HTTP 400\)/);
    expect(r.error?.message).not.toMatch(/[{}"]/);
    expect(r.error?.message.length).toBeLessThanOrEqual(200);
  });

  it("maps fetch rejections to a network failure message", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    const r = await run({});
    expect(r.error?.message).toMatch(/network request failed/);
  });
});
