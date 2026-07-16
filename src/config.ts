/**
 * All generation runs in the app itself - the phone talks straight to the
 * Cerebras API (BYOK). The key resolves from EXPO_PUBLIC_CEREBRAS_API_KEY at
 * build time, falling back to a device-stored key entered on first launch
 * (SecureStore on iOS/Android, localStorage on web).
 */
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export const CEREBRAS_BASE_URL =
  process.env.EXPO_PUBLIC_CEREBRAS_BASE_URL ?? "https://api.cerebras.ai/v1";
export const GENOS_MODEL = process.env.EXPO_PUBLIC_GENOS_MODEL ?? "gemma-4-31b";

/** Optional tool keys - features degrade gracefully when absent. */
export const UNSPLASH_ACCESS_KEY = process.env.EXPO_PUBLIC_UNSPLASH_ACCESS_KEY;
export const EXA_API_KEY = process.env.EXPO_PUBLIC_EXA_API_KEY;

const STORAGE_KEY = "genos.cerebras-key";
const ENV_KEY = process.env.EXPO_PUBLIC_CEREBRAS_API_KEY;

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

export type KeyStatus = "loading" | "missing" | "present" | "rejected";

/**
 * Tiny external store (mirrors screenStore's shape) so the shell can gate on
 * key availability via useSyncExternalStore.
 */
class KeyStore {
  private key: string | null = ENV_KEY?.trim() || null;
  private status: KeyStatus = this.key ? "present" : "loading";
  private listeners = new Set<() => void>();

  constructor() {
    if (!this.key) {
      persistedRead()
        .then((stored) => {
          // A key entered while hydration was in flight wins.
          if (this.status !== "loading") return;
          this.key = stored?.trim() || null;
          this.setStatus(this.key ? "present" : "missing");
        })
        .catch(() => this.setStatus("missing"));
    }
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
    this.key = key.trim();
    this.setStatus("present");
    await persistedWrite(this.key).catch(() => {});
  }

  /**
   * The API rejected `rejectedKey` (401/403) - drop it and re-show the gate.
   * No-ops if the user already replaced the key (a stale in-flight stream
   * must not wipe a newly entered valid key).
   */
  markRejected(rejectedKey: string) {
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

export const cerebrasKey = new KeyStore();
