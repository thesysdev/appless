/**
 * Anonymous run counter: one best-effort "appless_app_launched" event on
 * startup. Opt out with EXPO_PUBLIC_POSTHOG_DISABLED=1 or DO_NOT_TRACK=1.
 */
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// Write-only PostHog ingestion key; safe to commit.
const POSTHOG_KEY = "phc_3OLW53x09ZTVZSV6BEpj5uycj3ooqR6KOemOjx04e3D";
const POSTHOG_HOST = "https://us.i.posthog.com";

const isTruthy = (v?: string) => v === "1" || v?.toLowerCase() === "true";
const OPTED_OUT =
  isTruthy(process.env.EXPO_PUBLIC_POSTHOG_DISABLED) || isTruthy(process.env.DO_NOT_TRACK);

const ID_KEY = "appless.analytics-id";

const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Stable anonymous id: SecureStore on native, localStorage on web.
async function deviceId(): Promise<string> {
  if (Platform.OS === "web") {
    try {
      const existing = globalThis.localStorage?.getItem(ID_KEY);
      if (existing) return existing;
      const id = newId();
      globalThis.localStorage?.setItem(ID_KEY, id);
      return id;
    } catch {
      return newId();
    }
  }
  try {
    const existing = await SecureStore.getItemAsync(ID_KEY);
    if (existing) return existing;
    const id = newId();
    SecureStore.setItemAsync(ID_KEY, id).catch(() => {});
    return id;
  } catch {
    return newId();
  }
}

export async function initTelemetry(): Promise<void> {
  if (OPTED_OUT) return;
  const id = await deviceId();
  fetch(`${POSTHOG_HOST}/i/v0/e/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: POSTHOG_KEY,
      event: "appless_app_launched",
      distinct_id: id,
      properties: { $lib: "appless-native", platform: Platform.OS },
    }),
  }).catch(() => {});
}
