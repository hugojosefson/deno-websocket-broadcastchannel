/**
 * What BroadcastChannel (if available) looks like, and what WebSocketBroadcastChannel implements.
 */
export interface BroadcastChannelIsh extends EventTarget {
  readonly name: string;

  postMessage(message: unknown): void;

  close(): void;
}

export type GlobalThisWithBroadcastChannelIsh = typeof globalThis & {
  BroadcastChannel: { new (name: string): BroadcastChannelIsh };
};
