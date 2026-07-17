/**
 * Security regression tests for the trust layer: outbound URL policy,
 * genos:// deep-link validation and caps, credential redaction before form
 * values reach the model provider, and the image-host policy.
 */

jest.mock("expo-secure-store", () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
}));
jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));

// Capture stream launches instead of hitting Cerebras (store redaction test).
jest.mock("../src/genos/stream", () => ({
  NEEDS_LIVE_DATA: "needs live data",
  streamScreen: jest.fn(),
}));

import { Linking } from "react-native";
import {
  GENOS_REQUEST_MAX,
  GENOS_TOAST_MAX,
  capToastText,
  isAllowedAppId,
  parseOpenLink,
} from "../src/genos/safety/genosLink";
import { REDACTED, isSensitiveField, redactFormState } from "../src/genos/safety/redaction";
import { isAllowedExternalUrl, openExternalUrl, urlScheme } from "../src/genos/safety/urlPolicy";
import { openApp, resolveAction, screenStore } from "../src/genos/store";
import {
  imageUrlHost,
  isAllowedImageUrl,
  resolveExternalImageUrl,
} from "../src/genos/tools/images";

const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(true);

beforeEach(() => {
  openURLSpy.mockClear();
});

describe("urlPolicy: outbound scheme allowlist", () => {
  it("extracts the scheme case-insensitively, null when absent", () => {
    expect(urlScheme("https://example.com/x")).toBe("https:");
    expect(urlScheme("HTTP://example.com")).toBe("http:");
    expect(urlScheme("javascript:alert(1)")).toBe("javascript:");
    expect(urlScheme("  tel:+15551234")).toBe("tel:");
    expect(urlScheme("example.com/path")).toBeNull();
    expect(urlScheme("//example.com")).toBeNull();
  });

  it("opens http and https links", () => {
    const onBlocked = jest.fn();
    openExternalUrl("https://example.com/page", onBlocked);
    openExternalUrl("http://example.com", onBlocked);
    openExternalUrl("  HTTPS://EXAMPLE.COM/Caps ", onBlocked);
    expect(openURLSpy).toHaveBeenCalledTimes(3);
    expect(openURLSpy).toHaveBeenNthCalledWith(3, "HTTPS://EXAMPLE.COM/Caps");
    expect(onBlocked).not.toHaveBeenCalled();
    expect(isAllowedExternalUrl("https://example.com")).toBe(true);
  });

  it("blocks every other scheme instead of calling Linking", () => {
    const blocked = [
      "javascript:alert(document.cookie)",
      "intent://scan/#Intent;scheme=zxing;package=com.evil;end",
      "file:///etc/passwd",
      "sms:+15551234?body=send%20me%20money",
      "tel:+15551234",
      "mailto:a@b.c?subject=x&body=y",
      "genos://toast?text=hi",
      "market://details?id=com.evil",
      "example.com/no-scheme",
      "",
    ];
    for (const url of blocked) {
      const onBlocked = jest.fn();
      openExternalUrl(url, onBlocked);
      expect(onBlocked).toHaveBeenCalledTimes(1);
      expect(isAllowedExternalUrl(url)).toBe(false);
    }
    expect(openURLSpy).not.toHaveBeenCalled();
  });
});

