jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));

import { fetch as expoFetch } from "expo/fetch";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { cerebrasKey } from "../src/config";
import { ProviderKeyGate } from "../src/genos/shell/ProviderKeyGate";
import {
  cancelFirecrawlAgent,
  firecrawlAgent,
  firecrawlScrape,
  firecrawlSearch,
  getFirecrawlAgentStatus,
  pollFirecrawlAgent,
} from "../src/genos/tools/firecrawl";
import {
  FirecrawlKeyStore,
  firecrawlKey,
} from "../src/genos/providers/firecrawl/key";
import {
  agentPolicy,
  FIRECRAWL_WORKFLOW_IDS,
  FIRECRAWL_WORKFLOWS,
  trustedAgentSchema,
} from "../src/genos/workflows";

const mockedFetch = expoFetch as jest.MockedFunction<typeof expoFetch>;

function response(status: number, body: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: jest.fn(async () => body),
    text: jest.fn(async () => JSON.stringify(body)),
  } as unknown as Response;
}

describe("Firecrawl BYOK store", () => {
  it("hydrates, sets, and rejects only the current key", async () => {
    const storage = {
      read: jest.fn(async () => "fc-stored"),
      write: jest.fn(async (_value: string | null) => {}),
    };
    const store = new FirecrawlKeyStore(storage, undefined);
    await Promise.resolve();
    await Promise.resolve();
    expect(store.get()).toBe("fc-stored");
    expect(store.getStatus()).toBe("present");

    await store.set("fc-first");
    store.markRejected("fc-stale");
    expect(store.get()).toBe("fc-first");
    await store.set("fc-replaced");
    store.markRejected("fc-first");
    expect(store.get()).toBe("fc-replaced");
    store.markRejected("fc-replaced");
    expect(store.get()).toBeNull();
    expect(store.getStatus()).toBe("rejected");
    expect(storage.write).toHaveBeenLastCalledWith(null);
  });

  it("dismisses the provider gate without changing Cerebras credentials", async () => {
    const dismiss = jest.fn();
    const before = cerebrasKey.get();
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        React.createElement(ProviderKeyGate, {
          status: "missing",
          onDismiss: dismiss,
          onConnected: jest.fn(),
        }),
      );
    });
    await act(async () => {
      tree.root.findByProps({ accessibilityLabel: "Dismiss Firecrawl key prompt" }).props.onPress();
    });
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(cerebrasKey.get()).toBe(before);
    await act(async () => tree.unmount());
  });
});

describe("trusted Firecrawl workflow contracts", () => {
  it.each(FIRECRAWL_WORKFLOW_IDS)("defines bounded policy and schema for %s", (id) => {
    const contract = FIRECRAWL_WORKFLOWS[id];
    const policy = agentPolicy(id, "quick");
    const schema = trustedAgentSchema(id);
    expect(contract.instructions.length).toBeGreaterThan(30);
    expect(contract.resultFields.length).toBeGreaterThan(0);
    expect(policy?.maxCredits).toBeGreaterThan(0);
    expect(policy?.timeoutMs).toBeGreaterThan(0);
    expect(schema).toMatchObject({ type: "object", additionalProperties: false });
    expect(Object.values((schema?.properties ?? {}) as Record<string, unknown>)).not.toContainEqual({});
  });

  it("keeps deep-research budgets centralized by depth", () => {
    expect(agentPolicy("firecrawl-deep-research", "quick")?.maxCredits).toBe(100);
    expect(agentPolicy("firecrawl-deep-research", "thorough")?.maxCredits).toBe(300);
    expect(agentPolicy("firecrawl-deep-research", "exhaustive")?.maxCredits).toBe(750);
  });
});

