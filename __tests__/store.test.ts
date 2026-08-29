/**
 * Unit tests for the store's pure helpers and the action-resolution cache.
 * streamScreen is mocked - these tests never touch the network.
 */

jest.mock("expo-secure-store", () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
}));
jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));

// Capture stream launches instead of hitting Cerebras.
const streamCalls: Array<{ messages: unknown }> = [];
jest.mock("../src/genos/stream", () => ({
  NEEDS_LIVE_DATA: "needs live data",
  streamScreen: jest.fn((messages: unknown) => {
    streamCalls.push({ messages });
  }),
}));

import {
  cleanLang,
  extractActions,
  openApp,
  parseOsCommand,
  resolveAction,
  screenStore,
} from "../src/genos/store";

describe("cleanLang", () => {
  it("strips a wrapping markdown fence", () => {
    expect(cleanLang('```openui\nroot = Card([h])\nh = CardHeader("Hi")\n```')).toBe(
      'root = Card([h])\nh = CardHeader("Hi")',
    );
  });

  it("is safe on partial streams that opened a fence", () => {
    expect(cleanLang("```\nroot = Card([")).toBe("root = Card([");
  });

  it("leaves unfenced programs alone", () => {
    const program = 'root = Card([h])\nh = TextContent("uses ``` inline")';
    expect(cleanLang(program)).toBe(program);
  });
});

describe("parseOsCommand", () => {
  it("parses whole-response @OS commands", () => {
    expect(parseOsCommand("@OS(back)")).toEqual({ cmd: "back", arg: undefined });
    expect(parseOsCommand("  @OS(home)  ")).toEqual({ cmd: "home", arg: undefined });
    expect(parseOsCommand('@OS(open, "music")')).toEqual({ cmd: "open", arg: "music" });
  });

  it("rejects mixed screen + command responses", () => {
    expect(parseOsCommand('root = Card([h])\n@OS(back)')).toBeUndefined();
    expect(parseOsCommand("@OS(shutdown)")).toBeUndefined();
  });
});

describe("extractActions", () => {
  it("pulls unique @ToAssistant messages out of a program", () => {
    const program = [
      'a = ListItem("Wi-Fi", null, "wifi", null, Action([@ToAssistant("Open the Wi-Fi screen")]))',
      'b = ListItem("BT", null, "bluetooth", null, Action([@ToAssistant("Open the Bluetooth screen")]))',
      'c = Button("Again", Action([@ToAssistant("Open the Wi-Fi screen")]))',
    ].join("\n");
    expect(extractActions(program)).toEqual([
      "Open the Wi-Fi screen",
      "Open the Bluetooth screen",
    ]);
  });

  it("unescapes quoted characters", () => {
    expect(extractActions('Action([@ToAssistant("Say \\"hi\\" now")])')).toEqual(['Say "hi" now']);
  });
});

describe("resolveAction cache", () => {
  const app = {
    id: "settings",
    name: "Settings",
    emoji: "⚙️",
    tile: ["#000", "#111"] as [string, string],
    request: "Open settings",
  };

  it("reuses the cached child for a repeated action, and generates fresh for form submits", () => {
    const parentId = openApp(app);
    screenStore.patch(parentId, { status: "done" });

    const child1 = resolveAction(parentId, "Open the Wi-Fi screen");
    screenStore.patch(child1, { status: "done" });
    const child2 = resolveAction(parentId, "Open the Wi-Fi screen");
    expect(child2).toBe(child1);

    // Form submissions never reuse - the cached screen can't know the values.
    const formChild = resolveAction(parentId, "Open the Wi-Fi screen", { ssid: "HomeNet" });
    expect(formChild).not.toBe(child1);
    const formScreen = screenStore.get(formChild);
    expect(formScreen?.request).toContain('"ssid":"HomeNet"');
  });

  it("retries errored cached children in place instead of reusing them broken", () => {
    const parentId = openApp(app);
    screenStore.patch(parentId, { status: "done" });

    const child = resolveAction(parentId, "Open the Bluetooth screen");
    screenStore.patch(child, { status: "error", error: "boom", speculative: true });

    const launchesBefore = streamCalls.length;
    const again = resolveAction(parentId, "Open the Bluetooth screen");
    expect(again).toBe(child);
    expect(streamCalls.length).toBe(launchesBefore + 1);
    const retried = screenStore.get(child);
    expect(retried?.status).toBe("pending");
    // A user-initiated retry is never speculative (re-enables tools).
    expect(retried?.speculative).toBe(false);
  });
});
