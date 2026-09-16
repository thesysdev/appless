/**
 * The app talks directly to an OpenAI-compatible model server (OUI-1/vLLM
 * by default). Authentication is optional; protected endpoints can supply
 * a key at build time or ask for one on-device.
 */
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export const MODEL_BASE_URL: string = (
  process.env.EXPO_PUBLIC_MODEL_BASE_URL?.trim() ||
  (Platform.OS === "android" ? "http://10.0.2.2:8000/v1" : "http://localhost:8000/v1")
).replace(/\/+$/, "");
export const GENOS_MODEL = process.env.EXPO_PUBLIC_GENOS_MODEL?.trim() || "OUI-1";
export const MODEL_AUTH_REQUIRED = process.env.EXPO_PUBLIC_MODEL_AUTH_REQUIRED === "1";

function integerSetting(value: string | undefined, fallback: number, min: number, max: number) {
  const n = value?.trim() ? Number(value) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

export const GENOS_MAX_TOKENS = integerSetting(process.env.EXPO_PUBLIC_GENOS_MAX_TOKENS, 4096, 1, 16384);
/** Zero disables prefetch; foreground requests always take priority. */
export const PREFETCH_CONCURRENCY = integerSetting(
  process.env.EXPO_PUBLIC_GENOS_PREFETCH_CONCURRENCY, 1, 0, 6,
);

/** Optional tool keys - features degrade gracefully when absent. */
export const UNSPLASH_ACCESS_KEY = process.env.EXPO_PUBLIC_UNSPLASH_ACCESS_KEY;
export const EXA_API_KEY = process.env.EXPO_PUBLIC_EXA_API_KEY;

// SecureStore keys allow only alphanumerics, '.', '-' and '_'. Scope saved
// credentials to the endpoint so switching servers never reuses another key.
const STORAGE_KEY = `genos.model-key.${Array.from(MODEL_BASE_URL, (c) => c.codePointAt(0)!.toString(16)).join("-")}`;
const ENV_KEY = process.env.EXPO_PUBLIC_MODEL_API_KEY;

async function persistedRead(): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(STORAGE_KEY);
}

async function persistedWrite(value: string | null) {
  if (Platform.OS === "web") {
    try {
      if (value === null) globalThis.localStorage?.removeItem(STORAGE_KEY);
      else globalThis.localStorage?.setItem(STORAGE_KEY, value);
    } catch {
      // storage unavailable (private mode) - key lives for the session only
    }
    return;
  }
  if (value === null) await SecureStore.deleteItemAsync(STORAGE_KEY);
  else await SecureStore.setItemAsync(STORAGE_KEY, value);
}

export type KeyStatus = "loading" | "missing" | "present" | "anonymous" | "rejected";

/**
 * Tiny external store (mirrors screenStore's shape) so the shell can gate on
 * key availability via useSyncExternalStore.
 */
class KeyStore {
  private key: string | null = ENV_KEY?.trim() || null;
  private status: KeyStatus = this.key ? "present" : "loading";
  private listeners = new Set<() => void>();
  readonly ready: Promise<void>;

  constructor() {
    this.ready = this.key
      ? Promise.resolve()
      : persistedRead()
          .then((stored) => {
            // A key entered while hydration was in flight wins.
            if (this.status !== "loading") return;
            this.key = stored?.trim() || null;
            this.setStatus(this.key ? "present" : MODEL_AUTH_REQUIRED ? "missing" : "anonymous");
          })
          .catch(() => {
            if (this.status === "loading") {
              this.setStatus(MODEL_AUTH_REQUIRED ? "missing" : "anonymous");
            }
          });
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getStatus = (): KeyStatus => this.status;

  get(): string | null {
    return this.key;
  }

  async set(key: string) {
    const value = key.trim();
    if (!value) return;
    this.key = value;
    this.setStatus("present");
    await persistedWrite(this.key).catch(() => {});
  }

  /**
   * The API rejected `rejectedKey` (401/403) - drop it and re-show the gate.
   * No-ops if the user already replaced the key (a stale in-flight stream
   * must not wipe a newly entered valid key).
   */
  markRejected(rejectedKey: string | null) {
    if (this.key !== rejectedKey) return;
    this.key = null;
    this.setStatus("rejected");
    persistedWrite(null).catch(() => {});
  }

  private setStatus(s: KeyStatus) {
    this.status = s;
    this.listeners.forEach((fn) => fn());
  }
}

export const modelKey = new KeyStore();
