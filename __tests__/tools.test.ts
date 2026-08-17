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
import {
  definitionsForProviders,
  enabledToolDefinitions,
  executeTool as executeRegistryTool,
} from "../src/genos/tools";
import { firecrawlKey } from "../src/genos/providers/firecrawl/key";

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

describe("provider-scoped tool registry", () => {
  const names = (exa: boolean, firecrawl: boolean) =>
    definitionsForProviders({ exa, firecrawl }).map((tool) => tool.function.name);

  it("composes no keys, Exa only, Firecrawl only, and both providers", () => {
    expect(names(false, false)).toEqual([]);
    expect(names(true, false)).toEqual(["web_search"]);
    expect(names(false, true)).toEqual([
      "firecrawl_search",
      "firecrawl_scrape",
      "firecrawl_agent",
    ]);
    expect(names(true, true)).toEqual([
      "web_search",
      "firecrawl_search",
      "firecrawl_scrape",
      "firecrawl_agent",
    ]);
  });

  it("never exposes maxCredits or arbitrary schema as model-controlled Agent arguments", () => {
    const agent = definitionsForProviders({ exa: false, firecrawl: true }).find(
      (tool) => tool.function.name === "firecrawl_agent",
    );
    const properties = agent?.function.parameters.properties as Record<string, unknown>;
    expect(properties.maxCredits).toBeUndefined();
    expect(properties.schema).toBeUndefined();
  });

  it("does not expose or execute Firecrawl before deterministic budget confirmation", async () => {
    await firecrawlKey.set("fc-disposable-unit-test-only");
    expect(enabledToolDefinitions({ workflowId: "firecrawl-market-research" })).toEqual([]);
    expect(
      enabledToolDefinitions({
        workflowId: "firecrawl-market-research",
        firecrawlConfirmed: true,
      }).map((tool) => tool.function.name),
    ).toEqual(["firecrawl_search", "firecrawl_scrape", "firecrawl_agent"]);
    expect(
      enabledToolDefinitions({
        workflowId: "firecrawl-market-research",
        firecrawlConfirmed: true,
        firecrawlOperation: "agent",
      }).map((tool) => tool.function.name),
    ).toEqual(["firecrawl_agent"]);
    await expect(
      executeRegistryTool(
        "firecrawl_search",
        { query: "must not run" },
        undefined,
        undefined,
        { workflowId: "firecrawl-market-research" },
      ),
    ).resolves.toContain("explicit Firecrawl setup and budget confirmation");
    await expect(
      executeRegistryTool(
        "firecrawl_search",
        { query: "wrong operation" },
        undefined,
        undefined,
        {
          workflowId: "firecrawl-market-research",
          firecrawlConfirmed: true,
          firecrawlOperation: "agent",
        },
      ),
    ).resolves.toContain("confirmed the agent operation");
  });
});
