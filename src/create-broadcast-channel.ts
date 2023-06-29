import { isDenoDeploy } from "./fn.ts";
import { WebSocketBroadcastChannel } from "./web-socket-broadcast-channel.ts";
import {
  BroadcastChannelIsh,
  GlobalThisWithBroadcastChannel,
} from "./types.ts";

/**
 * Creates a {@link BroadcastChannel} or {@link WebSocketBroadcastChannel}, depending on
 * whether we are running on Deno Deploy or not.
 * @param name The name of the channel.
 */
export async function createBroadcastChannel(
  name: string,
): Promise<BroadcastChannelIsh> {
  if (await isDenoDeploy()) {
    const g = globalThis as GlobalThisWithBroadcastChannel;
    return new g.BroadcastChannel(name) as BroadcastChannelIsh;
  }

  return new WebSocketBroadcastChannel(name);
}
