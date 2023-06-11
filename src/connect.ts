import { Logger, logger } from "./log.ts";
const log0: Logger = logger(import.meta.url);

/**
 * Alternates between attempting to connect to a WebSocket server hosted by another process, and being a WebSocket server.
 */
export async function asClientConnectWebSocket(
  options: ListenOptions,
): Promise<WebSocket> {
  const { hostname, port } = options;
  const url = `ws://${hostname}:${port}`;
  const socket = new WebSocket(url);
  await new Promise((resolve) => {
    socket.onopen = resolve;
  });
  return socket;
}

export async function beClient(
  options: ListenOptions,
): Promise<void> {
  const log: Logger = log0.sub(beClient.name);
  const socket = await asClientConnectWebSocket(options);
  socket.onmessage = (e) => {
    log(e.data);
  };
  socket.onerror = (e: Event | ErrorEvent) => {
    if (e instanceof ErrorEvent) {
      log("error", e?.message ?? e);
    } else {
      log("error", e);
    }
  };
  await new Promise((resolve) => {
    socket.onclose = resolve;
  });
}

export async function beServer(
  options: ListenOptions,
): Promise<void> {
  const log: Logger = log0.sub(beServer.name);
  const { hostname, port } = options;
  log(`Becoming the server at ${hostname}:${port}...`);
  async function handleHttp(conn: Deno.Conn) {
    for await (const e of Deno.serveHttp(conn)) {
      if (e) {
        const { socket, response } = Deno.upgradeWebSocket(e.request);
        socket.onopen = () => {
          socket.send("Hello World!");
        };
        socket.onmessage = (e) => {
          log(e.data);
          socket.close();
        };
        socket.onclose = () => log("WebSocket has been closed.");
        socket.onerror = (e) =>
          log(
            "WebSocket error:",
            e instanceof ErrorEvent ? e?.message ?? e : e,
          );
        await e.respondWith(response);
      }
    }
  }

  const listener: Deno.Listener = Deno.listen({ port, hostname });
  log(`Became the server at ${hostname}:${port}.`);
  for await (const conn of listener) {
    void handleHttp(conn);
  }
}

export interface ListenOptions {
  hostname: string;
  port: number;
}
