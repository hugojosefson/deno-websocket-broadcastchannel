import { BeingResult, ListenOptions, OnMessage } from "./types.ts";
import { Logger, logger } from "./log.ts";

const log0: Logger = logger(import.meta.url);

export async function beClient<T>(
  options: ListenOptions,
  onmessage: OnMessage<T>,
): Promise<BeingResult> {
  const log: Logger = log0.sub(beClient.name);
  const webSocket = await connectToWebSocket(options);
  webSocket.onmessage = (e: MessageEvent) => {
    onmessage(e.data);
  };
  try {
    await new Promise((resolve, reject) => {
      webSocket.onclose = resolve;
      webSocket.onerror = reject;
    });
    log("webSocket closed.");
    return { shouldTryNextBeing: true, shouldRetryMe: false };
  } catch (e) {
    if (e instanceof ErrorEvent && e?.message === "unexpected eof") {
      log("webSocket lost connection to server.");
    } else {
      log("Unexpected error from webSocket:", e);
    }
    return { shouldTryNextBeing: true, shouldRetryMe: false };
  }
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
