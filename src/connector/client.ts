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
    log1(`Becoming the client to ${websocketUrl}...`);
    this.socket = new WebSocket(this.websocketUrl);
    const socket: WebSocket = this.socket;

    function socketCloser() {
      log1.sub(socketCloser.name)("closing socket...");
      socket.close();
    }
    this.addEventListener("close", socketCloser);

    socket.addEventListener("open", () => {
      log1.sub("socket.onopen")("socket is open.");
      // TODO: possibly queue messages until socket is open? then try to send them?
    });
    const incomingListener = (e: MessageEvent) => {
      const log2 = log1.sub("socket.onmessage");
      log2("server says:", e.data);
      const multiplexMessage: MultiplexMessage = extractAnyMultiplexMessage(e);
      log2(
        `dispatching multiplexMessage on ${this.name}:`,
        multiplexMessage,
      );
      this.dispatchEvent(asMultiplexMessageEvent(multiplexMessage));
    };
    socket.addEventListener("message", incomingListener);

    void new Promise<void>((resolve) => {
      socket.addEventListener("close", () => {
        this.removeEventListener("close", socketCloser);
        resolve();
      });
    });
  }

  run(): Promise<void> {
    throw new Error("This should not be called.");
  }

  postMessage(message: MultiplexMessage): void {
    // TODO: possibly queue messages until socket is open? then try to send them?
    this.socket.send(JSON.stringify(message));
  }
}
