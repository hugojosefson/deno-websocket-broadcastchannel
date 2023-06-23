import { Logger, logger } from "../log.ts";
import {
  BaseConnectorWithUrl,
  DEFAULT_WEBSOCKET_URL,
  MultiplexMessage,
} from "./mod.ts";
import { isMultiplexMessage } from "../fn.ts";

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
      log1.sub("socket.onmessage")("server says:", e.data);
      const possiblyMultiplexMessage = JSON.parse(e.data);
      if (!(isMultiplexMessage(possiblyMultiplexMessage))) {
        throw new Error(
          "server sent non-multiplex message",
          possiblyMultiplexMessage,
        );
      }
      const multiplexMessage: MultiplexMessage = possiblyMultiplexMessage;
      log1.sub("socket.onmessage")(
        `dispatching message on ${this.name}:`,
        multiplexMessage,
      );
      this.dispatchEvent(
        new MessageEvent("message", { data: multiplexMessage }),
      );
    };
    socket.addEventListener("message", incomingListener);

    void new Promise<void>((resolve, reject) => {
      socket.addEventListener("close", () => {
        this.removeEventListener("close", socketCloser);
        resolve();
      });
      socket.addEventListener("error", (e: Event) => {
        const log = log1.sub("onerror");
        if (e instanceof ErrorEvent && e?.message === "unexpected eof") {
          log("webSocket lost connection to server.");
        } else {
          log("Unexpected error from webSocket:", e);
          reject(e);
        }
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
