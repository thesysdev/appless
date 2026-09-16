import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AppLess from "./src/appless/appless";
import { initTelemetry } from "./src/appless/telemetry";

export default function App() {
  useEffect(() => {
    initTelemetry();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <AppLess />
    </SafeAreaProvider>
  );
}
