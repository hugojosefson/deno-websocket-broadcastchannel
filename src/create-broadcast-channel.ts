import { isDenoDeploy } from "./fn.ts";
import { WebSocketBroadcastChannel } from "./web-socket-broadcast-channel.ts";
import {
  BroadcastChannelIsh,
  GlobalThisWithBroadcastChannelIsh,
} from "./types.ts";

/**
 * Creates a BroadcastChannel or WebSocketBroadcastChannel, depending on
 * whether we are running on Deno Deploy or not.
 * @param name The name of the channel.
 */
export async function createBroadcastChannel(
  name: string,
): Promise<BroadcastChannelIsh> {
  if (await isDenoDeploy()) {
    const g = globalThis as GlobalThisWithBroadcastChannelIsh;
    return new g.BroadcastChannel(name);
  }

  return new WebSocketBroadcastChannel(name);
}
