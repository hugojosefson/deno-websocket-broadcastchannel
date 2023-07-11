import { defaultWebSocketUrl } from "./default-websocket-url.ts";
import {
  BroadcastChannelIsh,
  GlobalThisWithBroadcastChannel,
} from "./types.ts";
import { Logger, logger } from "./log.ts";
import { equals } from "./fn.ts";
import { WebSocketBroadcastChannel } from "./web-socket-broadcast-channel.ts";

const log0: Logger = logger(import.meta.url);

/**
 * Creates a {@link BroadcastChannel} or {@link WebSocketBroadcastChannel}, depending on
 * whether we are running on Deno Deploy or not.
 * @param name The name of the channel.
 * @param url WebSocket url to connect to or listen as, if not on Deno Deploy. Defaults to {@link defaultWebSocketUrl}() if not specified.
 */
export function createBroadcastChannel(
  name: string,
  url: string | URL = defaultWebSocketUrl(),
): BroadcastChannelIsh {
  const log = log0.sub(createBroadcastChannel.name);
  if ("BroadcastChannel" in globalThis) {
    const g = globalThis as GlobalThisWithBroadcastChannel;
    // Only use the native BroadcastChannel if it's not the same as our own.
    // Otherwise, fall through to instantiate a WebSocketBroadcastChannel.
    if (!equals({ a: g.BroadcastChannel, b: WebSocketBroadcastChannel })) {
      log("BroadcastChannel in globalThis; using it...");
      return new g.BroadcastChannel(name) as BroadcastChannelIsh;
    }
    log(
      "BroadcastChannel in globalThis; but it's our own; so using it with the url argument...",
    );
  } else {
    log(
      "BroadcastChannel not in globalThis; using WebSocketBroadcastChannel...",
    );
  }

  // Instantiate a WebSocketBroadcastChannel.
  return new WebSocketBroadcastChannel(name, url);
}
