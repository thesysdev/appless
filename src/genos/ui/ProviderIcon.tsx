import { Globe, Link } from "phosphor-react-native";
import React, { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { getProvider, raycastFaviconUrl } from "../providers";

export function ProviderIcon({
  providerId,
  size,
  cornerRadius = Math.round(size * 0.22),
}: {
  providerId: string;
  size: number;
  cornerRadius?: number;
}) {
  const provider = getProvider(providerId);
  const source = provider ? raycastFaviconUrl(provider.domain, size) : null;
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [providerId]);

  const FallbackIcon = provider?.fallbackGlyph === "globe" ? Globe : Link;
  const label = provider ? `${provider.name} provider` : "Provider";

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="image"
      style={{
        width: size,
        height: size,
        borderRadius: cornerRadius,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        backgroundColor: "rgba(255,255,255,0.18)",
      }}
    >
      <FallbackIcon size={size * 0.58} color="#fff" weight="bold" />
      {source && !imageFailed && (
        <Image
          source={{ uri: source }}
          accessibilityLabel={label}
          onError={() => setImageFailed(true)}
          style={{
            position: "absolute",
            width: size,
            height: size,
            borderRadius: cornerRadius,
          }}
        />
      )}
    </View>
  );
}
