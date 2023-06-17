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

## Events

Shows the components of this implementation, the events that are emitted, and
where they go.

### Components

- `WebSocketBroadcastChannel` is the main class, that you use to create a
  channel.
- `Server` is a `Connector` that attempts to listen for incoming WebSocket
  connections from `Client`s.
- `Client` is a `Connector` that attempts to connect to the `Server`.
- `LoopingConnector` is a `Connector` that attempts to use a `Server` and
  `Client` to get connected, and keeps trying until it succeeds, alternating
  between trying to be a `Server` and a `Client`.

### Events

#### `Connector`

- `connecting` is emitted when a `Connector` is attempting to establish a
  connection.
- `connected` is emitted when a `Connector` has established a connection.
- `disconnected` is emitted when a `Connector` has lost its connection.
- `message` is emitted when a `Connector` has received a message.
- `error` is emitted when a `Connector` has encountered an error.
- `closed` is emitted when a `Connector` has closed.

```plantuml
@startuml
!includeurl https://gist.githubusercontent.com/fishey2/7178a88643a8850908c799be1ec68fd6/raw/4335aef48010a7597f14724597d8f391c4ab9c70/example_sequence_stylesheet.iuml


title "Events emitted among components"

component "LoopingConnector" as looper {
  component "Client" as client {
    component "WebSocket" as client_ws
  }
  component "Server" as server {
    component "WebSocket" as server_ws
  }
}
component "CLI" as cli
component "Deno.stdin" as stdin
component "Deno.stdout" as stdout

stdin --> cli : data
cli --> looper : outgoing
looper --> cli : incoming
cli --> stdout : data

looper --> server : outgoing
looper --> client : outgoing
server --> looper : incoming
client --> looper : incoming

client_ws --> client : open
client_ws --> client : close
client_ws --> client : message
client_ws --> client : error

server_ws --> server : open
server_ws --> server : close
server_ws --> server : message
server_ws --> server : error

@enduml
```
