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

```typescript
import {
  isDenoDeploy,
  logger,
} from "https://deno.land/x/websocket-broadcastchannel/mod.ts";
const log = logger(import.meta.url);

log("Starting...");

if (await isDenoDeploy()) {
  log("Running on Deno Deploy. BroadcastChannel is already fully supported.");
} else {
  log(
    "Not running on Deno Deploy. You MAY WANT to use this module for a host-wide BroadcastChannel via a WebSocket!",
  );
}

log("Done.");
```

You may run the above example with:

```sh
DEBUG='*' deno run --allow-env=DEBUG --reload --allow-net https://deno.land/x/websocket-broadcastchannel/readme/example-usage.ts
```

For further usage examples, see the tests:

- [test/websocket-broadcastchannel.test.ts](test/websocket-broadcastchannel.test.ts)
