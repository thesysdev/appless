import { Buffer } from "buffer";

jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));
jest.mock("../src/config", () => ({
  MODEL_BASE_URL: "http://gpu.test:8000/v1",
  GENOS_MODEL: "OUI-1",
  GENOS_MAX_TOKENS: 4096,
  modelKey: {
    ready: Promise.resolve(),
    get: jest.fn(),
    getStatus: jest.fn(),
    markRejected: jest.fn(),
  },
}));
jest.mock("../src/genos/tools/search", () => ({
  TOOLS_PROMPT_SECTION: "\nLIVE TOOL INSTRUCTIONS",
  TOOL_DEFS: [{ type: "function", function: { name: "web_search" } }],
  toolsAvailable: jest.fn(),
  executeTool: jest.fn(),
}));

import { fetch as expoFetch } from "expo/fetch";
import { modelKey } from "../src/config";
import { streamScreen, NEEDS_LIVE_DATA, type ChatMessage } from "../src/genos/stream";
import { executeTool, toolsAvailable } from "../src/genos/tools/search";

const fetchMock = jest.mocked(expoFetch);
const event = (delta: object, finish_reason: string | null = null) =>
  `data: ${JSON.stringify({ choices: [{ delta, finish_reason }] })}\n\n`;

function response(wire: string, chunkSize = 17) {
  const bytes = Buffer.from(wire, "utf8");
  let offset = 0;
  const reader = {
    read: jest.fn(async () => {
      if (offset >= bytes.length) return { done: true, value: undefined };
      const value = bytes.subarray(offset, offset + chunkSize);
      offset += chunkSize;
      return { done: false, value };
    }),
    releaseLock: jest.fn(),
  };
  return {
    status: 200, ok: true, body: { getReader: () => reader }, text: async () => "", reader,
  };
}

function enqueue(wire: string, chunkSize?: number) {
  const res = response(wire, chunkSize);
  fetchMock.mockResolvedValueOnce(res as unknown as Awaited<ReturnType<typeof expoFetch>>);
  return res;
}

function fail(status: number, detail = "server error") {
  fetchMock.mockResolvedValueOnce({
    status, ok: false, body: null, text: async () => detail,
  } as unknown as Awaited<ReturnType<typeof expoFetch>>);
}

const screen = 'root = Card([title])\ntitle = CardHeader("Bengaluru ☀️")';
const complete = () => enqueue(event({ content: screen }, "stop") + "data: [DONE]\n\n");
const toolRound = () => enqueue(
  event({ tool_calls: [{ index: 0, id: "call-1", function: { name: "web_search", arguments: '{"query":' } }] }) +
  event({ tool_calls: [{ index: 0, function: { arguments: '"Bengaluru weather"}' } }] }, "tool_calls") +
  "data: [DONE]\n\n",
);
const handlers = () => ({ onDelta: jest.fn(), onDone: jest.fn(), onError: jest.fn(), onToolRound: jest.fn() });
const messages: ChatMessage[] = [{ role: "user", content: "Show weather" }];
const body = (i = 0) => JSON.parse(fetchMock.mock.calls[i][1]?.body as string);

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(modelKey.get).mockReturnValue(null);
  jest.mocked(modelKey.getStatus).mockReturnValue("anonymous");
  jest.mocked(toolsAvailable).mockReturnValue(false);
  jest.mocked(executeTool).mockResolvedValue("Bengaluru: 24°C, sunny");
});

it("renders whole diffusion blocks split across network/UTF-8 boundaries without authentication", async () => {
  const res = enqueue(event({ content: screen }, "stop") + "data: [DONE]", 1);
  const h = handlers();
  await streamScreen(messages, h);
  expect(h.onDelta.mock.calls.map(([text]) => text).join("")).toBe(screen);
  expect(h.onDone).toHaveBeenCalledWith({ truncated: false, dropped: false });
  expect(h.onError).not.toHaveBeenCalled();
  expect(fetchMock.mock.calls[0][0]).toBe("http://gpu.test:8000/v1/chat/completions");
  expect(fetchMock.mock.calls[0][1]?.headers).not.toHaveProperty("Authorization");
  expect(body()).toMatchObject({ model: "OUI-1", stream: true, max_tokens: 4096 });
  expect(body()).not.toHaveProperty("temperature");
  expect(body()).not.toHaveProperty("tools");
  expect(res.reader.releaseLock).toHaveBeenCalled();
});

it("appends consecutive committed blocks in order", async () => {
  const blocks = ['root = Card([h])\n', 'h = CardHeader("Weather")'];
  enqueue(event({ content: blocks[0] }) + event({ content: blocks[1] }, "stop"), 1024);
  const h = handlers();
  await streamScreen(messages, h);
  expect(h.onDelta.mock.calls.map(([text]) => text)).toEqual(blocks);
  expect(h.onDone).toHaveBeenCalledWith({ truncated: false, dropped: false });
});

