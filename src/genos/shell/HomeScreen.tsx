import {
  AirplaneTilt,
  ArrowUp,
  Barbell,
  Book,
  BowlFood,
  CalendarBlank,
  Camera,
  Car,
  ChatCircle,
  CloudSun,
  Coffee,
  CreditCard,
  GameController,
  GearSix,
  Globe,
  Heartbeat,
  MapTrifold,
  MusicNote,
  NotePencil,
  PersonSimpleRun,
  ShoppingCart,
  Sparkle,
  SunHorizon,
  type Icon,
} from "phosphor-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SvgXml } from "react-native-svg";
import type { Suggestion } from "../apps";
import { SUGGESTIONS } from "../apps";
import { APPLESS_LOGO_XML } from "./applessLogo";
import type { RunningApp } from "./Switcher";

const SUGGESTION_ICONS: Record<string, Icon> = {
  "Order dinner": BowlFood,
  "My spending": CreditCard,
  "Text Maya": ChatCircle,
  "Weekend in Goa": AirplaneTilt,
  "My day": CalendarBlank,
  "Play something": MusicNote,
  Weather: CloudSun,
  "My workouts": PersonSimpleRun,
  "Coffee nearby": Coffee,
  "New note": NotePencil,
};

/**
 * One suggestion line. When its suggestion changes, the old label fades out
 * and the new one types itself in character by character. While `covered`
 * (an app screen is over the home screen) the label swaps without animating.
 */
function SuggestionRow({
  s,
  covered,
  onPress,
}: {
  s: Suggestion;
  covered: boolean;
  onPress: () => void;
}) {
  const [shown, setShown] = useState(s.label);
  const fade = useRef(new Animated.Value(1)).current;
  const typer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (covered) {
      setShown(s.label);
      return;
    }
    let cancelled = false;
    Animated.timing(fade, { toValue: 0, duration: 280, useNativeDriver: true }).start(
      ({ finished }) => {
        // An interrupted fade (label changed again / unmount) must not type
        // the stale label from this closure.
        if (!finished || cancelled) return;
        setShown("");
        fade.setValue(1);
        let i = 0;
        if (typer.current) clearInterval(typer.current);
        typer.current = setInterval(() => {
          i += 1;
          setShown(s.label.slice(0, i));
          if (i >= s.label.length && typer.current) clearInterval(typer.current);
        }, 45);
      },
    );
    return () => {
      cancelled = true;
      if (typer.current) clearInterval(typer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.label]);

  const IconCmp = SUGGESTION_ICONS[s.label] ?? Sparkle;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ alignSelf: "flex-start", opacity: pressed ? 0.6 : 1 })}
    >
      <Animated.View
        style={{ flexDirection: "row", alignItems: "center", gap: 10, opacity: fade }}
      >
        <IconCmp size={18} color="rgba(255,255,255,0.85)" weight="regular" />
        <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 15, fontWeight: "400" }}>
          {shown}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/** App emoji → filled Phosphor icon shown on the home-screen tile. */
const TILE_ICONS: Record<string, Icon> = {
  "💬": ChatCircle,
  "🍜": BowlFood,
  "💪": Barbell,
  "💳": CreditCard,
  "✈️": AirplaneTilt,
  "📅": CalendarBlank,
  "🎵": MusicNote,
  "🌅": SunHorizon,
  "☕": Coffee,
  "⛅": CloudSun,
  "📝": NotePencil,
  "🗺️": MapTrifold,
  "⚙️": GearSix,
  "🏃": PersonSimpleRun,
};

/**
 * Keyword → icon for summoned threads (generic ✨ emoji). Matched against the
 * thread's display name plus its id, which for summoned apps is a slug of the
 * original typed query.
 */
