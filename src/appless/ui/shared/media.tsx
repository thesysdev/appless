/**
 * Semantic image element shared by all design systems: resolves /api/img
 * queries via useSemanticImage, fades in on load, and shows a themed
 * placeholder while unresolved. Follows the createMapRenderer pattern -
 * design systems supply only their placeholder color.
 */
import React, { useState } from "react";
import { Image, View } from "react-native";
import { useSemanticImage } from "../../tools/images";

export function createImg(usePlaceholderColor: () => string) {
  return function Img({ uri, style }: { uri?: string; style: object }) {
    const placeholder = usePlaceholderColor();
    const [loaded, setLoaded] = useState(false);
    const resolved = useSemanticImage(uri);
    if (!resolved) return <View style={[style, { backgroundColor: placeholder }]} />;
    return (
      <Image
        source={{ uri: resolved }}
        onLoad={() => setLoaded(true)}
        style={[style, { opacity: loaded ? 1 : 0 }]}
        resizeMode="cover"
      />
    );
  };
}