it("sends a configured key and opens authentication after an anonymous 401", async () => {
  jest.mocked(modelKey.get).mockReturnValueOnce("server-key");
  complete();
  await streamScreen(messages, handlers());
  expect(fetchMock.mock.calls[0][1]?.headers).toHaveProperty("Authorization", "Bearer server-key");
  fail(401);
  const h = handlers();
  await streamScreen(messages, h);
  expect(modelKey.markRejected).toHaveBeenCalledWith(null);
  expect(h.onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("access key") }));
});

it("does not send requests while a required key is missing", async () => {
  jest.mocked(modelKey.getStatus).mockReturnValue("missing");
  const h = handlers();
  await streamScreen(messages, h);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(h.onError).toHaveBeenCalled();
});

it("accumulates tool arguments and returns results to the next model round", async () => {
  jest.mocked(toolsAvailable).mockReturnValue(true);
  toolRound(); complete();
  const h = handlers();
  await streamScreen(messages, h);
  expect(executeTool).toHaveBeenCalledWith("web_search", { query: "Bengaluru weather" }, undefined);
  expect(body().tool_choice).toBe("auto");
  expect(body(1).messages.slice(-2)).toEqual([
    expect.objectContaining({ role: "assistant", tool_calls: [expect.objectContaining({ id: "call-1" })] }),
    { role: "tool", tool_call_id: "call-1", content: "Bengaluru: 24°C, sunny" },
  ]);
  expect(h.onDone).toHaveBeenCalled();
});

it("stops tools after three rounds and removes their prompt instructions", async () => {
  jest.mocked(toolsAvailable).mockReturnValue(true);
  toolRound(); toolRound(); toolRound(); complete();
  await streamScreen(messages, handlers());
  expect(executeTool).toHaveBeenCalledTimes(3);
  expect(body(3)).not.toHaveProperty("tools");
  expect(body(3).messages[0].content).not.toContain("LIVE TOOL INSTRUCTIONS");
});

it("does not execute tools when a speculative generation refuses them", async () => {
  jest.mocked(toolsAvailable).mockReturnValue(true);
  toolRound();
  const h = handlers();
  h.onToolRound.mockReturnValue("abort");
  await streamScreen(messages, h);
  expect(executeTool).not.toHaveBeenCalled();
  expect(h.onError).toHaveBeenCalledWith(new Error(NEEDS_LIVE_DATA));
});

it("treats finish_reason tool_calls with an empty call list as screen content", async () => {
  enqueue(event({ content: screen, tool_calls: [] }, "tool_calls"));
  const h = handlers();
  await streamScreen(messages, h);
  expect(executeTool).not.toHaveBeenCalled();
  expect(h.onDone).toHaveBeenCalled();
});

it("preserves current tool exchanges while trimming ancestors after context overflow", async () => {
  const history: ChatMessage[] = [
    { role: "user", content: "Old screen" }, { role: "assistant", content: "old UI" },
    ...messages,
  ];
  jest.mocked(toolsAvailable).mockReturnValue(true);
  toolRound();
  fail(400, "This model's maximum context length is 16384 tokens");
  complete();
  const h = handlers();
  await streamScreen(history, h);
  const trimmed = body(2).messages;
  expect(trimmed[1]).toEqual(messages[0]);
  expect(trimmed.slice(-2).map((m: ChatMessage) => m.role)).toEqual(["assistant", "tool"]);
  expect(history).toHaveLength(3); // caller's history is untouched
  expect(h.onDone).toHaveBeenCalled();
});

it("reports context overflow when the current request alone is too long", async () => {
  fail(400, "maximum context length exceeded");
  const h = handlers();
  await streamScreen(messages, h);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(h.onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("Shorten") }));
});

it("does not retry unrelated server errors", async () => {
  fail(500);
  const h = handlers();
  await streamScreen(messages, h);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(h.onError).toHaveBeenCalledWith(new Error("server error"));
});

it.each([
  [event({ content: screen }), { truncated: false, dropped: true }],
  [event({ content: screen }, "length"), { truncated: true, dropped: false }],
])("reports incomplete streams", async (wire, info) => {
  enqueue(wire);
  const h = handlers();
  await streamScreen(messages, h);
  expect(h.onDone).toHaveBeenCalledWith(info);
});

it("forwards cancellation and releases the reader without surfacing an abort error", async () => {
  const controller = new AbortController();
  const res = response("");
  res.reader.read.mockImplementation(async () => {
    controller.abort();
    throw new Error("aborted");
  });
  fetchMock.mockResolvedValueOnce(res as unknown as Awaited<ReturnType<typeof expoFetch>>);
  const h = handlers();
  await streamScreen(messages, { ...h, signal: controller.signal });
  expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
  expect(h.onError).not.toHaveBeenCalled();
  expect(h.onDone).not.toHaveBeenCalled();
  expect(res.reader.releaseLock).toHaveBeenCalled();
});
