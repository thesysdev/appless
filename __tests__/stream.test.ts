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
import { streamScreen, type ChatMessage } from "../src/genos/stream";
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

it("appends diffusion blocks across network/UTF-8 boundaries without authentication", async () => {
  const blocks = ['root = Card([title])\n', 'title = CardHeader("Bengaluru ☀️")'];
  const res = enqueue(event({ content: blocks[0] }) + event({ content: blocks[1] }, "stop") + "data: [DONE]", 1);
  const h = handlers();
  await streamScreen(messages, h);
  expect(h.onDelta.mock.calls.map(([text]) => text).join("")).toBe(screen);
  expect(h.onDelta.mock.calls.map(([text]) => text)).toEqual(blocks);
  expect(h.onDone).toHaveBeenCalledWith({ truncated: false, dropped: false });
  expect(h.onError).not.toHaveBeenCalled();
  expect(fetchMock.mock.calls[0][0]).toBe("http://gpu.test:8000/v1/chat/completions");
  expect(fetchMock.mock.calls[0][1]?.headers).not.toHaveProperty("Authorization");
  expect(body()).toMatchObject({ model: "OUI-1", stream: true, max_tokens: 4096 });
  expect(body()).not.toHaveProperty("temperature");
  expect(body()).not.toHaveProperty("tools");
  expect(res.reader.releaseLock).toHaveBeenCalled();
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