describe("Firecrawl REST primitives", () => {
  beforeEach(async () => {
    jest.useRealTimers();
    mockedFetch.mockReset();
    await firecrawlKey.set("fc-unit-test-placeholder");
  });

  it("validates arguments before network access", async () => {
    expect(await firecrawlSearch({ query: "" })).toContain("ERROR");
    expect(await firecrawlScrape({ url: "file:///etc/passwd" }, "firecrawl")).toContain("HTTP(S)");
    expect(
      await firecrawlAgent({ prompt: "x" }, undefined),
    ).toContain("trusted Firecrawl workflow");
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("posts a bounded search request and retains source URLs", async () => {
    mockedFetch.mockResolvedValueOnce(
      response(200, {
        success: true,
        data: { web: [{ title: "Docs", url: "https://docs.firecrawl.dev/", description: "API" }] },
        creditsUsed: 2,
      }) as never,
    );
    const output = await firecrawlSearch({ query: "Firecrawl API", limit: 999, format: "markdown" });
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe("https://api.firecrawl.dev/v2/search");
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toMatch(/^Bearer /);
    const body = JSON.parse(String(init?.body));
    expect(body.limit).toBe(10);
    expect(body.scrapeOptions.formats).toEqual([{ type: "markdown" }]);
    expect(output).toContain("https://docs.firecrawl.dev/");
  });

  it("uses a trusted scrape schema, truncates content, and retains the source", async () => {
    mockedFetch.mockResolvedValueOnce(
      response(200, {
        data: {
          markdown: "x".repeat(30_000),
          metadata: { sourceURL: "https://example.com/article" },
        },
      }) as never,
    );
    const output = await firecrawlScrape(
      { url: "https://example.com/article", format: "markdown" },
      "firecrawl-market-research",
    );
    expect(output.length).toBeLessThan(25_000);
    expect(output).toContain("https://example.com/article");
    expect(output).toContain("truncated");
  });

  it("rejects the exact credential on 401 and maps rate/credit errors", async () => {
    mockedFetch.mockResolvedValueOnce(response(401, { error: "unauthorized" }) as never);
    expect(await firecrawlSearch({ query: "test" })).toContain("rejected the API key");
    expect(firecrawlKey.getStatus()).toBe("rejected");

    await firecrawlKey.set("fc-unit-test-placeholder");
    mockedFetch.mockResolvedValueOnce(response(429, { error: "rate" }) as never);
    expect(await firecrawlSearch({ query: "test" })).toContain("rate or concurrency limit");

    mockedFetch.mockResolvedValueOnce(response(402, { error: "credits" }) as never);
    expect(await firecrawlSearch({ query: "test" })).toContain("credit limit reached");
  });

  it("starts Agent once with the central maxCredits and trusted schema, then retains sources", async () => {
    mockedFetch
      .mockResolvedValueOnce(response(200, { success: true, id: "agent-job-1234" }) as never)
      .mockResolvedValueOnce(
        response(200, {
          success: true,
          status: "completed",
          data: { finding: "Observed", sources: ["https://example.com/evidence"] },
          creditsUsed: 12,
        }) as never,
      );
    const output = await firecrawlAgent(
      { prompt: "Compare this market", depth: "quick", confirmCost: true, schema: { malicious: true }, maxCredits: 999999 },
      "firecrawl-market-research",
    );
    const post = mockedFetch.mock.calls.find(([, init]) => init?.method === "POST");
    const body = JSON.parse(String(post?.[1]?.body));
    expect(body.maxCredits).toBe(250);
    expect(body.model).toBe("spark-1-mini");
    expect(body.schema).toEqual(trustedAgentSchema("firecrawl-market-research"));
    expect(body.schema).not.toHaveProperty("malicious");
    expect(output).toContain("agent-job-1234");
    expect(output).toContain("https://example.com/evidence");
  });

  it("resumes by job ID without creating a duplicate paid job", async () => {
    mockedFetch.mockResolvedValueOnce(
      response(200, { success: true, status: "completed", data: {}, creditsUsed: 4 }) as never,
    );
    await firecrawlAgent(
      { prompt: "Resume", depth: "quick", confirmCost: true, jobId: "existing-job-1234" },
      "firecrawl-market-research",
    );
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(mockedFetch.mock.calls[0][1]?.method).toBe("GET");
  });

  it("deduplicates identical Agent starts across screen retries", async () => {
    mockedFetch
      .mockResolvedValueOnce(response(200, { success: true, id: "dedupe-job-1234" }) as never)
      .mockResolvedValueOnce(response(200, { success: true, status: "completed", data: {} }) as never)
      .mockResolvedValueOnce(response(200, { success: true, status: "completed", data: {} }) as never);
    const args = { prompt: "Unique dedupe test prompt", depth: "quick", confirmCost: true };
    await firecrawlAgent(args, "firecrawl-market-research");
    await firecrawlAgent(args, "firecrawl-market-research");
    expect(mockedFetch.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    expect(mockedFetch.mock.calls.filter(([, init]) => init?.method === "GET")).toHaveLength(2);
  });

  it("maps failed and cancelled status distinctly", async () => {
    mockedFetch.mockResolvedValueOnce(
      response(200, { success: true, status: "failed", error: "could not extract" }) as never,
    );
    expect(await getFirecrawlAgentStatus("failed-job-1234")).toMatchObject({ status: "failed" });
    mockedFetch.mockResolvedValueOnce(
      response(200, { success: true, status: "cancelled" }) as never,
    );
    expect(await getFirecrawlAgentStatus("cancel-job-1234")).toMatchObject({ status: "cancelled" });
  });

  it("polls processing to completed with progress", async () => {
    jest.useFakeTimers();
    mockedFetch
      .mockResolvedValueOnce(response(200, { success: true, status: "processing" }) as never)
      .mockResolvedValueOnce(response(200, { success: true, status: "completed", data: {} }) as never);
    const progress = jest.fn();
    const pending = pollFirecrawlAgent("poll-job-1234", 30_000, undefined, progress);
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(3_000);
    await expect(pending).resolves.toMatchObject({ status: "completed" });
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ state: "processing" }));
  });

  it("times out with a recoverable job ID and does not POST", async () => {
    const now = jest.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValueOnce(2);
    await expect(pollFirecrawlAgent("timeout-job-1234", 1)).rejects.toThrow("timeout-job-1234");
    expect(mockedFetch).not.toHaveBeenCalled();
    now.mockRestore();
  });

  it("issues documented DELETE cancellation on AbortSignal after start", async () => {
    const controller = new AbortController();
    mockedFetch
      .mockResolvedValueOnce(response(200, { success: true, id: "abort-job-1234" }) as never)
      .mockResolvedValueOnce(response(200, { success: true, status: "processing" }) as never)
      .mockResolvedValueOnce(response(200, { success: true }) as never);
    const output = await firecrawlAgent(
      { prompt: "Bounded research", depth: "quick", confirmCost: true },
      "firecrawl-market-research",
      controller.signal,
      (progress) => {
        if (progress.state === "processing") controller.abort();
      },
    );
    expect(output).toContain("cancelled locally");
    expect(mockedFetch.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true);
  });

  it("refuses every Agent run without explicit central cost confirmation", async () => {
    const output = await firecrawlAgent(
      { prompt: "Do not start", depth: "quick" },
      "firecrawl-market-research",
    );
    expect(output).toContain("explicit Agent cost/depth confirmation");
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("exposes the standalone cancellation primitive", async () => {
    mockedFetch.mockResolvedValueOnce(response(200, { success: true }) as never);
    await cancelFirecrawlAgent("cancel-job-1234");
    expect(mockedFetch.mock.calls[0][1]?.method).toBe("DELETE");
  });
});
