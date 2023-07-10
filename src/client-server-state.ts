#!/usr/bin/env -S deno run --watch --allow-write=./src/client-server-state.puml
import { WebSocketClientServer } from "./web-socket-client-server.ts";
import { defaultWebSocketUrl } from "./default-websocket-url.ts";

if (import.meta.main) {
  const sm = new WebSocketClientServer(defaultWebSocketUrl())
    .createClientServerStateMachine();
  await Deno.writeTextFile(
    new URL("./client-server-state.puml", import.meta.url).pathname,
    sm.toPlantUml(
      `${WebSocketClientServer.name}\nState Machine`,
      false,
    ),
  );
}
