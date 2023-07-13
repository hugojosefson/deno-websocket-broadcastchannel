# WebSocket BroadcastChannel

An implementation of
[BroadcastChannel](https://developer.mozilla.org/docs/Web/API/BroadcastChannel)
for Deno, that uses
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
in the `deno` CLI itself.)

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

Instead of using the built-in `BroadcastChannel` constructor, use this module's
`createBroadcastChannel(name)` function.

It will either:

- return a `BroadcastChannel` object if available (when running in Deno Deploy),
  or
- return a `WebSocketBroadcastChannel` object (when running in Deno CLI).

```typescript
"@@include(../examples/create-channel.ts)";
```

### Simple broadcast between processes

A small example, that you can run in several terminals on the same host, and see
messages broadcast between them.

This uses this module's
[createBroadcastChannel(name)](https://deno.land/x/websocket_broadcastchannel/mod.ts?s=createBroadcastChannel)
function to create the relevant `BroadcastChannel` object, and then uses the
`BroadcastChannel` API as usual.

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
but now using this module's `await createBroadcastChannel(name)` instead of the
built-in `new BroadcastChannel(name)`.

Original:

https://deno.com/deploy/docs/runtime-broadcast-channel#example

Adapted to use this module:

```typescript
"@@include(../examples/server-example.ts)";
```

### Chat application

An example chat application, that you can run in several terminals on the same
host, and see the messages broadcast between them.

This uses the
[createBroadcastChannel](https://deno.land/x/websocket_broadcastchannel/mod.ts?s=createBroadcastChannel)
function to create the relevant `BroadcastChannel` object, and then uses the
`BroadcastChannel` API as usual.

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
