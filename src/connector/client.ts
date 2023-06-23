import { Logger, logger } from "../log.ts";
import {
  BaseConnectorWithUrl,
  DEFAULT_WEBSOCKET_URL,
  MultiplexMessage,
} from "./mod.ts";
import { asMultiplexMessageEvent, extractAnyMultiplexMessage } from "../fn.ts";

const log0: Logger = logger(import.meta.url);

export class Client extends BaseConnectorWithUrl {
  private readonly socket: WebSocket;
  constructor(
    websocketUrl: URL = DEFAULT_WEBSOCKET_URL,
  ) {
    super(websocketUrl);
    const log1: Logger = log0.sub(Client.name);
    log1(`Becoming a client to ${websocketUrl}...`);
    this.socket = new WebSocket(this.websocketUrl);
    const socket: WebSocket = this.socket;

    function socketCloser() {
      log1.sub(socketCloser.name)("closing socket...");
      socket.close();
    }
    this.addEventListener("close", socketCloser);
    socket.addEventListener("close", () => {
      this.removeEventListener("close", socketCloser);
    });
    socket.addEventListener("error", (e: Event) => {
      const log = log1.sub("onerror");
      if (e instanceof ErrorEvent && e?.message === "unexpected eof") {
        log("webSocket lost connection to server (unexpected eof), closing webSocket.");
        socket.close();
      } else {
        log("Unexpected error from webSocket:", e);
      }
    });

    socket.addEventListener("open", () => {
      log1.sub("socket.onopen")("socket is open.");
    });
    const incomingListener = (e: MessageEvent) => {
      const log2 = log1.sub("socket.onmessage");
      if (!(e instanceof MessageEvent)) {
        log2(
          "Unexpected non-MessageEvent from socket:",
          e,
        );
        return;
      }
      log2("server says:", e.data);
      const multiplexMessage: MultiplexMessage = extractAnyMultiplexMessage(e);
      log2(
        `dispatching multiplexMessage on ${this.name}:`,
        multiplexMessage,
      );
      this.dispatchEvent(asMultiplexMessageEvent(multiplexMessage));
    };
    socket.addEventListener("message", incomingListener);
  }

  postMessage(message: MultiplexMessage): void {
    this.assertNotClosed();
    this.socket.send(JSON.stringify(message));
  }
}
