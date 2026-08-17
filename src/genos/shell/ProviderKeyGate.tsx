import React, { useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { firecrawlKey, type FirecrawlKeyStatus } from "../providers/firecrawl/key";
import { useCds } from "../theme";
import { Text, TextInput, linearType } from "../typography";

export function ProviderKeyGate({
  status,
  onDismiss,
  onConnected,
}: {
  status: FirecrawlKeyStatus;
  onDismiss: () => void;
  onConnected: () => void;
}) {
  const t = useCds();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const valid = value.trim().length >= 10;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    await firecrawlKey.set(value);
    setSaving(false);
    onConnected();
  };

  return (
    <View
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 90,
        backgroundColor: t.bg,
        alignItems: "center",
        justifyContent: "center",
        padding: 28,
        gap: 14,
      }}
    >
      <Text style={{ color: t.ink, ...linearType.headline }}>Connect Firecrawl</Text>
      <Text style={{ fontSize: 14, color: t.ink2, textAlign: "center", maxWidth: 360 }}>
        This action uses your Firecrawl credits. Your key is stored only on this device and sent
        directly to Firecrawl.
      </Text>
      {status === "rejected" && (
        <Text style={{ fontSize: 13, color: t.red, textAlign: "center" }}>
          Firecrawl rejected the saved key. Enter a current key.
        </Text>
      )}
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="fc-…"
        placeholderTextColor={t.ink3}
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={save}
        style={{
          width: "100%",
          maxWidth: 360,
          borderWidth: 1,
          borderColor: t.sep,
          backgroundColor: t.group,
          borderRadius: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
          fontSize: 14,
          color: t.ink,
        }}
      />
      <Pressable
        onPress={save}
        disabled={!valid || saving}
        style={({ pressed }) => ({
          paddingVertical: 12,
          paddingHorizontal: 34,
          borderRadius: 22,
          backgroundColor: "#5e5ce6",
          opacity: !valid || saving ? 0.4 : pressed ? 0.8 : 1,
        })}
      >
        <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>
          {saving ? "Saving…" : "Use Firecrawl"}
        </Text>
      </Pressable>
      <Pressable onPress={() => Linking.openURL("https://www.firecrawl.dev/app/api-keys").catch(() => {})}>
        <Text style={{ color: t.tint, fontSize: 13 }}>Get a key from Firecrawl</Text>
      </Pressable>
      <Pressable accessibilityLabel="Dismiss Firecrawl key prompt" onPress={onDismiss}>
        <Text style={{ color: t.ink2, fontSize: 13 }}>Not now</Text>
      </Pressable>
    </View>
  );
}
