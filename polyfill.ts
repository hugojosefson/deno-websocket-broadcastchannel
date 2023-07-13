import { polyfillBroadcastChannel, WebSocketBroadcastChannel } from "./mod.ts";

/**
 * @module polyfill
 *
 * This module polyfills the {@link BroadcastChannel} API, where not available.
 *
 * If already available, such as on Deno Deploy, it does nothing.
 */

declare global {
  // deno-lint-ignore ban-ts-comment
  // @ts-ignore
  // deno-lint-ignore no-var
  var BroadcastChannel = WebSocketBroadcastChannel;
}

polyfillBroadcastChannel();
