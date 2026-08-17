import { Globe } from "phosphor-react-native";
import React from "react";
import { Image } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { APPS } from "../src/genos/apps";
import { getProvider, raycastFaviconUrl } from "../src/genos/providers";
import { ProviderIcon } from "../src/genos/ui/ProviderIcon";

describe("provider registry and favicon resolver", () => {
  it("normalizes a bare domain and full URL to the hostname", () => {
    expect(raycastFaviconUrl("firecrawl.dev")).toBe(
      "https://api.ray.so/favicon?url=firecrawl.dev&size=64",
    );
    expect(raycastFaviconUrl("https://www.firecrawl.dev/docs?q=icons#usage")).toBe(
      "https://api.ray.so/favicon?url=www.firecrawl.dev&size=64",
    );
  });

  it("removes paths and queries from bare domains", () => {
    expect(raycastFaviconUrl("firecrawl.dev/docs?source=app", 32)).toBe(
      "https://api.ray.so/favicon?url=firecrawl.dev&size=32",
    );
  });

  it("defaults and clamps favicon sizes", () => {
    expect(raycastFaviconUrl("firecrawl.dev")).toContain("&size=64");
    expect(raycastFaviconUrl("firecrawl.dev", 1)).toContain("&size=16");
    expect(raycastFaviconUrl("firecrawl.dev", 999)).toContain("&size=256");
  });

  it("returns null for malformed or unsupported input", () => {
    expect(raycastFaviconUrl("not a url")).toBeNull();
    expect(raycastFaviconUrl("http://firecrawl.dev")).toBeNull();
    expect(raycastFaviconUrl("")).toBeNull();
  });

  it("looks up known providers without inventing unknown metadata", () => {
    expect(getProvider("firecrawl")).toMatchObject({
      name: "Firecrawl",
      domain: "firecrawl.dev",
    });
    expect(getProvider("unknown")).toBeUndefined();
    expect(getProvider("toString")).toBeUndefined();
  });

  it("keeps built-in app metadata provider-free", () => {
    expect(APPS).not.toHaveLength(0);
    expect(APPS.every((app) => app.providerId === undefined)).toBe(true);
  });
});

describe("ProviderIcon", () => {
  it("shows a local fallback while loading and after an image error", () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<ProviderIcon providerId="firecrawl" size={32} />);
    });

    expect(tree.root.findAllByType(Globe)).toHaveLength(1);
    const image = tree.root.findByType(Image);
    expect(image.props.accessibilityLabel).toBe("Firecrawl provider");

    act(() => image.props.onError());
    expect(tree.root.findAllByType(Image)).toHaveLength(0);
    expect(tree.root.findAllByType(Globe)).toHaveLength(1);

    act(() => tree.unmount());
  });
});
