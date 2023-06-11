import { BeingResult, ListenOptions, OnMessage } from "./types.ts";
import { Logger, logger } from "./log.ts";

const log0: Logger = logger(import.meta.url);

export async function beServer(
  options: ListenOptions,
  onmessage: OnMessage<T>,
): Promise<BeingResult> {
  const log: Logger = log0.sub(beServer.name);
  const { hostname, port } = options;
  log(`Becoming the server at ${hostname}:${port}...`);

  try {
    const listener: Deno.Listener = Deno.listen({ port, hostname });
    log(`Became the server at ${hostname}:${port}.`);
    for await (const conn of listener) {
      void handleHttp(conn, onmessage);
    }
  } catch (e) {
    if (e.code === "EADDRINUSE") {
      log(
        "Can't server, because address in use. Try being something else instead...",
      );
      return { shouldTryNextBeing: true, shouldRetryMe: false };
    } else {
      log("Unexpected error:", e);
      throw e;
    }
  }
  return { shouldTryNextBeing: false, shouldRetryMe: true };
}

async function handleHttp<T>(conn: Deno.Conn, onmessage: OnMessage<T>) {
  const log: Logger = log0.sub(handleHttp.name);
  for await (const requestEvent of Deno.serveHttp(conn)) {
    if (requestEvent) {
      const { request } = requestEvent;
      const { socket, response } = Deno.upgradeWebSocket(request);
      socket.onopen = () => {
        socket.send(`Hello from ${Deno.pid}.`);
      };
      socket.onmessage = (e: MessageEvent) => {
        onmessage(e.data);
      };
      socket.onclose = () => log("WebSocket has been closed.");
      socket.onerror = (e) =>
        log(
          "WebSocket error:",
          e instanceof ErrorEvent ? e?.message ?? e : e,
        );
      await requestEvent.respondWith(response);
    }
  }
}
