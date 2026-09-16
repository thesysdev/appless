jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

const originalEnv = process.env;
beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
  for (const key of Object.keys(process.env)) {
    if (/^EXPO_PUBLIC_(MODEL_|GENOS_)/.test(key)) delete process.env[key];
  }
});
afterEach(() => { process.env = originalEnv; });

const config = (): typeof import("../src/config") => require("../src/config");
const storage = (): jest.Mocked<typeof import("expo-secure-store")> => require("expo-secure-store");

it("defaults to OUI-1, local anonymous access, and one background generation", async () => {
  const c = config();
  await c.modelKey.ready;
  expect(c.MODEL_BASE_URL).toBe("http://localhost:8000/v1");
  expect(c.GENOS_MODEL).toBe("OUI-1");
  expect(c.GENOS_MAX_TOKENS).toBe(4096);
  expect(c.PREFETCH_CONCURRENCY).toBe(1);
  expect(c.modelKey.getStatus()).toBe("anonymous");
});

it("uses the host alias on the Android emulator", () => {
  require("react-native").Platform.OS = "android";
  expect(config().MODEL_BASE_URL).toBe("http://10.0.2.2:8000/v1");
});

it("allows required authentication and short non-empty server keys", async () => {
  process.env.EXPO_PUBLIC_MODEL_AUTH_REQUIRED = "1";
  const c = config();
  await c.modelKey.ready;
  expect(c.modelKey.getStatus()).toBe("missing");
  await c.modelKey.set(" x ");
  expect(c.modelKey.get()).toBe("x");
  expect(c.modelKey.getStatus()).toBe("present");
});

it("uses environment keys without reading device storage", async () => {
  process.env.EXPO_PUBLIC_MODEL_API_KEY = " configured-key ";
  const c = config();
  await c.modelKey.ready;
  expect(c.modelKey.get()).toBe("configured-key");
  expect(storage().getItemAsync).not.toHaveBeenCalled();
});

it("opens the gate after an anonymous rejection and ignores stale rejections", async () => {
  const c = config();
  await c.modelKey.ready;
  c.modelKey.markRejected(null);
  expect(c.modelKey.getStatus()).toBe("rejected");
  await c.modelKey.set("new-key");
  c.modelKey.markRejected(null);
  c.modelKey.markRejected("old-key");
  expect(c.modelKey.get()).toBe("new-key");
  c.modelKey.markRejected("new-key");
  expect(c.modelKey.get()).toBeNull();
});

it("never replaces a newly entered key with a late hydration result", async () => {
  let finish!: (value: string) => void;
  storage().getItemAsync.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  const c = config();
  await c.modelKey.set("new-key");
  finish("old-key");
  await c.modelKey.ready;
  expect(c.modelKey.get()).toBe("new-key");
});

it("scopes persisted keys to normalized endpoints using SecureStore-safe names", async () => {
  process.env.EXPO_PUBLIC_MODEL_BASE_URL = "https://one.test/v1///";
  let c = config();
  await c.modelKey.ready;
  const first = storage().getItemAsync.mock.calls[0][0];
  expect(c.MODEL_BASE_URL).toBe("https://one.test/v1");
  expect(first).toMatch(/^[\w.-]+$/);
  expect(first).not.toBe("genos.cerebras-key");
  jest.resetModules();
  process.env.EXPO_PUBLIC_MODEL_BASE_URL = "https://two.test/v1";
  c = config();
  await c.modelKey.ready;
  expect(storage().getItemAsync.mock.calls[0][0]).not.toBe(first);
});

it("accepts zero prefetch and falls back for invalid numeric settings", () => {
  process.env.EXPO_PUBLIC_GENOS_PREFETCH_CONCURRENCY = "0";
  process.env.EXPO_PUBLIC_GENOS_MAX_TOKENS = "invalid";
  expect(config().PREFETCH_CONCURRENCY).toBe(0);
  expect(config().GENOS_MAX_TOKENS).toBe(4096);
});
