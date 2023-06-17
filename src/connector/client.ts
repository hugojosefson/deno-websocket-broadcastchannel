import { Logger, logger } from "../log.ts";
import { BaseConnectorWithUrl, DEFAULT_WEBSOCKET_URL } from "./mod.ts";

const log0: Logger = logger(import.meta.url);

export class Client extends BaseConnectorWithUrl {
  constructor(
    websocketUrl: URL = DEFAULT_WEBSOCKET_URL,
  ) {
    super(websocketUrl);
  }

  async run(): Promise<void> {
    const log1: Logger = log0.sub(Client.name);
    const socket: WebSocket = new WebSocket(this.websocketUrl);

    function messageListener(message: string) {
      log1.sub("messageListener")("you send:", message);
      socket.send(message);
    }

    function socketCloser() {
      log1.sub("socketCloser")("closing socket...");
      socket.close();
    }
    this.addEventListener("close", socketCloser);

    socket.addEventListener("open", () => {
      log1.sub("socket.onopen")("socket is open.");
      this.outgoing.addMessageListener(messageListener);
    });
    socket.addEventListener("message", (e: MessageEvent) => {
      log1.sub("socket.onmessage")("server says:", e.data);
      this.incoming(e.data);
    });
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("close", () => {
        this.outgoing.removeMessageListener(messageListener);
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
        this.outgoing.removeMessageListener(messageListener);
        resolve();
      });
    });
  }
}
