// deno-lint-ignore no-unused-vars
import { WebSocketBroadcastChannel } from "./web-socket-broadcast-channel.ts";

/**
 * What {@link BroadcastChannel} (if available) looks like, and what {@link WebSocketBroadcastChannel} implements.
 */
export interface BroadcastChannelIsh extends EventTarget {
  readonly name: string;
  onmessage: ((ev: Event) => void) | null;
  onmessageerror: ((ev: Event) => void) | null;
  postMessage(message: unknown): void;
  close(): void;
}

/**
 * The constructor for {@link BroadcastChannel} (if available).
 */
export interface BroadcastChannelConstructor {
  new (name: string): BroadcastChannelIsh;
}

/**
 * What {@link https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/globalThis|globalThis}
 * looks like when it has {@link BroadcastChannel}.
 *
 * We use this to convince TypeScript that `globalThis.BroadcastChannel` exists, so typechecking passes. Then we use
 * runtime checks to ensure that it actually exists.
 */
export type GlobalThisWithBroadcastChannel = typeof globalThis & {
  BroadcastChannel: BroadcastChannelConstructor;
};
