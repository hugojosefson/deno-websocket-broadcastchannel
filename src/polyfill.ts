import { WebSocketBroadcastChannel } from "./web-socket-broadcast-channel.ts";

import { GlobalThisWithBroadcastChannel } from "./types.ts";

/**
 * Polyfills BroadcastChannel with WebSocketBroadcastChannel.
 * @param force If true, polyfills even if BroadcastChannel is available.
 * @returns A function that, when called, undoes the polyfill.
 */
export function polyfillBroadcastChannel(
  force = false,
): () => void {
  const g = globalThis as Partial<GlobalThisWithBroadcastChannel>;

  if (force) {
    return actuallyPolyfill(g);
  }

  if (haveBroadcastChannel(g)) {
    return () => {};
  }

  return actuallyPolyfill(g);
}

/**
 * Returns true if the global object has BroadcastChannel.
 * @param g The global object.
 */
function haveBroadcastChannel(
  g: Partial<GlobalThisWithBroadcastChannel>,
): g is GlobalThisWithBroadcastChannel {
  return typeof g.BroadcastChannel === "function";
}

/**
 * Polyfills BroadcastChannel with WebSocketBroadcastChannel.
 * @param g The global object.
 */
function actuallyPolyfill(
  g: Partial<GlobalThisWithBroadcastChannel>,
): () => void {
  const oldBroadcastChannel = g.BroadcastChannel;
  Object.assign(g, { BroadcastChannel: WebSocketBroadcastChannel });
  return () => {
    Object.assign(g, { BroadcastChannel: oldBroadcastChannel });
  };
}
