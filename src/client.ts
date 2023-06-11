import { BeingResult, ListenOptions } from "./types.ts";
import { Logger, logger } from "./log.ts";

const log0: Logger = logger(import.meta.url);

export async function beClient(
  options: ListenOptions,
): Promise<BeingResult> {
  const log: Logger = log0.sub(beClient.name);
  const webSocket = await connectToWebSocket(options);
  webSocket.onmessage = (e) => {
    log(e.data);
  };
  webSocket.onerror = (e: Event | ErrorEvent) => {
    if (e instanceof ErrorEvent) {
      log("error", e?.message ?? e);
    } else {
      log("error", e);
    }
  };
  await new Promise((resolve) => {
    webSocket.onclose = resolve;
  });
  return { shouldTryNextBeing: true, shouldRetryMe: false };
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
