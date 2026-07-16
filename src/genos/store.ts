import type { AppDef } from "./apps";
import { APPS } from "./apps";
import type { ChatMessage } from "./stream";
import { streamScreen } from "./stream";

export type ScreenStatus = "pending" | "streaming" | "done" | "error";

export interface Screen {
  id: string;
  appId: string;
  appName: string;
  /** The user-intent message that produced this screen. */
  request: string;
  parentId?: string;
  /** Accumulating openui-lang source. */
  content: string;
  status: ScreenStatus;
  error?: string;
  /** True while the screen exists only as a speculative prefetch. */
  speculative: boolean;
  /** performance.now() when generation started - staleness + latency tracking. */
  startedAt: number;
  /** Wall-clock generation time once done. */
  genMs?: number;
  /** The screen was already fully generated when the user tapped into it. */
  prefetched?: boolean;
  /** Provider cut the generation short (finish_reason "length"). */
  truncated?: boolean;
  /** The model answered with an OS command (@OS(...)) instead of a screen. */
  osCommand?: { cmd: "back" | "home" | "switcher" | "open"; arg?: string };
  /** The model is running tools (web_search) before composing the screen. */
  searching?: boolean;
}

/** Detect a whole-response @OS(...) command (nothing else in the reply). */
export function parseOsCommand(text: string): Screen["osCommand"] | undefined {
  const m = cleanLang(text)
    .trim()
    .match(/^@OS\(\s*(back|home|switcher|open)\s*(?:,\s*"([^"]+)")?\s*\)$/i);
  if (!m) return undefined;
  return { cmd: m[1].toLowerCase() as "back" | "home" | "switcher" | "open", arg: m[2] };
}

// Store
/**
 * Coalesce streaming re-renders. The provider streams at ~1850 tok/s - a delta
 * every fraction of a millisecond. Re-parsing and re-rendering the whole native
 * component tree (SVG icons, images, charts) on every tiny delta produces a
 * render storm that, on React Native's reconciler, can race native layout/image
 * callbacks into a setState loop ("Maximum update depth exceeded"). Buffering
 * content immediately but notifying subscribers at most once per frame window
 * keeps the UI live (~20 fps) without the storm - the DOM reconciler absorbs the
 * churn, RN does not.
 */
const STREAM_FLUSH_MS = 50;

class ScreenStore {
  private screens = new Map<string, Screen>();
  private listeners = new Set<() => void>();
  private version = 0;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getVersion = () => this.version;

  get(id: string): Screen | undefined {
    return this.screens.get(id);
  }

  all(): Screen[] {
    return [...this.screens.values()];
  }

  upsert(screen: Screen) {
    this.screens.set(screen.id, screen);
    this.bump();
  }

  patch(id: string, partial: Partial<Screen>) {
    const s = this.screens.get(id);
    if (!s) return;
    this.screens.set(id, { ...s, ...partial });
    // A status/metadata change (done, error, prefetch flip) is meaningful -
    // flush any buffered streaming notify with it, immediately.
    this.bump();
  }

  append(id: string, delta: string) {
    const s = this.screens.get(id);
    if (!s) return;
    // Content is updated synchronously so get()/onDone always see the latest;
    // only the subscriber notification is throttled. Content flowing also
    // means any tool round is over - flip the "searching" pill back.
    this.screens.set(id, { ...s, content: s.content + delta, status: "streaming", searching: false });
    this.scheduleFlush();
  }

  /** Notify subscribers at most once per STREAM_FLUSH_MS during streaming. */
  private scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.bump();
    }, STREAM_FLUSH_MS);
  }

  private bump() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.version++;
    this.listeners.forEach((fn) => fn());
  }
}

export const screenStore = new ScreenStore();

// Controller: generation, navigation cache, speculative prefetch
const MAX_PREFETCH = 6;
/** How many ancestor screens to replay as conversation context. */
const CONTEXT_DEPTH = 2;
/** A cached screen still pending/streaming after this long is considered stuck. */
const STALE_MS = 30_000;

let idCounter = 0;
const newId = () => `screen-${++idCounter}`;

let activeScreenId: string | null = null;

/** `${parentId} ${actionMessage}` → child screen id. */
const actionIndex = new Map<string, string>();
/** appId → home screen id (reopening an app from the grid is instant). */
const appHomeIndex = new Map<string, string>();
/** screen id → controller for its in-flight generation. */
const inflight = new Map<string, AbortController>();

