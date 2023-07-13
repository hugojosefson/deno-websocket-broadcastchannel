import { GlobalThisWithBroadcastChannel } from "./types.ts";
import { WebSocketBroadcastChannel } from "./web-socket-broadcast-channel.ts";

/**
 * Polyfills the `globalThis` with a {@link BroadcastChannel} implementation, if one is not already present.
 * @param g The `globalThis` to polyfill. Defaults to the `globalThis` in the current context.
 * @returns The `globalThis` that was passed in, type-cast so TypeScript can see it has "BroadcastChannel".
 */
export function polyfillBroadcastChannel(
  g = globalThis,
): GlobalThisWithBroadcastChannel {
  if ("BroadcastChannel" in g) {
    return g as GlobalThisWithBroadcastChannel;
  }
  Object.assign(g, { BroadcastChannel: WebSocketBroadcastChannel });
  return g as GlobalThisWithBroadcastChannel;
}
