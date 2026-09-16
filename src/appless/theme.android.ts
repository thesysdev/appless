/**
 * Android shell theme - Material 3 tokens mapped onto the shell's theme shape
 * so the OS chrome (back pill, apps button, toast, error screen, switcher)
 * matches the Material renderer set without any shell-code changes.
 */
import { useColorScheme } from "react-native";
import type { CdsTheme } from "./ui/cupertino/theme";
import { MD_DARK, MD_LIGHT } from "./ui/material/theme";

export type { CdsTheme } from "./ui/cupertino/theme";

function toShellTheme(dark: boolean): CdsTheme {
  const m = dark ? MD_DARK : MD_LIGHT;
  return {
    bg: m.surface,
    group: m.surfaceContainer,
    ink: m.onSurface,
    ink2: m.onSurfaceVariant,
    ink3: m.outline,
    sep: m.outlineVariant,
    fill: m.surfaceContainerHigh,
    tint: m.primary,
    green: m.success,
    red: m.error,
    bubble: m.surfaceContainerHigh,
    chromeBg: m.secondaryContainer,
    chromeInk: m.onSecondaryContainer,
    chromeBorder: m.outlineVariant,
    chartPalette: m.chartPalette,
    dark,
  };
}

const SHELL_LIGHT = toShellTheme(false);
const SHELL_DARK = toShellTheme(true);

export function useCds(): CdsTheme {
  return useColorScheme() === "dark" ? SHELL_DARK : SHELL_LIGHT;
}