const actionKey = (parentId: string, message: string) => `${parentId} ${message}`;

/**
 * Strip markdown fences the model may wrap around the program. Safe on
 * partial streams, and safe on programs that legitimately contain a fence
 * mid-text: the trailing cut only applies when an opening fence was present.
 */
export function cleanLang(text: string): string {
  const opened = /^\s*```/.test(text);
  let t = text.replace(/^\s*```[\w-]*[^\S\n]*\n?/, "");
  if (opened) {
    const end = t.indexOf("\n```");
    if (end !== -1) t = t.slice(0, end);
  } else {
    t = t.replace(/\n```\s*$/, "");
  }
  return t;
}

/** Pull every @ToAssistant("...") message out of a (complete) program. */
export function extractActions(content: string): string[] {
  const out: string[] = [];
  const re = /@ToAssistant\(\s*"((?:\\.|[^"\\])*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const msg = m[1].replace(/\\(.)/g, "$1").trim();
    if (msg && !out.includes(msg)) out.push(msg);
  }
  return out;
}

function buildMessages(screen: Screen): ChatMessage[] {
  const chain: Screen[] = [screen];
  let cur = screen;
  while (cur.parentId && chain.length <= CONTEXT_DEPTH) {
    const parent = screenStore.get(cur.parentId);
    if (!parent) break;
    chain.unshift(parent);
    cur = parent;
  }

  const messages: ChatMessage[] = [];
  for (const s of chain.slice(0, -1)) {
    // Ancestors replay text-only - re-sending images would burn tokens per hop.
    messages.push({ role: "user", content: s.request });
    if (s.content) messages.push({ role: "assistant", content: cleanLang(s.content) });
  }
  messages.push({ role: "user", content: screen.request });
  return messages;
}

function startStream(id: string) {
  const screen = screenStore.get(id);
  if (!screen) return;
  inflight.get(id)?.abort();
  const controller = new AbortController();
  inflight.set(id, controller);

  // Callbacks from a superseded stream (a retry replaced this controller)
  // must not touch the screen or delete the new stream's controller.
  const stale = () => inflight.get(id) !== controller;

  streamScreen(buildMessages(screen), {
    signal: controller.signal,
    onDelta: (delta) => {
      if (!stale()) screenStore.append(id, delta);
    },
    // The model wants tools (web_search). Refuse on speculative prefetch -
    // quota only burns on screens the user actually opens; the errored cache
    // entry regenerates fresh (non-speculative, tools allowed) on tap.
    onToolRound: () => {
      if (stale()) return "abort";
      const s = screenStore.get(id);
      if (s?.speculative) return "abort";
      screenStore.patch(id, { content: "", status: "pending", searching: true });
      return "continue";
    },
    onDone: (info) => {
      if (stale()) return;
      inflight.delete(id);
      const s = screenStore.get(id);
      if (info.dropped) {
        // The stream died mid-flight - a partial screen looks complete but
        // is missing content; surface it as retryable instead.
        screenStore.patch(id, {
          status: "error",
          error: "The connection dropped mid-screen - retry",
          searching: false,
        });
        return;
      }
      const genMs = s ? Math.round(performance.now() - s.startedAt) : undefined;
      const osCommand = s ? parseOsCommand(s.content) : undefined;
      screenStore.patch(id, {
        status: "done",
        genMs,
        truncated: info.truncated,
        osCommand,
        searching: false,
      });
      if (!osCommand) maybePrefetch(id);
    },
    onError: (err) => {
      if (stale()) return;
      inflight.delete(id);
      screenStore.patch(id, { status: "error", error: err.message, searching: false });
    },
  });
}

interface LaunchInput {
  appId: string;
  appName: string;
  request: string;
  parentId?: string;
  speculative: boolean;
}

function launchScreen(input: LaunchInput): string {
  const id = newId();
  screenStore.upsert({
    ...input,
    id,
    content: "",
    status: "pending",
    startedAt: performance.now(),
  });
  startStream(id);
  return id;
}

/** A cached screen is reusable unless it errored or looks stuck mid-stream. */
function reusable(screen: Screen | undefined): screen is Screen {
  if (!screen) return false;
  if (screen.status === "error") return false;
  if (
    (screen.status === "pending" || screen.status === "streaming") &&
    performance.now() - screen.startedAt > STALE_MS
  ) {
    return false;
  }
  return true;
}

/** Open an app from the home grid - reuses the app's existing home screen. */
export function openApp(app: AppDef): string {
  const existing = appHomeIndex.get(app.id);
  if (existing) {
    const screen = screenStore.get(existing);
    if (reusable(screen)) return existing;
    if (screen) {
      retryScreen(existing);
      return existing;
    }
  }
  const id = launchScreen({
    appId: app.id,
    appName: app.name,
    request: app.request,
    speculative: false,
  });
  appHomeIndex.set(app.id, id);
  return id;
}

/** `${appId} ${request}` → screen id, so repeated deep links reuse one screen. */
const deepLinkIndex = new Map<string, string>();

/** Open a screen in another app via a genos://open deep link. */
export function openDeepLink(appId: string, request: string): string {
  const key = `${appId.toLowerCase()} ${request}`;
  const existing = deepLinkIndex.get(key);
  if (existing) {
    const screen = screenStore.get(existing);
    if (reusable(screen)) return existing;
    if (screen) {
      retryScreen(existing);
      return existing;
    }
  }
  const app = APPS.find((a) => a.id === appId.toLowerCase());
  const id = launchScreen({
    appId: app?.id ?? appId.toLowerCase(),
    appName: app?.name ?? appId.charAt(0).toUpperCase() + appId.slice(1),
    request,
    speculative: false,
  });
  deepLinkIndex.set(key, id);
  return id;
}

/**
 * Resolve a tapped action to a screen: a prefetched screen when one exists,
 * a fresh generation otherwise. Form submissions always generate fresh -
 * the prefetched variant couldn't have known the entered values.
 */
export function resolveAction(
  parentId: string,
  message: string,
  formState?: Record<string, unknown>,
): string {
  const parent = screenStore.get(parentId);
  const hasFormValues = !!formState && Object.keys(formState).length > 0;
  const key = actionKey(parentId, message);

  if (!hasFormValues) {
    const hit = actionIndex.get(key);
    if (hit) {
      const hitScreen = screenStore.get(hit);
      if (reusable(hitScreen)) {
        screenStore.patch(hit, {
          speculative: false,
          prefetched: hitScreen.speculative && hitScreen.status === "done",
        });
        return hit;
      }
      if (hitScreen) {
        retryScreen(hit);
        return hit;
      }
    }
  }

  const request = hasFormValues
    ? `${message}\n\nSubmitted form values: ${JSON.stringify(formState)}`
    : message;
  const id = launchScreen({
    appId: parent?.appId ?? "unknown",
    appName: parent?.appName ?? "App",
    request,
    parentId,
    speculative: false,
  });
  if (!hasFormValues) actionIndex.set(key, id);
  return id;
}

/** Re-generate a failed or stuck screen in place. */
export function retryScreen(id: string) {
  const screen = screenStore.get(id);
  if (!screen) return;
  screenStore.patch(id, {
    content: "",
    status: "pending",
    error: undefined,
    genMs: undefined,
    prefetched: undefined,
    truncated: undefined,
    startedAt: performance.now(),
    // A user-initiated retry is never speculative - this also re-enables
    // tools for prefetched screens that errored with NEEDS_LIVE_DATA.
    speculative: false,
    searching: false,
  });
  startStream(id);
}

/**
 * The shell reports which screen is on top; prefetch only ever runs for the
 * visible screen, and kicks in when it (a) becomes visible already-complete
 * or (b) finishes generating while visible.
 */
export function setActiveScreen(id: string | null) {
  activeScreenId = id;
  if (id && screenStore.get(id)?.status === "done") maybePrefetch(id);
}

function maybePrefetch(id: string) {
  if (activeScreenId !== id) return;
  const screen = screenStore.get(id);
  if (!screen || screen.status !== "done") return;

  for (const message of extractActions(cleanLang(screen.content)).slice(0, MAX_PREFETCH)) {
    const key = actionKey(id, message);
    if (actionIndex.has(key)) continue;
    const childId = launchScreen({
      appId: screen.appId,
      appName: screen.appName,
      request: message,
      parentId: id,
      speculative: true,
    });
    actionIndex.set(key, childId);
  }
}

