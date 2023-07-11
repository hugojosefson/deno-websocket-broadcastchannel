import { defaultWebSocketUrl } from "./default-websocket-url.ts";
import { BroadcastChannelIsh } from "./types.ts";
import { Manager } from "./manager.ts";

const manager: Manager = new Manager();
export function createBroadcastChannel(
  name: string,
  url: string | URL = defaultWebSocketUrl(),
): BroadcastChannelIsh {
  return manager.createBroadcastChannel(name, url);
}
