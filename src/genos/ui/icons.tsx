import * as lucideIcons from "lucide-react-native";
import React from "react";
import { View } from "react-native";

const icons = lucideIcons as unknown as Record<
  string,
  React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }> | undefined
>;

const kebabToPascal = (s: string) =>
  s
    .trim()
    .split(/[-_ ]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");

/** iOS system tint palette for icon badges. */
const BADGE_COLORS = [
  "#0a84ff", // blue
  "#34c759", // green
  "#ff9f0a", // orange
  "#af52de", // purple
  "#ff3b30", // red
  "#5ac8fa", // cyan
  "#5e5ce6", // indigo
  "#ff2d55", // pink
  "#30b0c7", // teal
];

/** Hand-picked tints for the most common icons; everything else hashes. */
const ICON_TINT: Record<string, string> = {
  wifi: "#0a84ff",
  bluetooth: "#0a84ff",
  plane: "#ff9f0a",
  "battery-full": "#34c759",
  battery: "#34c759",
  "battery-charging": "#34c759",
  moon: "#5e5ce6",
  bell: "#ff3b30",
  "bell-ring": "#ff3b30",
  heart: "#ff2d55",
  "heart-pulse": "#ff2d55",
  flame: "#ff9f0a",
  "credit-card": "#34c759",
  wallet: "#34c759",
  "map-pin": "#ff3b30",
  music: "#ff2d55",
  camera: "#8e8e93",
  settings: "#8e8e93",
  lock: "#8e8e93",
  "shield-check": "#34c759",
  sun: "#ff9f0a",
  "cloud-rain": "#5ac8fa",
  cloud: "#5ac8fa",
  droplets: "#5ac8fa",
  wind: "#30b0c7",
  "message-circle": "#34c759",
  phone: "#34c759",
  mail: "#0a84ff",
  calendar: "#ff3b30",
  clock: "#ff9f0a",
  "alarm-clock": "#ff9f0a",
  "volume-2": "#ff2d55",
};

export function iconTint(name: string): string {
  const key = name.toLowerCase();
  if (ICON_TINT[key]) return ICON_TINT[key];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return BADGE_COLORS[Math.abs(h) % BADGE_COLORS.length];
}

/** Render a lucide icon by kebab-case name; dot fallback for unknown names. */
export function LucideIcon({
  name,
  size = 17,
  strokeWidth = 2,
  color,
}: {
  name: string;
  size?: number;
  strokeWidth?: number;
  /** RN has no currentColor inheritance - callers pass the tint explicitly. */
  color: string;
}) {
  const Cmp = icons[kebabToPascal(name)];
  if (!Cmp) {
    return (
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
          opacity: 0.6,
        }}
      />
    );
  }
  return <Cmp size={size} strokeWidth={strokeWidth} color={color} />;
}

/** App-switcher glyph: two overlapping rounded squares (recent-apps metaphor). */
export function AppsIcon({ color, size = 18 }: { color: string; size?: number }) {
  const sq = Math.round(size * 0.64);
  const off = size - sq;
  const square = {
    position: "absolute" as const,
    width: sq,
    height: sq,
    borderWidth: 1.6,
    borderColor: color,
    borderRadius: 3,
    backgroundColor: "transparent" as const,
  };
  return (
    <View style={{ width: size, height: size }}>
      <View style={[square, { top: 0, left: 0 }]} />
      <View style={[square, { top: off, left: off }]} />
    </View>
  );
}

