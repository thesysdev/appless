import { Renderer } from "@openuidev/react-lang";
import { LinearGradient } from "expo-linear-gradient";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Animated,
  BackHandler,
  Easing,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cerebrasKey } from "../config";
import type { AppDef } from "./apps";
import { APPS, DEFAULT_TILE, summonApp } from "./apps";
import { genosLibrary } from "./library";
import { HomeScreen } from "./shell/HomeScreen";
import { KeyGate } from "./shell/KeyGate";
import { Switcher, type RunningApp } from "./shell/Switcher";
import {
  cleanLang,
  openApp,
  openDeepLink,
  resolveAction,
  retryScreen,
  screenStore,
  setActiveScreen,
} from "./store";
import { useCds } from "./theme";
import { AppsIcon, LucideIcon } from "./ui/icons";

/** Shape of the ActionEvent the Renderer dispatches (subset we use). */
interface GenActionEvent {
  params?: Record<string, unknown>;
  humanFriendlyMessage?: string;
  formState?: Record<string, unknown>;
}

interface AppMeta {
  name: string;
  emoji: string;
  tile: [string, string];
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type NavDir = "launch" | "push" | "pop";

const EASE = Easing.bezier(0.22, 1, 0.32, 1);

/**
 * genos:// deep links parsed by hand - Hermes' URL support for custom
 * schemes varies, and the shape is tiny: genos://cmd?key=value&…
 */
function parseGenosUrl(url: string): { cmd: string; params: Record<string, string> } | null {
  const m = url.match(/^genos:\/\/([a-z]+)\/?(?:\?(.*))?$/i);
  if (!m) return null;
  const params: Record<string, string> = {};
  for (const pair of (m[2] ?? "").split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const k = eq === -1 ? pair : pair.slice(0, eq);
    const v = eq === -1 ? "" : pair.slice(eq + 1);
    try {
      params[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, " "));
    } catch {
      params[k] = v;
    }
  }
  return { cmd: m[1].toLowerCase(), params };
}

/** Direction-aware screen transition: launch zooms up, push slides from the
 *  right, pop settles back from the left. */
function ScreenTransition({ kind, children }: { kind: NavDir; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: kind === "launch" ? 380 : kind === "push" ? 300 : 260,
      easing: EASE,
      useNativeDriver: true,
    }).start();
  }, [v, kind]);

  const style =
    kind === "launch"
      ? {
          opacity: v,
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [34, 0] }) },
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) },
          ],
        }
      : kind === "push"
        ? {
            opacity: v,
            transform: [
              { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [56, 0] }) },
            ],
          }
        : {
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
            transform: [
              { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-44, 0] }) },
            ],
          };

  return (
    <Animated.View
      style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }, style]}
    >
      {children}
    </Animated.View>
  );
}

function PulsingDot() {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0.35, duration: 450, useNativeDriver: true }),
        Animated.timing(v, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View
      style={{
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: "#fff",
        opacity: v,
        transform: [{ scale: v }],
      }}
    />
  );
}

function Skeleton() {
  const v = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.4, duration: 550, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  const block = (h: number, w: `${number}%` | number, r = 12) => (
    <Animated.View
      style={{
        height: h,
        width: w,
        borderRadius: r,
        backgroundColor: "rgba(127,127,140,0.22)",
        opacity: v,
      }}
    />
  );
  return (
    <View style={{ gap: 14, paddingTop: 6, paddingHorizontal: 2 }}>
      {block(30, "55%")}
      {block(150, "100%", 16)}
      {block(188, "100%", 14)}
    </View>
  );
}

