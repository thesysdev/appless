/**
 * Material 3 design tokens - static tonal palette seeded from the applessOS
 * brand indigo (#5e5ce6). Light/dark follows the OS via useColorScheme().
 * Hand-derived M3 tonal values (no runtime HCT math, no dynamic color - that
 * would need a dev build; this app runs in Expo Go).
 */
import { useColorScheme } from "react-native";
import type { ChartTheme } from "../shared/charts";

export interface MdTheme {
  /** Screen background. */
  surface: string;
  /** Card / grouped container surfaces, low → high emphasis. */
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  onSurface: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  /** Semantic accents used by stats/callouts (not core M3 roles). */
  success: string;
  successContainer: string;
  warningContainer: string;
  onWarningContainer: string;
  /** Pressed-state ripple color. */
  ripple: string;
  chartPalette: string[];
  dark: boolean;
}

export const MD_LIGHT: MdTheme = {
  surface: "#FBF8FF",
  surfaceContainerLow: "#F5F2FC",
  surfaceContainer: "#EFECF8",
  surfaceContainerHigh: "#E9E7F2",
  onSurface: "#1B1B21",
  onSurfaceVariant: "#46464F",
  outline: "#777680",
  outlineVariant: "#C7C5D0",
  primary: "#4F51C0",
  onPrimary: "#FFFFFF",
  primaryContainer: "#E1E0FF",
  onPrimaryContainer: "#08006C",
  secondaryContainer: "#E2E0F9",
  onSecondaryContainer: "#1A1A2C",
  error: "#BA1A1A",
  onError: "#FFFFFF",
  errorContainer: "#FFDAD6",
  onErrorContainer: "#410002",
  success: "#146C2E",
  successContainer: "#C6EFC9",
  warningContainer: "#FFEFC9",
  onWarningContainer: "#4E3D00",
  ripple: "rgba(27,27,33,0.12)",
  chartPalette: ["#4F51C0", "#B02F6E", "#146C2E", "#8A4F00", "#00696E", "#7D4E9E"],
  dark: false,
};

export const MD_DARK: MdTheme = {
  surface: "#131318",
  surfaceContainerLow: "#1B1B21",
  surfaceContainer: "#1F1F25",
  surfaceContainerHigh: "#2A292F",
  onSurface: "#E4E1E9",
  onSurfaceVariant: "#C7C5D0",
  outline: "#918F9A",
  outlineVariant: "#46464F",
  primary: "#C0C1FF",
  onPrimary: "#1D1D93",
  primaryContainer: "#3739A9",
  onPrimaryContainer: "#E1E0FF",
  secondaryContainer: "#434258",
  onSecondaryContainer: "#E2E0F9",
  error: "#FFB4AB",
  onError: "#690005",
  errorContainer: "#93000A",
  onErrorContainer: "#FFDAD6",
  success: "#8BD592",
  successContainer: "#0F5223",
  warningContainer: "#5D4A00",
  onWarningContainer: "#FFE9A6",
  ripple: "rgba(228,225,233,0.12)",
  chartPalette: ["#C0C1FF", "#FFAFD0", "#8BD592", "#F5BD6F", "#4DD9E2", "#D6BAF4"],
  dark: true,
};

export function useMd(): MdTheme {
  return useColorScheme() === "dark" ? MD_DARK : MD_LIGHT;
}

/** Adapter for the shared chart geometry. */
export function useMdChartTheme(): ChartTheme {
  const t = useMd();
  return { sep: t.outlineVariant, ink2: t.onSurfaceVariant, chartPalette: t.chartPalette };
}
