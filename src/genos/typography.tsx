import React, { createContext, useContext } from "react";
import {
  Platform,
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from "react-native";

const FONT_FAMILIES = {
  light: "Inter_300Light",
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
} as const;

const SYSTEM_FONT = Platform.select({
  ios: "System",
  android: "sans-serif",
  default: "system-ui",
});

const TypographyReadyContext = createContext(false);

export function TypographyProvider({
  loaded,
  children,
}: {
  loaded: boolean;
  children: React.ReactNode;
}) {
  return (
    <TypographyReadyContext.Provider value={loaded}>
      {children}
    </TypographyReadyContext.Provider>
  );
}

function familyForStyle(style: TextProps["style"] | TextInputProps["style"], loaded: boolean) {
  const flattened = StyleSheet.flatten(style) as TextStyle | undefined;
  if (flattened?.fontFamily) return flattened.fontFamily;
  if (!loaded) return SYSTEM_FONT;

  const numericWeight = Number.parseInt(String(flattened?.fontWeight ?? "400"), 10);
  if (numericWeight >= 800) return FONT_FAMILIES.extrabold;
  if (numericWeight >= 700) return FONT_FAMILIES.bold;
  if (numericWeight >= 600) return FONT_FAMILIES.semibold;
  if (numericWeight >= 500) return FONT_FAMILIES.medium;
  if (numericWeight <= 300) return FONT_FAMILIES.light;
  return FONT_FAMILIES.regular;
}

export function Text({ style, ...props }: TextProps) {
  const loaded = useContext(TypographyReadyContext);
  const fontFamily = familyForStyle(style, loaded);
  return <NativeText {...props} style={[style, { fontFamily, fontWeight: "normal" }]} />;
}

export const TextInput = React.forwardRef<NativeTextInput, TextInputProps>(function TextInput(
  { style, ...props },
  ref,
) {
  const loaded = useContext(TypographyReadyContext);
  const fontFamily = familyForStyle(style, loaded);
  return <NativeTextInput ref={ref} {...props} style={[style, { fontFamily, fontWeight: "normal" }]} />;
});

/** Linear-inspired hierarchy using Inter, its closest public substitute. */
export const linearType = {
  displayLarge: {
    fontSize: 56,
    lineHeight: 62,
    fontWeight: "600",
    letterSpacing: -1.8,
  },
  headline: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "600",
    letterSpacing: -0.6,
  },
  cardTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "500",
    letterSpacing: -0.4,
  },
  subhead: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "400",
    letterSpacing: -0.2,
  },
  bodyLarge: {
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "400",
    letterSpacing: -0.1,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400",
    letterSpacing: -0.05,
  },
  bodySmall: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "400",
    letterSpacing: 0,
  },
  caption: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "400",
    letterSpacing: 0,
  },
  button: {
    fontSize: 14,
    lineHeight: 17,
    fontWeight: "500",
    letterSpacing: 0,
  },
  eyebrow: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "500",
    letterSpacing: 0.4,
  },
} satisfies Record<string, TextStyle>;
