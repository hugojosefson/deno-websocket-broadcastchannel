import { isDenoDeploy } from "./fn.ts";
import { WebSocketBroadcastChannel } from "./web-socket-broadcast-channel.ts";

import { GlobalThisWithBroadcastChannelIsh } from "./types.ts";

/**
 * Polyfills BroadcastChannel with WebSocketBroadcastChannel.
 * @param force If true, polyfills even if BroadcastChannel is available.
 * @returns A function that, when called, undoes the polyfill.
 */
export async function polyfillBroadcastChannel(
  force = false,
): Promise<() => void> {
  const g = globalThis as GlobalThisWithBroadcastChannelIsh;

  if (!force) {
    if (typeof g.BroadcastChannel === "function") {
      return () => {};
    }
    if (await isDenoDeploy()) {
      return () => {};
    }
  }

  const oldBroadcastChannel = g.BroadcastChannel;
  g.BroadcastChannel = WebSocketBroadcastChannel;
  return () => {
    g.BroadcastChannel = oldBroadcastChannel;
  };
}