const KEYWORD_ICONS: [RegExp, Icon][] = [
  [/coffee|cafe|chai|tea/i, Coffee],
  [/dinner|food|eat|restaurant|lunch|breakfast|pizza|meal|order|recipe/i, BowlFood],
  [/trip|travel|flight|weekend|vacation|hotel|itinerary|visit/i, AirplaneTilt],
  [/weather|forecast|rain|sunny|temperature/i, CloudSun],
  [/music|song|playlist|radio|dj/i, MusicNote],
  [/workout|gym|fitness|exercise|yoga|steps/i, Barbell],
  [/note|list|todo|grocery|checklist/i, NotePencil],
  [/spend|bank|money|pay|budget|finance|invest|wallet/i, CreditCard],
  [/day|calendar|schedule|meeting|event|remind/i, CalendarBlank],
  [/text|message|chat|call/i, ChatCircle],
  [/map|nearby|direction|route|place/i, MapTrifold],
  [/photo|image|picture|camera/i, Camera],
  [/shop|buy|cart|store|deal/i, ShoppingCart],
  [/health|heart|sleep|meditat|wellness/i, Heartbeat],
  [/game|play/i, GameController],
  [/book|read|novel/i, Book],
  [/car|ride|taxi|uber|drive/i, Car],
  [/news|world|translate/i, Globe],
  [/setting|config/i, GearSix],
];

/**
 * One-word tile label: drop leading filler words, keep the first meaningful
 * one - "Trip Planner" → "Trip", "My Day" → "Day".
 */
function oneWordName(name: string): string {
  const words = name.trim().split(/\s+/);
  const meaningful = words.filter((w) => !/^(my|the|a|an|your|our|new)$/i.test(w));
  return meaningful[0] ?? words[0] ?? name;
}

/** Pick the most relevant tile icon for a thread. */
function tileIconFor(app: RunningApp): Icon {
  const byEmoji = TILE_ICONS[app.emoji];
  if (byEmoji) return byEmoji;
  const haystack = `${app.name} ${app.id.replace(/-/g, " ")}`;
  for (const [re, icon] of KEYWORD_ICONS) {
    if (re.test(haystack)) return icon;
  }
  return Sparkle;
}

/** Frosted-glass surface shared by the app tiles and the ask input. */
const GLASS = {
  backgroundColor: "rgba(255,255,255,0.2)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.25)",
  shadowColor: "#000",
  shadowOpacity: 0.08,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 2 },
  elevation: 1,
} as const;

/**
 * iOS-style icon for a minimized thread/app. Pops in on mount; long-press
 * reveals a close badge; tapping the badge closes the session.
 */
function AppIcon({
  app,
  editing,
  onPress,
  onLongPress,
  onClose,
}: {
  app: RunningApp;
  editing: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onClose: () => void;
}) {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const TileIcon = tileIconFor(app);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({
        alignItems: "center",
        width: 64,
        transform: [{ scale: pressed ? 0.92 : 1 }],
      })}
    >
      <Animated.View style={{ transform: [{ scale: pop }] }}>
        <View
          style={[
            GLASS,
            {
              width: 54,
              height: 54,
              borderRadius: 13,
              alignItems: "center",
              justifyContent: "center",
            },
          ]}
        >
          <TileIcon size={26} color="#fff" weight="fill" />
        </View>
        {editing && (
          <Pressable
            onPress={onClose}
            accessibilityLabel={`Close ${app.name}`}
            hitSlop={8}
            style={{
              position: "absolute",
              top: -7,
              left: -7,
              width: 20,
              height: 20,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(28,28,30,0.92)",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700", lineHeight: 13 }}>
              ✕
            </Text>
          </Pressable>
        )}
      </Animated.View>
      <Text
        numberOfLines={1}
        style={{
          marginTop: 5,
          maxWidth: 62,
          fontSize: 11,
          fontWeight: "500",
          color: "rgba(255,255,255,0.9)",
          textShadowColor: "rgba(0,0,0,0.35)",
          textShadowRadius: 6,
        }}
      >
        {oneWordName(app.name)}
      </Text>
    </Pressable>
  );
}

/**
 * The appless home. No app grid - the wordmark, rotating suggestion lines,
 * and one "ask for anything" pill. Open threads appear as app icons below
 * the wordmark. Memoized: it stays mounted under active apps, so it must not
 * re-render on every shell state change (e.g. LLM streaming chunks).
 */
