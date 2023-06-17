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

```plantuml
@startuml
!includeurl https://gist.githubusercontent.com/fishey2/7178a88643a8850908c799be1ec68fd6/raw/4335aef48010a7597f14724597d8f391c4ab9c70/example_sequence_stylesheet.iuml


title "<color:#1F648E>Events emitted<color:black> from, and <color:#DD00AA>functionsCalled()<color:black> on, components"

package "Deno" {
  component ".stdin" as stdin
  component ".stdout" as stdout
}

component "CLI" as cli

package "web-socket-broadcast-channel.ts" as mod {

  getConnector -[#DD00AA]-> ensureConnector

  ensureConnector -[#DD00AA]-> looper : <color:#DD00AA>run()

  unregister -[#DD00AA]-> looper : <color:#DD00AA>close()

  component "connector = LoopingConnector" as looper {
    package "Connector" as connector {
      component "Client" as client {
      }
      component "Server" as server {
      }
      collections "WebSocket" as ws
    }
  }
  node "channelSets: Map<name, Set<WebSocketBroadcastChannel>>" as channelSets {
    collections "WebSocketBroadcastChannel" as wsbc
    wsbc -[#DD00AA]-> getConnector : <color:#DD00AA>getConnector()
    wsbc -[#DD00AA]-> unregister : <color:#DD00AA>unregister()
  }

}



stdin -down-> cli : chunk {msg}
stdin -[hidden]right-> stdout
cli -[#DD00AA]up-> stdout : <color:#DD00AA>console.log(msg)


cli -[#DD00AA]down-> wsbc : <color:#DD00AA>new WSBC(name)
wsbc -up-> cli : open
cli -[#DD00AA]down-> wsbc : <color:#DD00AA>postMessage(msg)
wsbc -up-> cli : message {msg}
cli -[#DD00AA]down-> wsbc : <color:#DD00AA>close()
wsbc -up-> cli : close
wsbc -up-> cli : error

wsbc -[#DD00AA]down-> looper : <color:#DD00AA>run()
looper -up-> wsbc : open
wsbc -[#DD00AA]down-> looper : <color:#DD00AA>postMessage(name+msg)
looper -up-> wsbc : message {name,msg}
wsbc -[#DD00AA]down-> looper : <color:#DD00AA>close()
looper -up-> wsbc : close
looper -up-> wsbc : error

connector -up-> looper : open
looper -[#DD00AA]down-> connector : <color:#DD00AA>postMessage(name+msg)
connector -up-> looper : message {name,msg}
connector -up-> looper : close
connector -up-> looper : error

ws -up-> connector : open
connector -[#DD00AA]down-> ws : <color:#DD00AA>postMessage(name+msg)
ws -up-> connector : message {name,msg}
connector -[#DD00AA]down-> ws : <color:#DD00AA>close()
ws -up-> connector : close
ws -up-> connector : error


@enduml
```
