import { StatusBar } from "expo-status-bar";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import GenOS from "./src/genos/GenOS";

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <GenOS />
    </SafeAreaProvider>
  );
}
