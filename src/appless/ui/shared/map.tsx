/**
 * Shared MapView implementation - Google Maps' keyless `output=embed` mode.
 *
 * That mode is keyless only when the map is loaded *inside an iframe of a real
 * web page* - Google checks the HTTP Referer to allow it. Pointing a WebView
 * straight at the embed URL as its top-level document sends no referer, so
 * Google demands an API key. On native we load a tiny HTML document that hosts
 * the iframe, with a `baseUrl` that gives the document a web origin so the
 * iframe request carries a referer. On web (react-native-webview has no web
 * support) we render the iframe directly - the page's own origin is the
 * referer. Design systems supply only their corner radius.
 */
import React from "react";
import { Platform, View } from "react-native";
import { WebView } from "react-native-webview";
import type { MapViewProps, Renderer } from "../contract";

export function createMapRenderer(borderRadius: number): Renderer<MapViewProps> {
  return function MapView({ props }) {
    const place = props.placeName ?? "";
    const zoom = typeof props.zoom === "number" ? props.zoom : 15;
    const src = `https://maps.google.com/maps?q=${encodeURIComponent(place)}&z=${zoom}&output=embed`;

    const frame =
      Platform.OS === "web" ? (
        React.createElement("iframe", {
          src,
          style: { border: 0, width: "100%", height: "100%" },
          loading: "lazy",
          referrerPolicy: "no-referrer-when-downgrade",
          allowFullScreen: true,
        } as never)
      ) : (
        <WebView
          source={{
            html: `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"><style>html,body{margin:0;padding:0;height:100%;overflow:hidden}iframe{border:0;width:100%;height:100%}</style></head><body><iframe src="${src}" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></body></html>`,
            baseUrl: "https://www.google.com",
          }}
          style={{ flex: 1 }}
          javaScriptEnabled
          domStorageEnabled
        />
      );

    return (
      <View
        style={{
          width: "100%",
          height: 215,
          borderRadius,
          overflow: "hidden",
          backgroundColor: "rgba(120,120,128,0.14)",
        }}
      >
        {frame}
      </View>
    );
  };
}
