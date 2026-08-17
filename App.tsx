import { StatusBar } from "expo-status-bar";
import {
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/inter";
import React, { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import GenOS from "./src/genos/GenOS";
import { initTelemetry } from "./src/genos/telemetry";
import { TypographyProvider } from "./src/genos/typography";

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    initTelemetry();
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <TypographyProvider loaded={fontsLoaded}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <GenOS />
      </SafeAreaProvider>
    </TypographyProvider>
  );
}
