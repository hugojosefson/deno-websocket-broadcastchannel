import { BeingResult, ListenOptions, OnMessage } from "./types.ts";
import { Logger, logger } from "./log.ts";

const log0: Logger = logger(import.meta.url);

export async function beClient<T>(
  options: ListenOptions,
  onmessage: OnMessage<T>,
  messageGenerator: EventTarget,
): Promise<BeingResult> {
  const log1: Logger = log0.sub(beClient.name);
  const socket = await connectToWebSocket(options);
  function messageListener(e: MessageEvent) {
    socket.send(e.data);
  }
  socket.onopen = () => {
    messageGenerator.addEventListener("message", messageListener);
  };
  socket.onmessage = (e: MessageEvent) => {
    onmessage(e.data);
  };
  return new Promise((resolve, reject) => {
    socket.onclose = () => {
      const result: BeingResult = {
        shouldRetryMe: false,
        shouldTryNextBeing: true,
      };
      log1.sub("onclose")(result);
      messageGenerator.removeEventListener("message", messageListener);
      resolve(result);
    };
    socket.onerror = (e: Event) => {
      const log = log1.sub("onerror");
      if (e instanceof ErrorEvent && e?.message === "unexpected eof") {
        log("webSocket lost connection to server.");
      } else {
        log("Unexpected error from webSocket:", e);
        reject(e);
      }
      messageGenerator.removeEventListener("message", messageListener);
      const result: BeingResult = {
        shouldRetryMe: false,
        shouldTryNextBeing: true,
      };
      resolve(result);
    };
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
  const socket = new WebSocket(url);
  await new Promise((resolve) => {
    socket.onopen = resolve;
  });
  return socket;
}