export const HomeScreen = React.memo(function HomeScreen({
  topInset,
  covered,
  onCommand,
  runningApps,
  onResume,
  onClose,
}: {
  topInset: number;
  /** True while an app screen is rendered over the home screen. */
  covered: boolean;
  onCommand: (text: string) => void;
  runningApps: RunningApp[];
  onResume: (appId: string) => void;
  onClose: (appId: string) => void;
}) {
  const [ask, setAsk] = useState("");
  const [slots, setSlots] = useState<number[]>([0, 1, 2]);
  /** App id whose close badge is showing (long-press), or null. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const nextIdx = useRef(3);
  const turn = useRef(0);

  // Every 4s swap out one suggestion (cycling through the rows in order).
  // Paused while covered - no point animating under an app screen. The refs
  // advance OUTSIDE the setSlots updater: updaters must be pure (StrictMode
  // double-invokes them, which would skip every other suggestion).
  useEffect(() => {
    if (covered) return;
    const t = setInterval(() => {
      const row = turn.current % slots.length;
      const idx = nextIdx.current % SUGGESTIONS.length;
      nextIdx.current += 1;
      turn.current += 1;
      setSlots((prev) => prev.map((v, i) => (i === row ? idx : v)));
    }, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [covered]);

  const visible: Suggestion[] = slots.map((i) => SUGGESTIONS[i]);

  const submit = () => {
    const text = ask.trim();
    if (!text) return;
    onCommand(text);
    setAsk("");
  };

  return (
    <ImageBackground
      source={require("../../../assets/home-bg.jpg")}
      resizeMode="cover"
      // Web only: without an explicit size the inner <img> falls back to its
      // natural 1080×1920, overflowing the container - which the browser then
      // silently scrolls (despite overflow:hidden) to reveal the focused ask
      // input, shifting the whole home screen up. On native the default
      // absolute-fill is correct (a percentage here resolves against the
      // padded content box and shrinks the wallpaper).
      imageStyle={Platform.OS === "web" ? { width: "100%", height: "100%" } : undefined}
      style={{
        flex: 1,
        paddingTop: topInset + 40,
        paddingBottom: 46,
        justifyContent: "space-between",
        overflow: "hidden",
      }}
    >
      {/* Scrim for text legibility over the wallpaper. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.22)",
        }}
      />

      <View style={{ alignItems: "center", paddingTop: 28 }}>
        <SvgXml xml={APPLESS_LOGO_XML} width={170} height={44} />
        <Text
          style={{
            marginTop: 4,
            textAlign: "center",
            fontSize: 24,
            fontWeight: "400",
            letterSpacing: -0.5,
            lineHeight: 30,
            color: "rgba(255,255,255,0.5)",
            textShadowColor: "rgba(0,0,0,0.35)",
            textShadowRadius: 18,
            textShadowOffset: { width: 0, height: 2 },
          }}
        >
          Just ask.
        </Text>

        {runningApps.length > 0 && (
          <ScrollView
            style={{ alignSelf: "stretch", marginTop: 100, maxHeight: 216 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 18,
              paddingHorizontal: 24,
            }}
          >
            {runningApps.map((app) => (
              <AppIcon
                key={app.id}
                app={app}
                editing={editingId === app.id}
                onPress={() => {
                  if (editingId) setEditingId(null);
                  else onResume(app.id);
                }}
                onLongPress={() => setEditingId(app.id)}
                onClose={() => {
                  onClose(app.id);
                  setEditingId(null);
                }}
              />
            ))}
          </ScrollView>
        )}
      </View>

      <View style={{ gap: 12, paddingHorizontal: 18 }}>
        <View style={{ gap: 22, paddingVertical: 10, paddingLeft: 10 }}>
          {visible.map((s, i) => (
            <SuggestionRow key={i} s={s} covered={covered} onPress={() => onCommand(s.command)} />
          ))}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TextInput
            value={ask}
            onChangeText={setAsk}
            onSubmitEditing={submit}
            returnKeyType="go"
            placeholder="Ask for anything…"
            placeholderTextColor="rgba(255,255,255,0.75)"
            style={[
              GLASS,
              {
                flex: 1,
                minWidth: 0,
                paddingVertical: 11,
                paddingLeft: 18,
                paddingRight: ask.trim() ? 48 : 18,
                borderRadius: 22,
                color: "#fff",
                fontSize: 14,
              },
            ]}
          />
          {ask.trim().length > 0 && (
            <Pressable
              onPress={submit}
              accessibilityLabel="Send"
              hitSlop={6}
              style={({ pressed }) => ({
                position: "absolute",
                right: 5,
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#fff",
                transform: [{ scale: pressed ? 0.88 : 1 }],
              })}
            >
              <ArrowUp size={16} weight="bold" color="#1c1c1e" />
            </Pressable>
          )}
        </View>
      </View>
    </ImageBackground>
  );
});
