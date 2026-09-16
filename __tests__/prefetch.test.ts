import type { streamScreen } from "../src/genos/stream";
type Handlers = Parameters<typeof streamScreen>[1];
const mockCalls: Array<{ messages: Parameters<typeof streamScreen>[0]; handlers: Handlers }> = [];

jest.mock("../src/config", () => ({
  PREFETCH_CONCURRENCY: Number(process.env.EXPO_PUBLIC_GENOS_PREFETCH_CONCURRENCY ?? "1"),
}));
jest.mock("../src/genos/stream", () => ({
  streamScreen: jest.fn((messages, handlers) => { mockCalls.push({ messages, handlers }); }),
}));

const env = process.env.EXPO_PUBLIC_GENOS_PREFETCH_CONCURRENCY;
beforeEach(() => {
  jest.resetModules();
  mockCalls.length = 0;
  delete process.env.EXPO_PUBLIC_GENOS_PREFETCH_CONCURRENCY;
});
afterEach(() => {
  if (env === undefined) delete process.env.EXPO_PUBLIC_GENOS_PREFETCH_CONCURRENCY;
  else process.env.EXPO_PUBLIC_GENOS_PREFETCH_CONCURRENCY = env;
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

it("queues destinations and starts only one background stream at a time", async () => {
  const s = loadStore();
  const root = s.openApp(app);
  s.setActiveScreen(root);
  finish(0, actions);
  await Promise.resolve();
  expect(mockCalls).toHaveLength(2);
  expect(s.screenStore.all().filter((screen) => screen.speculative)).toHaveLength(3);
  finish(1);
  await Promise.resolve();
  expect(mockCalls).toHaveLength(3);
  expect(mockCalls[2].messages.at(-1)?.content).toBe("Second");
});

it("starts a tapped queued destination immediately and ignores aborted callbacks", async () => {
  const s = loadStore();
  const root = s.openApp(app);
  s.setActiveScreen(root);
  finish(0, actions);
  await Promise.resolve();
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

it("pauses work when hidden and restarts it when the parent is revisited", async () => {
  const s = loadStore();
  const root = s.openApp(app);
  s.setActiveScreen(root);
  finish(0, actions);
  await Promise.resolve();
  s.setActiveScreen(null);
  expect(mockCalls[1].handlers.signal?.aborted).toBe(true);
  await Promise.resolve();
  expect(mockCalls).toHaveLength(2);
  s.setActiveScreen(root);
  await Promise.resolve();
  expect(mockCalls).toHaveLength(3);
  expect(mockCalls[2].messages.at(-1)?.content).toBe("First");
});

it("lets a new foreground request preempt background generation", async () => {
  const s = loadStore();
  const root = s.openApp(app);
  s.setActiveScreen(root);
  finish(0, actions);
  await Promise.resolve();
  s.openApp({ ...app, id: "another", request: "Open another" });
  expect(mockCalls[1].handlers.signal?.aborted).toBe(true);
  expect(mockCalls[2].messages.at(-1)?.content).toBe("Open another");
  await Promise.resolve();
  expect(mockCalls).toHaveLength(3);
});

it("can disable speculative generation", async () => {
  process.env.EXPO_PUBLIC_GENOS_PREFETCH_CONCURRENCY = "0";
  const s = loadStore();
  const root = s.openApp(app);
  s.setActiveScreen(root);
  finish(0, actions);
  await Promise.resolve();
  expect(mockCalls).toHaveLength(1);
});

it("respects a configured concurrency of two", async () => {
  process.env.EXPO_PUBLIC_GENOS_PREFETCH_CONCURRENCY = "2";
  const s = loadStore();
  const root = s.openApp(app);
  s.setActiveScreen(root);
  finish(0, actions);
  await Promise.resolve();
  expect(mockCalls).toHaveLength(3);
});
