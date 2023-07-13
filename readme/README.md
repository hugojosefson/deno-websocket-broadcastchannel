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
"@@include(../examples/polyfill.ts)";
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
"@@include(../examples/create-channel.ts)";
```

### Simple broadcast between processes

A small example, that you can run in several terminals on the same host, and see
messages broadcast between them.

This uses the polyfill, so the code can use the `BroadcastChannel` API as usual.

```typescript
"@@include(../examples/broadcast.ts)";
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
"@@include(../examples/server-example.ts)";
```

### Chat application

An example chat application, that you can run in several terminals on the same
host, and see the messages broadcast between them.

This also uses the polyfill, so the code can use the `BroadcastChannel` API as
usual.

```typescript
"@@include(../examples/chat.ts)";
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
