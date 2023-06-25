/**
 * What BroadcastChannel (if available) looks like, and what WebSocketBroadcastChannel implements.
 */
export interface BroadcastChannelIsh extends EventTarget {
  readonly name: string;
  postMessage(message: unknown): void;
  close(): void;
}

/**
 * The constructor for BroadcastChannel (if available).
 */
export interface BroadcastChannelConstructor {
  new (name: string): BroadcastChannelIsh;
}

/**
 * What globalThis looks like when it has BroadcastChannel.
 */
export type GlobalThisWithBroadcastChannel = typeof globalThis & {
  BroadcastChannel: BroadcastChannelConstructor;
};