describe("genosLink: deep-link validation and caps", () => {
  it("accepts catalog ids and safe summon-slug shapes only", () => {
    expect(isAllowedAppId("food")).toBe(true);
    expect(isAllowedAppId("Music")).toBe(true);
    expect(isAllowedAppId("summon-pizza-tracker")).toBe(true);
    expect(isAllowedAppId("a".repeat(32))).toBe(true);
    expect(isAllowedAppId("a".repeat(33))).toBe(false);
    expect(isAllowedAppId("evil app!")).toBe(false);
    expect(isAllowedAppId("../settings")).toBe(false);
    expect(isAllowedAppId("")).toBe(false);
  });

  it("validates open params and caps the request at 300 chars", () => {
    expect(parseOpenLink({ app: "Food", request: "show lunch spots" })).toEqual({
      appId: "food",
      request: "show lunch spots",
    });
    const long = parseOpenLink({ app: "food", request: "x".repeat(400) });
    expect(long?.request).toHaveLength(GENOS_REQUEST_MAX);
    expect(GENOS_REQUEST_MAX).toBe(300);
    expect(parseOpenLink({ app: "evil app!", request: "hi" })).toBeNull();
    expect(parseOpenLink({ app: "food" })).toBeNull();
    expect(parseOpenLink({ request: "hi" })).toBeNull();
    expect(parseOpenLink({})).toBeNull();
  });

  it("caps toast text at 120 chars", () => {
    expect(capToastText("Done ✓")).toBe("Done ✓");
    expect(capToastText("y".repeat(200))).toHaveLength(GENOS_TOAST_MAX);
    expect(GENOS_TOAST_MAX).toBe(120);
  });
});

describe("redaction: credential-shaped form fields", () => {
  it("flags credential words without hitting lookalikes", () => {
    for (const name of ["password", "Password", "cardCvv", "user_pin", "otp", "passphrase"]) {
      expect(isSensitiveField(name)).toBe(true);
    }
    for (const name of ["shopping", "email", "username", "spinner", "city"]) {
      expect(isSensitiveField(name)).toBe(false);
    }
  });

  it("replaces sensitive values, keeps the rest", () => {
    const out = redactFormState({ password: "hunter2", cardCvv: "123", city: "Goa" });
    expect(out).toEqual({ password: REDACTED, cardCvv: REDACTED, city: "Goa" });
    expect(redactFormState({})).toEqual({});
  });

  it("strips credentials from the request sent to the provider", () => {
    const app = {
      id: "food",
      name: "Food",
      emoji: "🍜",
      tile: ["#000", "#111"] as [string, string],
      request: "Open food",
    };
    const parentId = openApp(app);
    screenStore.patch(parentId, { status: "done" });
    const child = resolveAction(parentId, "Checkout", {
      password: "hunter2",
      cardCvv: "123",
      city: "Goa",
    });
    const request = screenStore.get(child)?.request ?? "";
    expect(request).not.toContain("hunter2");
    expect(request).not.toContain("123");
    expect(request).toContain(REDACTED);
    expect(request).toContain("Goa");
  });
});

describe("image-host policy", () => {
  it("parses https hosts only", () => {
    expect(imageUrlHost("https://images.unsplash.com/photo-1?w=80")).toBe("images.unsplash.com");
    expect(imageUrlHost("https://ATTACKER.example.evil/x.png")).toBe("attacker.example.evil");
    expect(imageUrlHost("http://images.unsplash.com/x")).toBeNull();
    expect(imageUrlHost("ftp://images.unsplash.com/x")).toBeNull();
    expect(imageUrlHost("/api/img?q=cats")).toBeNull();
  });

  it("allows only the three image hosts over https", () => {
    expect(isAllowedImageUrl("https://images.unsplash.com/photo-1")).toBe(true);
    expect(isAllowedImageUrl("https://loremflickr.com/800/500/cats?lock=1")).toBe(true);
    expect(isAllowedImageUrl("https://upload.wikimedia.org/w/a/b.png")).toBe(true);
    // The exfil shape: arbitrary host, context encoded in the query.
    expect(isAllowedImageUrl("https://attacker.example/c.png?d=secret")).toBe(false);
    expect(isAllowedImageUrl("http://images.unsplash.com/photo-1")).toBe(false);
  });

  it("falls back to the LoremFlickr semantic path for blocked URLs", () => {
    const good = "https://upload.wikimedia.org/w/a/b.png";
    expect(resolveExternalImageUrl(good)).toBe(good);
    expect(resolveExternalImageUrl("https://attacker.example/c.png?d=secret")).toBe(
      "https://loremflickr.com/800/500/abstract%2Cgradient?lock=1",
    );
  });
});