export default function GenOS() {
  useSyncExternalStore(screenStore.subscribe, screenStore.getVersion);
  const keyStatus = useSyncExternalStore(cerebrasKey.subscribe, cerebrasKey.getStatus);

  const t = useCds();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();

  /** appId → stack of screen ids (per-app session, like iOS multitasking). */
  const [sessions, setSessions] = useState<Record<string, string[]>>({});
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [recentOrder, setRecentOrder] = useState<string[]>([]);
  const [appMeta, setAppMeta] = useState<Record<string, AppMeta>>({});
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Apps the user has sent home - only these show as icons on the home screen. */
  const [minimizedIds, setMinimizedIds] = useState<string[]>([]);
  /** True while the minimize-into-icon animation is playing. */
  const [minimizing, setMinimizing] = useState(false);
  const minimizeV = useRef(new Animated.Value(0)).current;

  /** Which transition the next screen remount should play. */
  const [navAnim, setNavAnim] = useState<NavDir>("launch");

  /** One-time gesture hint, shown the first time an app opens. */
  const [showHint, setShowHint] = useState(false);
  const hintShownOnce = useRef(false);

  const stack = activeApp ? (sessions[activeApp] ?? []) : [];
  const topId = stack.length > 0 ? stack[stack.length - 1] : null;
  const top = topId ? screenStore.get(topId) : undefined;
  const generating = top?.status === "pending" || top?.status === "streaming";

  useEffect(() => {
    setActiveScreen(topId);
  }, [topId, top?.status]);

  useEffect(() => {
    if (!activeApp || hintShownOnce.current) return;
    hintShownOnce.current = true;
    setShowHint(true);
    const timer = setTimeout(() => setShowHint(false), 6000);
    // Also hide on cleanup: leaving the first app within 6s would otherwise
    // clear the timer and leave the hint stuck on forever (hintShownOnce
    // blocks a second arming).
    return () => {
      clearTimeout(timer);
      setShowHint(false);
    };
  }, [activeApp]);

  const showToast = useCallback((text: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, key: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const rememberMeta = useCallback((id: string, meta: AppMeta) => {
    setAppMeta((m) => (m[id] ? m : { ...m, [id]: meta }));
  }, []);

  // Summoned apps start life named after the raw typed command. Once their
  // FIRST screen exists, adopt the title the model gave it (its CardHeader).
  // Gated on stack depth 1 so pushed child screens don't keep renaming the
  // app after every navigation.
  useEffect(() => {
    if (!activeApp?.startsWith("summon-") || !top?.content || stack.length !== 1) return;
    const m = cleanLang(top.content).match(/CardHeader\(\s*"((?:\\.|[^"\\])*)"/);
    const title = m?.[1]?.trim();
    if (!title) return;
    setAppMeta((meta) => {
      const cur = meta[activeApp];
      if (!cur || cur.name === title) return meta;
      return { ...meta, [activeApp]: { ...cur, name: title } };
    });
  }, [activeApp, top?.content, stack.length]);

  /** Mirrors activeApp so stable callbacks can read the current value. */
  const activeAppRef = useRef(activeApp);
  useEffect(() => {
    activeAppRef.current = activeApp;
  }, [activeApp]);

  const activate = useCallback((appId: string) => {
    // Resuming always plays the launch transition - without this the screen
    // replays whatever direction the previous interaction left in navAnim.
    setNavAnim("launch");
    // Switching away from a live session backgrounds it: it must stay
    // reachable from the home grid, not just the switcher.
    const prev = activeAppRef.current;
    if (prev && prev !== appId) {
      setMinimizedIds((ids) => (ids.includes(prev) ? ids : [...ids, prev]));
    }
    setActiveApp(appId);
    setSwitcherOpen(false);
    setRecentOrder((order) => [appId, ...order.filter((a) => a !== appId)]);
  }, []);

  /**
   * Push a screen onto an app's stack, idempotently: duplicate dispatches of
   * the same resolved screen (double action events, dev double-invocation)
   * must not create a second identical frame.
   */
  const pushScreen = useCallback((appId: string, id: string) => {
    setNavAnim("push");
    setSessions((s) => {
      const st = s[appId] ?? [];
      if (st[st.length - 1] === id) return s;
      return { ...s, [appId]: [...st, id] };
    });
  }, []);

  /** Open (or resume) an app from home, the switcher or a suggestion. */
  const launch = useCallback(
    (app: AppDef) => {
      setNavAnim("launch");
      rememberMeta(app.id, { name: app.name, emoji: app.emoji, tile: app.tile });
      // openApp touches the screen store (which notifies subscribers), so it
      // must run here in the event handler - never inside a setState updater.
      if (!sessions[app.id]?.length) {
        const id = openApp(app);
        setSessions((s) => (s[app.id]?.length ? s : { ...s, [app.id]: [id] }));
      }
      activate(app.id);
    },
    [sessions, activate, rememberMeta],
  );

  /**
   * Home: the open thread minimizes into its home-screen icon - the screen
   * shrinks toward the icon grid, then the app joins the minimized set.
   * Re-entrant calls during the animation are ignored, and the completion
   * only commits if the animation ran to the end for the app it started with.
   */
  const goHome = useCallback(() => {
    setSwitcherOpen(false);
    if (!activeApp || minimizing) return;
    const appId = activeApp;
    setMinimizing(true);
    Animated.timing(minimizeV, {
      toValue: 1,
      duration: 360,
      easing: EASE,
      useNativeDriver: true,
    }).start(({ finished }) => {
      setMinimizing(false);
      if (!finished) {
        minimizeV.setValue(0);
        return;
      }
      setMinimizedIds((ids) => (ids.includes(appId) ? ids : [...ids, appId]));
      // Only dismiss if the user didn't activate something else mid-animation.
      setActiveApp((cur) => (cur === appId ? null : cur));
      // Reset after React commits the unmount, so the still-mounted screen
      // doesn't snap back to full scale for a frame.
      requestAnimationFrame(() => minimizeV.setValue(0));
    });
  }, [activeApp, minimizing, minimizeV]);

  const goBack = useCallback(() => {
    if (!activeApp || minimizing) return;
    setNavAnim("pop");
    setSessions((s) => {
      const st = s[activeApp] ?? [];
      if (st.length <= 1) return s;
      return { ...s, [activeApp]: st.slice(0, -1) };
    });
  }, [activeApp, minimizing]);

  const closeSession = useCallback(
    (appId: string) => {
      setSessions((s) => {
        const next = { ...s };
        delete next[appId];
        return next;
      });
      setRecentOrder((order) => order.filter((a) => a !== appId));
      setMinimizedIds((ids) => ids.filter((a) => a !== appId));
      if (activeApp === appId) setActiveApp(null);
    },
    [activeApp],
  );

  /** genos://open deep link - jump into another app at a specific screen. */
  const deepLink = useCallback(
    (appId: string, request: string) => {
      const id = openDeepLink(appId, request);
      const known = APPS.find((a) => a.id === appId.toLowerCase());
      rememberMeta(appId.toLowerCase(), {
        name: known?.name ?? capitalize(appId),
        emoji: known?.emoji ?? "✨",
        tile: known?.tile ?? DEFAULT_TILE,
      });
      pushScreen(appId.toLowerCase(), id);
      activate(appId.toLowerCase());
    },
    [activate, rememberMeta, pushScreen],
  );

  /**
   * Execute @OS(...) responses - the model answering a typed/tapped request
   * with navigation instead of a screen. The pending command screen is
   * removed from the stack, then the navigation applies.
   */
  const executedOsCommands = useRef(new Set<string>());
  useEffect(() => {
    const cmd = top?.osCommand;
    if (!cmd || !topId || !activeApp) return;
    if (executedOsCommands.current.has(topId)) return;
    executedOsCommands.current.add(topId);

    setNavAnim("pop");
    setSessions((s) => {
      const st = (s[activeApp] ?? []).filter((id) => id !== topId);
      // @OS(back) with only the root left must not empty the stack - an
      // active app with zero screens renders nothing and traps the user.
      return { ...s, [activeApp]: cmd.cmd === "back" && st.length > 1 ? st.slice(0, -1) : st };
    });
    if (cmd.cmd === "home") {
      goHome();
    } else if (cmd.cmd === "switcher") {
      setSwitcherOpen(true);
    } else if (cmd.cmd === "open" && cmd.arg) {
      const target = cmd.arg.toLowerCase();
      const known = APPS.find((a) => a.id === target || a.name.toLowerCase() === target);
      launch(known ?? summonApp(cmd.arg));
    }
  }, [top?.osCommand, topId, activeApp, goHome, launch]);

  const handleAction = useCallback(
    (ev: GenActionEvent) => {
      const url = ev.params?.url;
      if (typeof url === "string" && url.startsWith("genos://")) {
        const parsed = parseGenosUrl(url);
        if (parsed) {
          const { cmd, params } = parsed;
          if (cmd === "toast") showToast(params.text || "Done ✓");
          else if (cmd === "open") {
            if (params.app && params.request) deepLink(params.app, params.request);
          } else if (cmd === "back") goBack();
          else if (cmd === "home") goHome();
        }
        return;
      }
      if (typeof url === "string" && url) {
        Linking.openURL(url).catch(() => {});
        return;
      }
      const message = ev.humanFriendlyMessage?.trim();
      if (!message || !topId || !activeApp) return;
      // The top screen is still streaming: generating a child from a partial
      // parent gives the model truncated context. Never drop the tap silently
      // - tell the user why nothing happened (this reads as "broken buttons"
      // on slow connections otherwise).
      if (generating) {
        showToast("Still materializing - try again in a second");
        return;
      }
      // Guard: navigation-shaped requests go to the OS, never to the model -
      // otherwise it happily generates a fake home screen or a stale copy of
      // the previous one. ("Settings home screen" is an app home - not OS home.)
      if (
        /genos\s*home|all (your |the )?apps|app (list|grid|drawer|launcher)|main menu/i.test(
          message,
        )
      ) {
        goHome();
        return;
      }
      if (/^(go |return |navigate )?back( to( the)? previous( screen)?)?$/i.test(message)) {
        goBack();
        return;
      }
      pushScreen(activeApp, resolveAction(topId, message, ev.formState));
    },
    [topId, activeApp, generating, deepLink, goBack, goHome, showToast, pushScreen],
  );

  /** Android hardware back mirrors the shell's back gesture. */
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (switcherOpen) {
        setSwitcherOpen(false);
        return true;
      }
      if (minimizing) return true;
      if (activeApp) {
        if ((sessions[activeApp]?.length ?? 0) > 1) goBack();
        else goHome();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [switcherOpen, activeApp, sessions, goBack, goHome, minimizing]);

  /**
   * Command routing for suggestion chips and the ask bar. OS intents
   * (back/home/switcher/open <app>) control the shell directly - everything
   * else generates a screen.
   */
  const routeCommand = useCallback(
    (transcript: string) => {
      const text = transcript.trim();
      if (!text) return;
      const lower = text
        .toLowerCase()
        .replace(/[.!?,]+$/g, "")
        .trim();

      if (/^(go |navigate |take me )?back$/.test(lower) || lower === "previous screen") {
        goBack();
        return;
      }
      if (/^(go |take me |go to )?home( screen)?$/.test(lower)) {
        goHome();
        return;
      }
      // "close this app" actually ends the session - unlike Home, which
      // minimizes the thread into a home-screen icon.
      if (/^close( this| the)? app$/.test(lower)) {
        if (activeApp) closeSession(activeApp);
        return;
      }
      if (/^(open |show )?(the )?(app )?(switcher|recent apps)$/.test(lower)) {
        setSwitcherOpen(true);
        return;
      }

      // "open/launch/switch to <app>" jumps to a known app from anywhere.
      const openMatch = lower.match(/^(?:open|launch|switch to|go to)\s+(.+)$/);
      const known = APPS.find((a) => (openMatch?.[1] ?? lower).includes(a.name.toLowerCase()));
      if (known && (openMatch || !activeApp)) {
        launch(known);
        return;
      }

      if (activeApp && topId) {
        pushScreen(activeApp, resolveAction(topId, text));
        return;
      }
      launch({
        ...summonApp(text.length > 24 ? `${text.slice(0, 24)}…` : text),
        request: `Open the perfect app screen for this request: "${text}". Invent a polished, realistic screen that fulfils it.`,
      });
    },
    [activeApp, topId, launch, goBack, goHome, pushScreen, closeSession],
  );

  // Memoized: HomeScreen is React.memo'd and stays mounted under active
  // apps, so its props must keep identity across unrelated shell re-renders.
  const runningApps: RunningApp[] = React.useMemo(
    () =>
      recentOrder
        .filter((id) => sessions[id]?.length)
        .map((id) => ({
          id,
          name: appMeta[id]?.name ?? capitalize(id),
          emoji: appMeta[id]?.emoji ?? "✨",
          tile: appMeta[id]?.tile ?? DEFAULT_TILE,
        })),
    [recentOrder, sessions, appMeta],
  );
  const homeApps = React.useMemo(
    () => runningApps.filter((a) => minimizedIds.includes(a.id)),
    [runningApps, minimizedIds],
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: t.bg }}
    >
      <HomeScreen
        topInset={insets.top}
        covered={!!activeApp}
        onCommand={routeCommand}
        runningApps={homeApps}
        onResume={activate}
        onClose={closeSession}
      />

      {top && (
        <Animated.View
          pointerEvents={minimizing ? "none" : "auto"}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10,
            opacity: minimizeV.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 0.85, 0] }),
            transform: [
              {
                translateY: minimizeV.interpolate({
                  inputRange: [0, 1],
                  // Aim the shrinking screen at the home icon grid. 230 ≈ the
                  // grid's offset from the top (wordmark block + margins) in
                  // HomeScreen - keep in sync if that layout changes. Clamped
                  // so short/landscape windows never animate downward.
                  outputRange: [0, -Math.max(0, winH / 2 - (insets.top + 230))],
                }),
              },
              { scale: minimizeV.interpolate({ inputRange: [0, 1], outputRange: [1, 0.08] }) },
            ],
          }}
        >
        <ScreenTransition key={topId} kind={navAnim}>
          <LinearGradient
            colors={t.dark ? [t.bg, t.bg] : ["#ffffff", t.bg]}
            locations={[0, 0.35]}
            style={{ flex: 1 }}
          >
            {top.status === "error" ? (
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 14,
                  padding: 24,
                }}
              >
                <Text style={{ fontSize: 13, color: t.ink, opacity: 0.75, textAlign: "center" }}>
                  {top.error || "Generation failed"}
                </Text>
                <Pressable
                  onPress={() => topId && retryScreen(topId)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 22,
                    borderRadius: 18,
                    backgroundColor: "#5e5ce6",
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={{
                  paddingTop: insets.top + 54,
                  paddingHorizontal: 14,
                  paddingBottom: 44 + insets.bottom,
                }}
              >
                {top.content ? (
                  <Renderer
                    response={cleanLang(top.content)}
                    library={genosLibrary}
                    isStreaming={generating}
                    onAction={handleAction}
                  />
                ) : (
                  <Skeleton />
                )}
              </ScrollView>
            )}
          </LinearGradient>
        </ScreenTransition>
        </Animated.View>
      )}

      {/* OS chrome */}

      {activeApp && !switcherOpen && (
        <Pressable
          onPress={stack.length > 1 ? goBack : goHome}
          accessibilityLabel={stack.length > 1 ? "Back" : "Home"}
          style={({ pressed }) => ({
            position: "absolute",
            top: insets.top + 6,
            left: 12,
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.chromeBg,
            zIndex: 35,
            borderWidth: 1,
            borderColor: t.chromeBorder,
            shadowColor: "#000",
            shadowOpacity: 0.07,
            shadowRadius: 3,
            shadowOffset: { width: 0, height: 1 },
            elevation: 1,
            transform: [{ scale: pressed ? 0.9 : 1 }],
          })}
        >
          <LucideIcon
            name={stack.length > 1 ? "chevron-left" : "house"}
            size={18}
            strokeWidth={2.4}
            color={t.chromeInk}
          />
        </Pressable>
      )}

      {activeApp && !switcherOpen && (
        <View
          style={{
            position: "absolute",
            top: insets.top + 6,
            right: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            zIndex: 35,
          }}
        >
          <Pressable
            onPress={() => setSwitcherOpen(true)}
            accessibilityLabel="App switcher"
            style={({ pressed }) => ({
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: t.chromeBg,
              borderWidth: 1,
              borderColor: t.chromeBorder,
              shadowColor: "#000",
              shadowOpacity: 0.07,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
              transform: [{ scale: pressed ? 0.9 : 1 }],
            })}
          >
            <AppsIcon color={t.chromeInk} size={18} />
          </Pressable>
        </View>
      )}

      {activeApp && !switcherOpen && showHint && (
        <Pressable
          onPress={() => setShowHint(false)}
          style={{
            position: "absolute",
            bottom: insets.bottom + 46,
            alignSelf: "center",
            alignItems: "center",
            gap: 3,
            paddingVertical: 9,
            paddingHorizontal: 16,
            borderRadius: 16,
            backgroundColor: "rgba(20,20,24,0.88)",
            zIndex: 45,
          }}
        >
          <Text style={{ color: "rgba(255,255,255,0.92)", fontSize: 11.5, fontWeight: "600" }}>
            ‹ top-left: back / home
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.92)", fontSize: 11.5, fontWeight: "600" }}>
            top-right ⧉ : recent apps
          </Text>
        </Pressable>
      )}

      {activeApp && generating && (
        <View
          style={{
            position: "absolute",
            bottom: insets.bottom + 34,
            alignSelf: "center",
            flexDirection: "row",
            alignItems: "center",
            gap: 7,
            paddingVertical: 5,
            paddingHorizontal: 14,
            borderRadius: 14,
            backgroundColor: "rgba(94,92,230,0.92)",
            zIndex: 35,
            shadowColor: "#5e5ce6",
            shadowOpacity: 0.45,
            shadowRadius: 9,
            shadowOffset: { width: 0, height: 6 },
            elevation: 6,
          }}
        >
          <PulsingDot />
          <Text style={{ color: "#fff", fontSize: 11.5, fontWeight: "600", letterSpacing: 0.4 }}>
            {top?.searching ? "searching the web…" : "materializing…"}
          </Text>
        </View>
      )}

      {toast && (
        <View
          key={toast.key}
          style={{
            position: "absolute",
            top: insets.top + 12,
            alignSelf: "center",
            maxWidth: "78%",
            paddingVertical: 10,
            paddingHorizontal: 18,
            borderRadius: 20,
            backgroundColor: "rgba(20,20,24,0.92)",
            zIndex: 60,
            shadowColor: "#000",
            shadowOpacity: 0.45,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 12 },
            elevation: 8,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600", textAlign: "center" }}>
            {toast.text}
          </Text>
        </View>
      )}

      {switcherOpen && (
        <Switcher
          apps={runningApps}
          topScreenId={(appId) => {
            const st = sessions[appId];
            return st?.[st.length - 1];
          }}
          onResume={activate}
          onClose={closeSession}
          onDismiss={() => setSwitcherOpen(false)}
        />
      )}

      {(keyStatus === "missing" || keyStatus === "rejected") && <KeyGate status={keyStatus} />}
    </KeyboardAvoidingView>
  );
}
