import { ConnectorOptions, ConnectorResult, OnMessage } from "./types.ts";
import { Logger, logger } from "./log.ts";

const log0: Logger = logger(import.meta.url);

// TODO: server: keep track of all clients.
// TODO: server: re-send messages to all clients, except to the one that sent it.

export async function beServer<T>(
  options: ConnectorOptions,
  onmessage: OnMessage<T>,
  messageGenerator: EventTarget,
  abortSignal: AbortSignal,
): Promise<ConnectorResult> {
  const log: Logger = log0.sub(beServer.name);
  const { hostname, port } = options;
  const clients: WebSocket[] = [];
  log(`Becoming the server at ${hostname}:${port}...`);

  let listener: Deno.Listener | undefined = undefined;
  function listenerCloser() {
    listener?.close();
  }
  abortSignal.addEventListener("abort", listenerCloser);
  try {
    listener = Deno.listen({ port, hostname });
    log(`Became the server at ${hostname}:${port}.`);
    for await (const conn of listener) {
      void handleHttp(clients, conn, onmessage, messageGenerator, abortSignal);
    }
  } catch (e) {
    if (e.code === "EADDRINUSE") {
      log(
        "Can't server, because address in use. Try being something else instead...",
      );
      return abortSignal.aborted ? "stop" : "try_next";
    } else {
      log("Unexpected error:", e);
      throw e;
    }
  } finally {
    log(`No longer the server at ${hostname}:${port}.`);
    abortSignal.removeEventListener("abort", listenerCloser);
  }
  return abortSignal.aborted ? "stop" : "retry";
}

async function handleHttp<T>(
  clients: WebSocket[],
  conn: Deno.Conn,
  onmessage: OnMessage<T>,
  messageGenerator: EventTarget,
  abortSignal: AbortSignal,
) {
  const log1: Logger = log0.sub(handleHttp.name);
  for await (const requestEvent of Deno.serveHttp(conn)) {
    if (requestEvent) {
      const { request } = requestEvent;
      const { socket, response } = Deno.upgradeWebSocket(request);
      const log = log1.sub("webSocket");

      const socketCloser = () => {
        socket.close();
      };
      const messageListener = (e: Event) => {
        if (!(e instanceof MessageEvent)) {
          return;
        }
        socket.send(e.data);
      };

      socket.onopen = () => {
        log.sub("onopen")("socket is open.");
        clients.push(socket);
        socket.send(`Hello from ${Deno.pid}.`);
        abortSignal.addEventListener("abort", socketCloser);
        messageGenerator.addEventListener("message", messageListener);
      };
      socket.onmessage = (e: MessageEvent) => {
        log.sub("onmessage")(e.data);
        onmessage(e.data);
        clients.filter((client) => client !== socket).forEach((client) => {
          client.send(e.data);
        });
      };
      socket.onclose = () => {
        log.sub("onclose")("");
        clients.splice(clients.indexOf(socket), 1);
        messageGenerator.removeEventListener("message", messageListener);
        abortSignal.removeEventListener("abort", socketCloser);
      };
      socket.onerror = (e) => {
        log.sub("onerror")(
          ":",
          e instanceof ErrorEvent ? e?.message ?? e : e,
        );
      };
      await requestEvent.respondWith(response);
    }
  }
}
