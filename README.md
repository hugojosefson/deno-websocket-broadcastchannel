# WebSocket BroadcastChannel

An implementation of
[BroadcastChannel](https://developer.mozilla.org/docs/Web/API/BroadcastChannel)
for Deno CLI, that uses
[WebSocket](https://developer.mozilla.org/docs/Web/API/WebSocket)s to
communicate between processes on the same host.

[![deno.land/x/websocket_broadcastchannel](https://shield.deno.dev/x/websocket_broadcastchannel)](https://deno.land/x/websocket_broadcastchannel)
[![CI](https://github.com/hugojosefson/deno-websocket-broadcastchannel/actions/workflows/ci.yaml/badge.svg)](https://github.com/hugojosefson/deno-websocket-broadcastchannel/actions/workflows/ci.yaml)

While
[BroadcastChannel is already supported in Deno Deploy](https://deno.com/deploy/docs/runtime-broadcast-channel)...

If you want to test your code locally, this module with a WebSocket-backed
BroadcastChannel, will let you do so.

(At least until Deno will
[Support cross process BroadcastChannel #10750](https://github.com/denoland/deno/issues/10750)
in the `deno` CLI itself, which is planned, but blocked on
[an upstream issue](https://github.com/tokio-rs/mio/pull/1667).)

## Requirements

Requires a recent version of [Deno](https://deno.land/).

## API

For details on BroadcastChannel, please see:

- MDN's API documentation at
  [developer.mozilla.org/docs/Web/API/BroadcastChannel](https://developer.mozilla.org/docs/Web/API/BroadcastChannel).
- Deno Deploy's documentation at
  [deno.com/deploy/docs/runtime-broadcast-channel](https://deno.com/deploy/docs/runtime-broadcast-channel).

For specifics on what this module `export`s, see the auto-generated API docs at
[deno.land/x/websocket_broadcastchannel?doc](https://deno.land/x/websocket_broadcastchannel?doc).

## Example usage

### With BroadcastChannel polyfill

The easiest way to use this module, is to use the included polyfill.

Import it as early as possible in your code, before any other imports that may
use `BroadcastChannel`.

```typescript
import "https://deno.land/x/websocket_broadcastchannel/polyfill.ts";

const channel = new BroadcastChannel("my-channel");
// Now use the channel as usual.
```

The polyfill does nothing if `BroadcastChannel` is already defined (on Deno
Deploy), and otherwise defines a global `BroadcastChannel` to use this module's
implementation.

### Without polyfill

For finer control, you may use the `createBroadcastChannel(name)` function,
instead of `new BroadcastChannel(name)` via the polyfill.

Calling the `createBroadcastChannel(name)` function will either:

- return a `BroadcastChannel` object if available (when running in Deno Deploy),
  or
- return a `WebSocketBroadcastChannel` object (when running in Deno CLI).

```typescript
import { createBroadcastChannel } from "https://deno.land/x/websocket_broadcastchannel/mod.ts";

const channel = createBroadcastChannel("my-channel");
// Now use the channel as usual.
```

### Simple broadcast between processes

A small example, that you can run in several terminals on the same host, and see
messages broadcast between them.

This uses the polyfill, so the code can use the `BroadcastChannel` API as usual.

```typescript
import "https://deno.land/x/websocket_broadcastchannel/polyfill.ts";

const pid = Deno.pid;
const pidLastDigit = pid % 10;
const delay = (pidLastDigit || 10) * 1000;

const log = (s: string, ...args: unknown[]) => {
  console.log(`[broadcast.ts#${pid}] ${s}`, ...args);
};

log("run this in multiple terminals on the same host, to see it work");

log("starting...");
const testChannel = new BroadcastChannel("test");
log("testChannel.constructor.name", testChannel.constructor.name);

testChannel.onmessage = (event: Event) => {
  log("onmessage event.data =", (event as MessageEvent).data);
};

testChannel.onmessageerror = (event: Event) => {
  log("onmessageerror event =", event);
};

setInterval(() => {
  log("posting...");
  testChannel.postMessage(`hello from ${pid}`);
  log("posted");
  log(`waiting ${delay / 1000}s...`);
}, delay);
```

To run the above example:

```sh
deno run    \
  --reload   \
  --allow-net \
  https://deno.land/x/websocket_broadcastchannel/examples/broadcast.ts
```

### Server example from Deno Deploy docs

This is the example from Deno Deploy's documentation page for BroadcastChannel,
but now with the addition of this module's polyfill.

Original:

https://deno.com/deploy/docs/runtime-broadcast-channel#example

Adapted to use this module:

```typescript
import "https://deno.land/x/websocket_broadcastchannel/polyfill.ts";
import { serve } from "https://deno.land/std@0.194.0/http/server.ts";

const messages: string[] = [];
// Create a new broadcast channel named earth.
const channel = new BroadcastChannel("earth");
// Set onmessage event handler.
channel.onmessage = (event: Event) => {
  // Update the local state when other instances
  // send us a new message.
  messages.push((event as MessageEvent).data);
};

function handler(req: Request): Response {
  const { pathname, searchParams } = new URL(req.url);

  // Handle /send?message=<message> endpoint.
  if (pathname.startsWith("/send")) {
    const message = searchParams.get("message");
    if (!message) {
      return new Response("?message not provided", { status: 400 });
    }

    // Update local state.
    messages.push(message);
    // Inform all other active instances of the deployment
    // about the new message.
    channel.postMessage(message);
    return new Response("message sent");
  }

  // Handle /messages request.
  if (pathname.startsWith("/messages")) {
    return new Response(
      JSON.stringify(messages),
      {
        headers: { "content-type": "application/json" },
      },
    );
  }

  return new Response("not found", { status: 404 });
}

serve(handler, { port: parseInt(Deno.env.get("PORT") ?? "8080", 10) });
```

### Chat application

An example chat application, that you can run in several terminals on the same
host, and see the messages broadcast between them.

This also uses the polyfill, so the code can use the `BroadcastChannel` API as
usual.

```typescript
import "https://deno.land/x/websocket_broadcastchannel/polyfill.ts";
import {
  Logger,
  logger,
  WebSocketBroadcastChannel,
} from "https://deno.land/x/websocket_broadcastchannel/mod.ts";

const log: Logger = logger(import.meta.url);

/**
 * The application's main entry point.
 */
async function main() {
  log("Starting...");
  const chat: BroadcastChannel = new BroadcastChannel("chat");

  chat.onmessage;
  if (chat instanceof WebSocketBroadcastChannel) {
    console.error(`
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
    console.error(`
===============================================================================
Running on Deno Deploy. Application-wide BroadcastChannel is fully supported,
so you don't need WebSocketBroadcastChannel!

(However, it makes little sense to read from stdin on Deno Deploy, so this
example CLI-based chat app is only useful on Deno Deploy, for seeing this
detection in your logs :)
===============================================================================
`);
  }

  chat.addEventListener("message", handleIncoming);

  try {
    log("continuously reading from stdin");
    const decoder = new TextDecoder();
    for await (const chunk of Deno.stdin.readable) {
      const text = decoder.decode(chunk).trimEnd();
      log("stdin text =", text);
      chat.postMessage(text);
    }

    log("stdin closed, closing chat");
  } finally {
    chat.removeEventListener("message", handleIncoming);
    chat.close();
  }

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
deno run    \
  --reload   \
  --allow-net \
  https://deno.land/x/websocket_broadcastchannel/examples/chat.ts
```

If you want to see all the debug output:

```sh
DEBUG='*'       \
deno run         \
  --reload        \
  --allow-net      \
  --allow-env=DEBUG \
  https://deno.land/x/websocket_broadcastchannel/examples/chat.ts
```
