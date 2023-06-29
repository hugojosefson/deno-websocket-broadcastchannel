import { isDenoDeploy } from "./fn.ts";
import { WebSocketBroadcastChannel } from "./web-socket-broadcast-channel.ts";
import {
  BroadcastChannelIsh,
  GlobalThisWithBroadcastChannel,
} from "./types.ts";
import { defaultWebSocketUrl } from "./default-websocket-url.ts";

/**
 * Creates a {@link BroadcastChannel} or {@link WebSocketBroadcastChannel}, depending on
 * whether we are running on Deno Deploy or not.
 * @param name The name of the channel.
 * @param url WebSocket url to connect to or listen as, if not on Deno Deploy. Defaults to {@link defaultWebSocketUrl}() if not specified.
 */
export async function createBroadcastChannel(
  name: string,
  url: string | URL = defaultWebSocketUrl(),
): Promise<BroadcastChannelIsh> {
  if (await isDenoDeploy()) {
    const g = globalThis as GlobalThisWithBroadcastChannel;
    return new g.BroadcastChannel(name) as BroadcastChannelIsh;
  }

  return new WebSocketBroadcastChannel(name, url);
}
