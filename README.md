# WebSocket BroadcastChannel

An implementation of
[BroadcastChannel](https://developer.mozilla.org/docs/Web/API/BroadcastChannel)
for Deno, that uses
[WebSocket](https://developer.mozilla.org/docs/Web/API/WebSocket)s to
communicate between processes on the same host.

[![deno.land/x/websocket-broadcastchannel](https://shield.deno.dev/x/websocket-broadcastchannel)](https://deno.land/x/websocket-broadcastchannel)
[![CI](https://github.com/hugojosefson/deno-websocket-broadcastchannel/actions/workflows/ci.yaml/badge.svg)](https://github.com/hugojosefson/deno-websocket-broadcastchannel/actions/workflows/ci.yaml)

While
[BroadcastChannel is already supported in Deno Deploy](https://deno.com/deploy/docs/runtime-broadcast-channel),
if you want to test your code locally, this module with a WebSocket-backed
BroadcastChannel may be useful. At least until Deno will
[Support cross process BroadcastChannel #10750](https://github.com/denoland/deno/issues/10750)
in the `deno` CLI.

## Requirements

Requires a recent version of [Deno](https://deno.land/).

## API

Please see the
[auto-generated API documentation](https://deno.land/x/websocket-broadcastchannel?doc).

## Example usage

An example chat application, where each client is a separate process, and the
server is a separate process:

```typescript
import {
  BroadcastChannelIsh,
  createBroadcastChannel,
  Logger,
  logger,
  WebSocketBroadcastChannel,
} from "https://deno.land/x/websocket-broadcastchannel/mod.ts";
const log: Logger = logger(import.meta.url);

/**
 * The application's main entry point.
 */
async function main() {
  log("Starting...");
  const chat: BroadcastChannelIsh = await createBroadcastChannel("chat");

  if (chat instanceof WebSocketBroadcastChannel) {
    console.log(`
===============================================================================
Welcome to the chat example of WebSocketBroadcastChannel!

You are not running on Deno Deploy. This means that you are not guaranteed to
have application-wide BroadcastChannel available. This example uses a WebSocket
to provide a host-wide one.

Do start several processes of this example in different terminals on the same
computer. Then type messages in one, and see them appear in them all.

To exit a process, press ctrl-d on a separate line. Remaining processes will
continue to run. If you exit the one that happened to act as server, one of
the others will take over that duty, and the rest will reconnect to it.
-------------------------------------------------------------------------------
    `.trim());
  } else {
    console.log(`
===============================================================================
Running on Deno Deploy. Application-wide BroadcastChannel is fully supported,
so you don't need WebSocketBroadcastChannel!

(It makes little sense to use stdin on Deno Deploy, so this example is only
useful on Deno Deploy, for seeing this detection in your logs :)
===============================================================================
`);
  }

  chat.addEventListener("message", handleIncoming);

  log("continuously reading from stdin");
  const decoder = new TextDecoder();
  for await (const chunk of Deno.stdin.readable) {
    const text = decoder.decode(chunk).trimEnd();
    log("stdin text =", text);
    chat.postMessage(text);
  }

  log("stdin closed, closing chat");
  chat.removeEventListener("message", handleIncoming);
  chat.close();

  log("Done.");
}

/**
 * Prints an incoming chat message to stdout.
 * @param event
 */
function handleIncoming(event: Event): void {
  if (!(event instanceof MessageEvent)) {
    log.sub(handleIncoming.name)("not a MessageEvent");
    return;
  }

  console.log(event.data);
}

if (import.meta.main) {
  await main();
}
```

To run the above example:

```sh
deno run --reload --allow-net https://deno.land/x/websocket-broadcastchannel/readme/chat.ts
```

If you want to see all the debug output:

```sh
DEBUG='*' deno run --allow-env=DEBUG --reload --allow-net https://deno.land/x/websocket-broadcastchannel/readme/chat.ts
```
