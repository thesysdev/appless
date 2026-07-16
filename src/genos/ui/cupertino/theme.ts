/**
 * Cupertino + shell design tokens - the RN port of cupertino.css / genos.css
 * custom properties. Light/dark follows the OS via useColorScheme().
 */
import { useColorScheme } from "react-native";

export interface CdsTheme {
  /** Screen background behind grouped content. */
  bg: string;
  /** Grouped-list / card surface. */
  group: string;
  ink: string;
  ink2: string;
  ink3: string;
  sep: string;
  fill: string;
  tint: string;
  green: string;
  red: string;
  bubble: string;
  /** Shell chrome (back pill, latency chip). */
  chromeBg: string;
  chromeInk: string;
  /** Hairline stroke around chrome buttons - must read on chromeBg in both modes. */
  chromeBorder: string;
  /** Categorical chart palette - validated against light/dark surfaces. */
  chartPalette: string[];
  dark: boolean;
}

export const CDS_LIGHT: CdsTheme = {
  bg: "#f2f2f7",
  group: "#ffffff",
  ink: "#101013",
  ink2: "rgba(60,60,67,0.6)",
  ink3: "rgba(60,60,67,0.3)",
  sep: "rgba(60,60,67,0.15)",
  fill: "rgba(120,120,128,0.14)",
  tint: "#007aff",
  green: "#34c759",
  red: "#ff3b30",
  bubble: "#e9e9eb",
  chromeBg: "rgba(255,255,255,0.9)",
  chromeInk: "#1c1c1e",
  chromeBorder: "rgba(0,0,0,0.08)",
  chartPalette: ["#0A84FF", "#C2410C", "#15803D", "#BF5AF2", "#FF375F", "#0891B2"],
  dark: false,
};

export const CDS_DARK: CdsTheme = {
  bg: "#000000",
  group: "#1c1c1e",
  ink: "#f5f5f7",
  ink2: "rgba(235,235,245,0.62)",
  ink3: "rgba(235,235,245,0.3)",
  sep: "rgba(84,84,88,0.55)",
  fill: "rgba(120,120,128,0.22)",
  tint: "#0a84ff",
  green: "#34c759",
  red: "#ff3b30",
  bubble: "#26262a",
  chromeBg: "rgba(58,58,66,0.92)",
  chromeInk: "#ffffff",
  chromeBorder: "rgba(255,255,255,0.16)",
  chartPalette: ["#3B82F6", "#D97706", "#16A34A", "#A855F7", "#F43F5E", "#0284C7"],
  dark: true,
};

export function useCds(): CdsTheme {
  return useColorScheme() === "dark" ? CDS_DARK : CDS_LIGHT;
}
