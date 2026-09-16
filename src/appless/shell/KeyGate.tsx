/**
 * Authentication for protected model endpoints. Local vLLM servers without
 * authentication skip this gate; a 401/403 also opens it when a key is needed.
 */
import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { modelKey, type KeyStatus } from "../../config";
import { useCds } from "../theme";

const ACCENT = "#5e5ce6";

export function KeyGate({ status }: { status: KeyStatus }) {
  const t = useCds();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const valid = value.trim().length > 0;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    await modelKey.set(value);
  };

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        backgroundColor: t.bg,
        alignItems: "center",
        justifyContent: "center",
        padding: 28,
        gap: 14,
      }}
    >
      <Text style={{ fontSize: 30, fontWeight: "800", color: t.ink, letterSpacing: -0.5 }}>
        AppLess
      </Text>
      <Text style={{ fontSize: 14, color: t.ink2, textAlign: "center", maxWidth: 320 }}>
        Enter the access key for your screen generation service. Your key is stored
        only on this device.
      </Text>

      {status === "rejected" && (
        <Text style={{ fontSize: 13, color: t.red, textAlign: "center" }}>
          The service requires a valid access key. Enter one to continue.
        </Text>
      )}

      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="Access key"
        secureTextEntry
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
          paddingHorizontal: 36,
          borderRadius: 22,
          backgroundColor: ACCENT,
          opacity: !valid || saving ? 0.4 : pressed ? 0.8 : 1,
        })}
      >
        <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>
          {saving ? "Starting…" : "Start"}
        </Text>
      </Pressable>

    </View>
  );
}
