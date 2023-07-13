// noinspection JSAnnotator,ES6ConvertVarToLetConst

/**
 * @module polyfill
 *
 * This module polyfills the {@link BroadcastChannel} API, where not available.
 *
 * If `BroadcastChannel` is already available, such as on Deno Deploy, this has no effect.
 */

import {
  BroadcastChannelIsh,
  polyfillBroadcastChannel,
  WebSocketBroadcastChannel,
} from "./mod.ts";

declare global {
  // deno-lint-ignore ban-ts-comment
  // @ts-ignore
  // deno-lint-ignore no-var
  var BroadcastChannel = WebSocketBroadcastChannel;
  type BroadcastChannel = BroadcastChannelIsh;
}

polyfillBroadcastChannel();
