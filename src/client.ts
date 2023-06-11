import { BeingResult, ListenOptions, OnMessage } from "./types.ts";
import { Logger, logger } from "./log.ts";

const log0: Logger = logger(import.meta.url);

export async function beClient<T>(
  options: ListenOptions,
  onmessage: OnMessage<T>,
  messageGenerator: EventTarget,
  abortSignal: AbortSignal,
): Promise<BeingResult> {
  const log1: Logger = log0.sub(beClient.name);
  const socket: WebSocket = await connectToWebSocket(options);
  function messageListener(e: MessageEvent) {
    log1.sub("messageListener")("you typed:", e.data);
    socket.send(e.data);
  }
  function socketCloser() {
    log1.sub("socketCloser")("closing socket...");
    socket.close();
  }
  abortSignal.addEventListener("abort", socketCloser);
  socket.addEventListener("open", () => {
    log1.sub("socket.onopen")("socket is open.");
    messageGenerator.addEventListener("message", messageListener);
  });
  socket.addEventListener("message", (e: MessageEvent) => {
    log1.sub("socket.onmessage")("server says:", e.data);
    onmessage(e.data);
  });
  return new Promise((resolve, reject) => {
    socket.addEventListener("close", () => {
      const log = log1.sub("onclose");
      messageGenerator.removeEventListener("message", messageListener);
      const result: BeingResult = abortSignal.aborted ? "stop" : "try_next";
      log(result);
      resolve(result);
    });
    socket.addEventListener("error", (e: Event) => {
      const log = log1.sub("onerror");
      if (e instanceof ErrorEvent && e?.message === "unexpected eof") {
        log("webSocket lost connection to server.");
      } else {
        log("Unexpected error from webSocket:", e);
        reject(e);
      }
      messageGenerator.removeEventListener("message", messageListener);
      const result: BeingResult = abortSignal.aborted ? "stop" : "try_next";
      log(result);
      resolve(result);
    });
  });
}

/**
 * Alternates between attempting to connect to a WebSocket server hosted by another process, and being a WebSocket server.
 */
export async function connectToWebSocket(
  options: ListenOptions,
): Promise<WebSocket> {
  const { hostname, port } = options;
  const url = `ws://${hostname}:${port}`;
  return new WebSocket(url);
}
