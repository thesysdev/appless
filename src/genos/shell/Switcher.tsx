import { Renderer } from "@openuidev/react-lang";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { genosLibrary } from "../library";
import { cleanLang, screenStore } from "../store";
import { useCds } from "../theme";

export interface RunningApp {
  id: string;
  name: string;
  emoji: string;
  tile: [string, string];
}

const CARD_W = 188;
const CARD_H = 400;
/** Miniatures render at full phone size, scaled down 2× like the web app. */
const PREVIEW_W = CARD_W * 2;
const PREVIEW_H = CARD_H * 2;

/** iOS-style app switcher with live miniature previews of each session. */
export function Switcher({
  apps,
  topScreenId,
  onResume,
  onClose,
  onDismiss,
}: {
  apps: RunningApp[];
  topScreenId: (appId: string) => string | undefined;
  onResume: (appId: string) => void;
  onClose: (appId: string) => void;
  onDismiss: () => void;
}) {
  const t = useCds();
  return (
    <Pressable
      onPress={onDismiss}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        backgroundColor: "rgba(12,12,18,0.88)",
        justifyContent: "center",
      }}
    >
      {apps.length === 0 && (
        <Text style={{ textAlign: "center", color: "rgba(255,255,255,0.7)", fontSize: 14 }}>
          No open apps
        </Text>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 16, paddingHorizontal: 28, alignItems: "center" }}
      >
        {apps.map((app) => {
          const screenId = topScreenId(app.id);
          const screen = screenId ? screenStore.get(screenId) : undefined;
          return (
            <View key={app.id} style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7, width: CARD_W }}>
                <LinearGradient
                  colors={app.tile}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 12 }}>{app.emoji}</Text>
                </LinearGradient>
                <Text
                  numberOfLines={1}
                  style={{ flex: 1, color: "#fff", fontSize: 12.5, fontWeight: "600" }}
                >
                  {app.name}
                </Text>
                <Pressable
                  onPress={() => onClose(app.id)}
                  accessibilityLabel={`Close ${app.name}`}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: "rgba(255,255,255,0.25)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 10, lineHeight: 12 }}>✕</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={() => onResume(app.id)}
                style={{
                  width: CARD_W,
                  height: CARD_H,
                  borderRadius: 24,
                  overflow: "hidden",
                  backgroundColor: t.bg,
                }}
              >
                {screen?.content ? (
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: PREVIEW_W,
                      height: PREVIEW_H,
                      padding: 10,
                      backgroundColor: t.bg,
                      transform: [
                        { translateX: -PREVIEW_W / 4 },
                        { translateY: -PREVIEW_H / 4 },
                        { scale: 0.5 },
                      ],
                    }}
                  >
                    <Renderer
                      response={cleanLang(screen.content)}
                      library={genosLibrary}
                      isStreaming={false}
                    />
                  </View>
                ) : (
                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 64, opacity: 0.5 }}>{app.emoji}</Text>
                  </View>
                )}
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </Pressable>
  );
}
