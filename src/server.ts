import { BeingResult, ListenOptions, OnMessage } from "./types.ts";
import { Logger, logger } from "./log.ts";

const log0: Logger = logger(import.meta.url);

export async function beServer(
  options: ListenOptions,
  onmessage: OnMessage<T>,
  messageGenerator: EventTarget,
  abortSignal: AbortSignal,
): Promise<BeingResult> {
  const log: Logger = log0.sub(beServer.name);
  const { hostname, port } = options;
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
      void handleHttp(conn, onmessage, messageGenerator, abortSignal);
    }
  } catch (e) {
    if (e.code === "EADDRINUSE") {
      log(
        "Can't server, because address in use. Try being something else instead...",
      );
      return "try_next";
    } else {
      log("Unexpected error:", e);
      throw e;
    }
  } finally {
    log(`No longer the server at ${hostname}:${port}.`);
    abortSignal.removeEventListener("abort", listenerCloser);
  }
  return "retry";
}

async function handleHttp<T>(
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

      function socketCloser() {
        socket.close();
      }
      function messageListener(e: MessageEvent) {
        socket.send(e.data);
      }

      socket.onopen = () => {
        socket.send(`Hello from ${Deno.pid}.`);
        abortSignal.addEventListener("abort", socketCloser);
        messageGenerator.addEventListener("message", messageListener);
      };
      socket.onmessage = (e: MessageEvent) => {
        log.sub("onmessage")(e.data);
        onmessage(e.data);
      };
      socket.onclose = () => {
        log.sub("onclose")("");
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
