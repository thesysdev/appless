/** Unit tests for the in-app tools: semantic images and the @Search protocol. */

jest.mock("expo-secure-store", () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
}));
// expo/fetch pulls the winter runtime, which jest-expo's env can't load.
jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));

import { loremflickrUrl, parseImgUrl } from "../src/genos/tools/images";
import { executeTool, formatWebResults } from "../src/genos/tools/search";

describe("semantic image queries (/api/img)", () => {
  it("parses the prompt's canonical form", () => {
    expect(parseImgUrl("/api/img?q=ramen+bowl&seed=4&w=800&h=440")).toEqual({
      q: "ramen bowl",
      seed: 4,
      w: 800,
      h: 440,
    });
  });

  it("applies the same defaults and clamps as the old server", () => {
    expect(parseImgUrl("/api/img")).toEqual({ q: "abstract gradient", seed: 1, w: 800, h: 500 });
    expect(parseImgUrl("/api/img?q=x&seed=999999&w=9999&h=1")).toEqual({
      q: "x",
      seed: 10_000,
      w: 1600,
      h: 40,
    });
  });

  it("strips unsafe characters from the query", () => {
    expect(parseImgUrl("/api/img?q=sushi%22%3Cscript%3E&seed=2")?.q).toBe("sushiscript");
  });

  it("passes non-semantic URLs through as null", () => {
    expect(parseImgUrl("https://example.com/a.jpg")).toBeNull();
    expect(parseImgUrl("/other/path")).toBeNull();
  });

  it("builds a keyless LoremFlickr URL", () => {
    expect(loremflickrUrl({ q: "thai curry", seed: 3, w: 200, h: 200 })).toBe(
      "https://loremflickr.com/200/200/thai%2Ccurry?lock=3",
    );
  });
});

describe("web_search tool", () => {
  it("rejects unknown tools and empty queries without throwing", async () => {
    expect(await executeTool("rm_rf", {})).toContain("ERROR: unknown tool");
    expect(await executeTool("web_search", {})).toContain("ERROR: web_search requires");
    expect(await executeTool("web_search", { query: "  " })).toContain("ERROR");
  });

  it("formats results with source domains and an empty-results fallback", () => {
    const block = formatWebResults("test", [
      {
        title: "Result",
        url: "https://www.example.com/a",
        snippet: "Snippet text",
        published: "2026-07-14T10:00:00Z",
      },
    ]);
    expect(block).toContain("1. Result - example.com (2026-07-14)");
    expect(block).toContain("Snippet text");
    expect(formatWebResults("test", [])).toContain("none found");
  });
});
