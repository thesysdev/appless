import React from "react";
import {
  Platform,
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextStyle,
} from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import {
  Text,
  TextInput,
  TypographyProvider,
} from "../src/genos/typography";

function renderText(style?: TextStyle | TextStyle[], loaded = true) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <TypographyProvider loaded={loaded}>
        <Text style={style}>Typography</Text>
      </TypographyProvider>,
    );
  });
  return tree;
}

function renderedStyle(
  tree: ReactTestRenderer,
  type: typeof NativeText | typeof NativeTextInput,
) {
  return StyleSheet.flatten(tree.root.findByType(type).props.style) as TextStyle;
}

describe("global typography wrappers", () => {
  it("uses the regular Inter family when no weight is requested", () => {
    const tree = renderText();
    expect(renderedStyle(tree, NativeText)).toMatchObject({
      fontFamily: "Inter_400Regular",
      fontWeight: "normal",
    });
    act(() => tree.unmount());
  });

  it.each([
    ["300", "Inter_300Light"],
    ["500", "Inter_500Medium"],
    ["600", "Inter_600SemiBold"],
    ["700", "Inter_700Bold"],
    ["800", "Inter_800ExtraBold"],
  ] as const)("maps weight %s to %s", (fontWeight, fontFamily) => {
    const tree = renderText({ fontWeight });
    expect(renderedStyle(tree, NativeText)).toMatchObject({
      fontFamily,
      fontWeight: "normal",
    });
    act(() => tree.unmount());
  });

  it("flattens style arrays before selecting the font family", () => {
    const tree = renderText([{ fontWeight: "300" }, { fontWeight: "700" }]);
    expect(renderedStyle(tree, NativeText)).toMatchObject({
      fontFamily: "Inter_700Bold",
      fontWeight: "normal",
    });
    act(() => tree.unmount());
  });

  it("preserves an explicit font family", () => {
    const tree = renderText({ fontFamily: "CustomFamily", fontWeight: "700" });
    expect(renderedStyle(tree, NativeText)).toMatchObject({
      fontFamily: "CustomFamily",
      fontWeight: "normal",
    });
    act(() => tree.unmount());
  });

  it("uses the platform system family before Inter is loaded", () => {
    const tree = renderText({ fontWeight: "700" }, false);
    expect(renderedStyle(tree, NativeText)).toMatchObject({
      fontFamily: Platform.select({
        ios: "System",
        android: "sans-serif",
        default: "system-ui",
      }),
      fontWeight: "normal",
    });
    act(() => tree.unmount());
  });

  it("applies the same family and native weight reset to text inputs", () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <TypographyProvider loaded>
          <TextInput style={{ fontWeight: "600" }} />
        </TypographyProvider>,
      );
    });
    expect(renderedStyle(tree, NativeTextInput)).toMatchObject({
      fontFamily: "Inter_600SemiBold",
      fontWeight: "normal",
    });
    act(() => tree.unmount());
  });
});
