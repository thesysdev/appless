/**
 * The OpenUI Cloud contract: what the app sends (endpoint, key, model,
 * Cerebras-only routing, generated config block) and what it accepts back
 * (openui-lang wrapped in inline section markers).
 */

jest.mock("expo-secure-store", () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
}));

jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));

import { fetch as expoFetch } from "expo/fetch";
import { thesysKey } from "../src/config";
import { CHAT_LIBRARY_ID } from "../src/genos/chatLibrary";
import { SYSTEM_PROMPT } from "../src/genos/generated/system-prompt";
import { cleanLang } from "../src/genos/store";
import { streamScreen } from "../src/genos/stream";

const mockFetch = expoFetch as unknown as jest.Mock;

/** An SSE body of one content delta per chunk, then [DONE]. */
function sseBody(deltas: string[]) {
  const frames = [
    ...deltas.map(
      (content, i) =>
        `data: ${JSON.stringify({
          choices: [{ delta: { content }, finish_reason: i === deltas.length - 1 ? "stop" : null }],
        })}\n\n`,
    ),
    "data: [DONE]\n\n",
  ];
  let i = 0;
  const encoder = new TextEncoder();
  return {
    getReader: () => ({
      read: async () =>
        i < frames.length
          ? { done: false, value: encoder.encode(frames[i++]) }
          : { done: true, value: undefined },
    }),
  };
}

function streamOnce() {
  return new Promise<string>((resolve, reject) => {
    let text = "";
    streamScreen([{ role: "user", content: "wifi settings" }], {
      onDelta: (d) => {
        text += d;
      },
      onDone: () => resolve(text),
      onError: reject,
    });
  });
}

beforeAll(async () => {
  await thesysKey.set("sk-th-test-key");
});

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, status: 200, body: sseBody(["root = Card([h])"]) });
});

describe("generated request config", () => {
  it("is an OpenUI Cloud config block carrying the app's component library", () => {
    expect(SYSTEM_PROMPT.startsWith("]]>openui:config\n")).toBe(true);
    const config = JSON.parse(SYSTEM_PROMPT.slice("]]>openui:config\n".length).split("\n")[0]);
    expect(config.chatLibrary.id).toBe(CHAT_LIBRARY_ID);
    expect(config.chatLibrary.root).toBe("Card");
    // Every component the renderer supports must be offered to the model.
    expect(Object.keys(config.chatLibrary.schema.$defs)).toEqual(
      expect.arrayContaining(["Card", "CardHeader", "ListItem", "Bubbles", "AreaChart", "Button"]),
    );
    expect(config.systemPromptOptions.additionalRules.join(" ")).toContain("@ToAssistant");
  });
});

describe("streamRound request", () => {
  it("posts to the embed endpoint with the Thesys key and Cerebras-only routing", async () => {
    await streamOnce();

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.thesys.dev/v1/embed/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer sk-th-test-key");

    const body = JSON.parse(init.body);
    expect(body.model).toBe("google/gemma-4-31b-it");
    expect(body.stream).toBe(true);
    expect(body.provider).toEqual({ only: ["cerebras"], allow_fallbacks: false });
    expect(JSON.parse(body.metadata.thesys)).toEqual({
      c1_openrouter_provider: { only: ["cerebras"], allow_fallbacks: false },
    });
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content.startsWith("]]>openui:config\n")).toBe(true);
  });
});

describe("wrapped response", () => {
  it("surfaces only the program, even when markers split across deltas", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody([
        "]]>openui:content?thesys=true&libraryVersion=appless-native-0.1.0\nroot",
        " = Card([h])\nh = CardHeader(",
        '"Wi-Fi")\n]]>openui',
        ":end",
      ]),
    });

    expect(cleanLang(await streamOnce())).toBe('root = Card([h])\nh = CardHeader("Wi-Fi")');
  });
});
