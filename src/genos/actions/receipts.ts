/**
 * Receipt log: every confirmed or declined consequential action leaves a
 * durable, honest record. Receipts say "simulated" because nothing real is
 * wired up yet - the log exists so the UI never lies about what happened,
 * and so a future rollback/history surface has the trail it needs. Shape
 * mirrors config.ts's KeyStore, so the shell can subscribe via
 * useSyncExternalStore.
 */
import type { ActionTier } from "./model";

export type ReceiptStatus = "confirmed-simulated" | "declined";

export interface Receipt {
  id: string;
  appId: string;
  /** The action message exactly as the user saw and confirmed/declined it. */
  label: string;
  tier: ActionTier;
  status: ReceiptStatus;
  timestamp: number;
}

/** Honest one-liner the simulated executor returns for the receipt toast. */
export const SIMULATED_NOTE = "Simulated - no real order was placed";

let counter = 0;

class ReceiptStore {
  private log: Receipt[] = [];
  private listeners = new Set<() => void>();

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  /** Newest first - the read shape a receipts surface would render. */
  getReceipts = (): Receipt[] => this.log;

  /** Append a receipt and notify subscribers. */
  record(entry: Omit<Receipt, "id" | "timestamp">): Receipt {
    const receipt: Receipt = {
      ...entry,
      id: `receipt-${Date.now()}-${++counter}`,
      timestamp: Date.now(),
    };
    this.log = [receipt, ...this.log];
    this.listeners.forEach((fn) => fn());
    return receipt;
  }
}

export const receipts = new ReceiptStore();
