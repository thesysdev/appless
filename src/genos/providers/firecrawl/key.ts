import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export type FirecrawlKeyStatus = "loading" | "missing" | "present" | "rejected";

const STORAGE_KEY = "genos.firecrawl-key";
const ENV_KEY = __DEV__ ? process.env.EXPO_PUBLIC_FIRECRAWL_API_KEY : undefined;

interface KeyPersistence {
  read(): Promise<string | null>;
  write(value: string | null): Promise<void>;
}

const persistence: KeyPersistence = {
  async read() {
    if (Platform.OS === "web") {
      try {
        return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(STORAGE_KEY);
  },
  async write(value) {
    if (Platform.OS === "web") {
      try {
        if (value === null) globalThis.localStorage?.removeItem(STORAGE_KEY);
        else globalThis.localStorage?.setItem(STORAGE_KEY, value);
      } catch {
        // Private-mode storage can be unavailable; retain the in-memory key.
      }
      return;
    }
    if (value === null) await SecureStore.deleteItemAsync(STORAGE_KEY);
    else await SecureStore.setItemAsync(STORAGE_KEY, value);
  },
};

export class FirecrawlKeyStore {
  private key: string | null;
  private status: FirecrawlKeyStatus;
  private listeners = new Set<() => void>();

  constructor(
    private readonly storage: KeyPersistence = persistence,
    environmentKey: string | undefined = ENV_KEY,
  ) {
    this.key = environmentKey?.trim() || null;
    this.status = this.key ? "present" : "loading";
    if (!this.key) void this.hydrate();
  }

  private async hydrate() {
    try {
      const stored = await this.storage.read();
      if (this.status !== "loading") return;
      this.key = stored?.trim() || null;
      this.setStatus(this.key ? "present" : "missing");
    } catch {
      if (this.status === "loading") this.setStatus("missing");
    }
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getStatus = () => this.status;

  get(): string | null {
    return this.key;
  }

  async set(value: string) {
    this.key = value.trim() || null;
    this.setStatus(this.key ? "present" : "missing");
    await this.storage.write(this.key).catch(() => {});
  }

  markRejected(rejectedKey: string) {
    if (this.key !== rejectedKey) return;
    this.key = null;
    this.setStatus("rejected");
    void this.storage.write(null).catch(() => {});
  }

  private setStatus(status: FirecrawlKeyStatus) {
    this.status = status;
    this.listeners.forEach((listener) => listener());
  }
}

/** Firecrawl credentials are deliberately independent from the Cerebras gate. */
export const firecrawlKey = new FirecrawlKeyStore();
