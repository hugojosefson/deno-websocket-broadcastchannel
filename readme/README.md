# WebSocket BroadcastChannel

An implementation of
[BroadcastChannel](https://developer.mozilla.org/docs/Web/API/BroadcastChannel)
for Deno, that uses
[WebSocket](https://developer.mozilla.org/docs/Web/API/WebSocket)s to
communicate between processes on the same host.

[![deno.land/x/websocket_broadcastchannel](https://shield.deno.dev/x/websocket_broadcastchannel)](https://deno.land/x/websocket_broadcastchannel)
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

Please see MDN's documentation of the
[BroadcastChannel API](https://developer.mozilla.org/docs/Web/API/BroadcastChannel).

For specifics on what's `export`ed from this module, see our
[auto-generated API documentation](https://deno.land/x/websocket_broadcastchannel?doc).

## Example usage

An example chat application, that you can run in several terminals on the same
host, and see the messages broadcast between them.

This uses the
[createBroadcastChannel](https://deno.land/x/websocket_broadcastchannel/mod.ts?s=createBroadcastChannel)
function to create the relevant `BroadcastChannel` object, and then uses the
`BroadcastChannel` API as usual.

```typescript
"@@include(./chat.ts)";
```

To run the above example:

```sh
deno run --reload --allow-net https://deno.land/x/websocket_broadcastchannel/readme/chat.ts
```

If you want to see all the debug output:

```sh
DEBUG='*' deno run --allow-env=DEBUG --reload --allow-net https://deno.land/x/websocket_broadcastchannel/readme/chat.ts
```
