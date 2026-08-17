import React from "react";
import { Pressable, ScrollView, View } from "react-native";
import {
  commandAvailability,
  filterSlashCommands,
  type SlashCommandDef,
} from "../commands";
import { Text, linearType } from "../typography";
import { ProviderIcon } from "../ui/ProviderIcon";

export function moveCommandSelection(current: number, delta: number, count: number): number {
  if (count <= 0) return -1;
  return (Math.max(0, current) + delta + count) % count;
}

export function CommandMenu({
  text,
  hasProviderKey,
  highlightedIndex,
  onHighlightedIndexChange,
  onSelect,
  onNeedsKey,
  onDismiss,
}: {
  text: string;
  hasProviderKey: boolean;
  highlightedIndex: number;
  onHighlightedIndexChange: (index: number) => void;
  onSelect: (command: SlashCommandDef) => void;
  onNeedsKey: (command: SlashCommandDef) => void;
  onDismiss: () => void;
}) {
  const commands = filterSlashCommands(text);

  return (
    <View
      accessibilityLabel="Firecrawl slash commands"
      style={{
        maxHeight: 330,
        borderRadius: 20,
        overflow: "hidden",
        backgroundColor: "rgba(22,22,28,0.96)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.2)",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", padding: 12, gap: 8 }}>
        <Text style={{ flex: 1, color: "rgba(255,255,255,0.7)", ...linearType.caption }}>
          FIRECRAWL COMMANDS · exact command + Enter to run
        </Text>
        <Pressable accessibilityLabel="Dismiss command menu" onPress={onDismiss}>
          <Text style={{ color: "#fff", fontSize: 13 }}>Escape</Text>
        </Pressable>
      </View>
      {commands.length === 0 ? (
        <View accessibilityLabel="No matching slash commands" style={{ padding: 18 }}>
          <Text style={{ color: "rgba(255,255,255,0.72)", ...linearType.bodySmall }}>
            No matching Firecrawl command. This text will not be sent as a generic request.
          </Text>
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>
          {commands.map((command, index) => {
            const availability = commandAvailability(command, hasProviderKey);
            const unavailable = availability === "unavailable";
            const label = availability === "enabled" ? "Ready" : availability === "needs-key" ? "Connect key" : "Unavailable";
            return (
              <Pressable
                key={command.id}
                accessibilityRole="button"
                accessibilityState={{ disabled: unavailable, selected: index === highlightedIndex }}
                accessibilityLabel={`/${command.id}, ${command.title}. ${command.description}. ${label}`}
                disabled={unavailable}
                onHoverIn={() => onHighlightedIndexChange(index)}
                onPress={() => availability === "needs-key" ? onNeedsKey(command) : onSelect(command)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 11,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: index === highlightedIndex ? "rgba(255,255,255,0.12)" : "transparent",
                  opacity: unavailable ? 0.45 : pressed ? 0.65 : 1,
                })}
              >
                <ProviderIcon providerId={command.providerId} size={30} cornerRadius={8} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>
                    /{command.id}
                  </Text>
                  <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.62)", fontSize: 11.5 }}>
                    {command.description}
                  </Text>
                </View>
                <Text style={{ color: availability === "enabled" ? "#7ee787" : "#ffd166", fontSize: 10.5 }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
