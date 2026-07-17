/**
 * Honest Actions tests: risk classification, confirmation gating, receipt
 * record/decline, executor registry swap, and the no-prefetch invariant
 * (executors never run from speculative generation paths).
 */

jest.mock("expo-secure-store", () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
}));
jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));

// Capture stream launches instead of hitting Cerebras.
const streamCalls: Array<{ messages: unknown }> = [];
jest.mock("../src/genos/stream", () => ({
  NEEDS_LIVE_DATA: "needs live data",
  streamScreen: jest.fn((messages: unknown) => {
    streamCalls.push({ messages });
  }),
}));

import { executeConfirmed, registerExecutor, type ActionExecutor } from "../src/genos/actions/executor";
import { classifyAction } from "../src/genos/actions/model";
import { SIMULATED_NOTE, receipts } from "../src/genos/actions/receipts";
import { openApp, resolveAction, screenStore, setActiveScreen } from "../src/genos/store";

describe("classifyAction", () => {
  it("flags order/book/pay/send/delete-shaped messages as consequential", () => {
    for (const m of [
      "Order a margherita pizza",
      "Book a flight to Goa",
      "Pay my rent",
      "Send the money",
      "Delete my account",
      "Cancel my subscription",
      "Text Maya that I'm late",
      "Transfer $50 to savings",
    ]) {
      expect(classifyAction(m)).toBe("consequential");
    }
  });

  it("leaves navigation and read-shaped messages on auto", () => {
    for (const m of [
      "Open the Wi-Fi screen",
      "Show my messages",
      "Show my books",
      "What's the weather this week",
      "See transaction history",
    ]) {
      expect(classifyAction(m)).toBe("auto");
    }
  });
});

describe("receipts", () => {
  it("records confirmed and declined receipts, newest first", () => {
    const confirmed = receipts.record({
      appId: "food",
      label: "Order a test ramen",
      tier: "consequential",
      status: "confirmed-simulated",
    });
    expect(confirmed.id).toContain("receipt-");
    expect(confirmed.timestamp).toBeGreaterThan(0);
    receipts.record({
      appId: "food",
      label: "Order a test sushi",
      tier: "consequential",
      status: "declined",
    });
    const [newest, previous] = receipts.getReceipts();
    expect(newest?.label).toBe("Order a test sushi");
    expect(newest?.status).toBe("declined");
    expect(previous?.label).toBe("Order a test ramen");
  });
});

describe("executor registry", () => {
  it("default executor receipts honestly and says it simulated", () => {
    const note = executeConfirmed({ appId: "flights", label: "Book a test flight" });
    expect(note).toBe(SIMULATED_NOTE);
    const newest = receipts.getReceipts()[0];
    expect(newest?.label).toBe("Book a test flight");
    expect(newest?.status).toBe("confirmed-simulated");
  });

  it("registerExecutor swaps the executor and returns the previous one", () => {
    const run = jest.fn(() => "real integration note");
    const prev = registerExecutor({ run });
    const note = executeConfirmed({ appId: "banking", label: "Pay a test bill" });
    expect(run).toHaveBeenCalledWith({ appId: "banking", label: "Pay a test bill" });
    expect(note).toBe("real integration note");
    // Restore the default simulated executor for other tests.
    expect(registerExecutor(prev)).toBeDefined();
  });
});

describe("no-prefetch invariant", () => {
  const app = {
    id: "food",
    name: "Food",
    emoji: "🍜",
    tile: ["#000", "#111"] as [string, string],
    request: "Open food",
  };

  it("speculative prefetch and plain resolveAction never run an executor", () => {
    const run = jest.fn();
    const prev = registerExecutor({ run });
    try {
      // A completed screen with a consequential action prefetches it
      // speculatively - generation must not fire any side effect.
      const parentId = openApp(app);
      screenStore.patch(parentId, {
        status: "done",
        content: 'b = Button("Order", Action([@ToAssistant("Order the pad thai")]))',
      });
      setActiveScreen(parentId);
      const prefetched = streamCalls.length;
      expect(prefetched).toBeGreaterThan(0);

      // Even resolving the action (what a tap does pre-confirmation) only
      // generates the next screen - the executor is a post-confirmation seam.
      resolveAction(parentId, "Order the pad thai");
      expect(run).not.toHaveBeenCalled();

      // Only an explicit confirmation runs it.
      executeConfirmed({ appId: "food", label: "Order the pad thai" });
      expect(run).toHaveBeenCalledTimes(1);
    } finally {
      registerExecutor(prev);
    }
  });
});
