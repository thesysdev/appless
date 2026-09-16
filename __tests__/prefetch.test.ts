import type { streamScreen } from "../src/genos/stream";
type Handlers = Parameters<typeof streamScreen>[1];
const mockCalls: Array<{ messages: Parameters<typeof streamScreen>[0]; handlers: Handlers }> = [];

jest.mock("../src/config", () => ({
  PREFETCH_CONCURRENCY: 1,
}));
jest.mock("../src/genos/stream", () => ({
  streamScreen: jest.fn((messages, handlers) => { mockCalls.push({ messages, handlers }); }),
}));

beforeEach(() => {
  jest.resetModules();
  mockCalls.length = 0;
});
const loadStore = (): typeof import("../src/genos/store") => require("../src/genos/store");
const app = { id: "test", name: "Test", emoji: "", tile: ["#000", "#111"] as [string, string], request: "Open test" };
const actions = ["First", "Second", "Third"].map((name) =>
  `${name} = Button("${name}", Action([@ToAssistant("${name}")]))`,
).join("\n");
function finish(i: number, content = 'root = Card([h])\nh = CardHeader("Done")') {
  mockCalls[i].handlers.onDelta(content);
  mockCalls[i].handlers.onDone({ truncated: false, dropped: false });
}

it("limits prefetch concurrency and prioritizes a tapped queued destination", async () => {
  const s = loadStore();
  const root = s.openApp(app);
  s.setActiveScreen(root);
  finish(0, actions);
  await Promise.resolve();
  expect(mockCalls).toHaveLength(2); // root + one active prefetch, two queued
  const first = s.screenStore.all().find((screen) => screen.request === "First")!;
  const queued = s.screenStore.all().find((screen) => screen.request === "Third")!;
  const child = s.resolveAction(root, "Third");
  expect(child).toBe(queued.id);
  expect(mockCalls[1].handlers.signal?.aborted).toBe(true);
  expect(mockCalls[2].messages.at(-1)?.content).toBe("Third");
  s.setActiveScreen(child);
  finish(1, "stale content");
  expect(s.screenStore.get(first.id)?.content).toBe("");
  expect(s.screenStore.get(child)?.speculative).toBe(false);
  await Promise.resolve();
  expect(mockCalls).toHaveLength(3);
});

it("promotes an already-streaming prefetch without restarting it", async () => {
  const s = loadStore();
  const root = s.openApp(app);
  s.setActiveScreen(root);
  finish(0, actions);
  await Promise.resolve();
  const child = s.resolveAction(root, "First");
  s.setActiveScreen(child);
  expect(mockCalls).toHaveLength(2);
  expect(mockCalls[1].handlers.signal?.aborted).toBe(false);
  finish(1);
  await Promise.resolve();
  expect(s.screenStore.get(child)?.status).toBe("done");
});
