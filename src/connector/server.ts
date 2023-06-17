import { Logger, logger } from "../log.ts";
import { BaseConnectorWithUrl, DEFAULT_WEBSOCKET_URL } from "./mod.ts";
import { getPortNumber, isNot } from "../fn.ts";

const log0: Logger = logger(import.meta.url);

export class Server extends BaseConnectorWithUrl {
  private readonly clients: Set<WebSocket> = new Set();
  constructor(
    websocketUrl: URL = DEFAULT_WEBSOCKET_URL,
  ) {
    super(websocketUrl);
  }

  async run(): Promise<void> {
    const log: Logger = log0.sub(Server.name);
    const { websocketUrl } = this;
    log(`Becoming the server at ${websocketUrl}...`);

    let listener: Deno.Listener | undefined = undefined;
    const listenerCloser = () => listener?.close();
    this.addEventListener("close", listenerCloser);
    try {
      listener = Deno.listen({
        port: getPortNumber(this.websocketUrl),
        hostname: this.websocketUrl.hostname,
      });
      log(`Became the server at ${websocketUrl}.`);
      for await (const conn of listener) {
        void this.handleHttp(conn);
      }
    } catch (e) {
      if (e.code === "EADDRINUSE") {
        log(
          "Can't server, because address in use. Try being something else instead...",
        );
      } else {
        log("Unexpected error:", e);
        throw e;
      }
    } finally {
      log(`No longer the server at ${websocketUrl}.`);
    }
  }

  private async handleHttp(conn: Deno.Conn): Promise<void> {
    const log1: Logger = log0.sub(this.handleHttp.name);
    const connCloser = () => conn.close();
    this.addEventListener("close", connCloser);
    try {
      for await (const requestEvent of Deno.serveHttp(conn)) {
        if (requestEvent) {
          const { request }: Deno.RequestEvent = requestEvent;
          const { socket: client, response }: Deno.WebSocketUpgrade = Deno
            .upgradeWebSocket(request);
          const clientCloser = () => client.close();
          const log: Logger = log1.sub("webSocket");

          const outgoing: EventListener = (e: Event) => {
            if (!(e instanceof MessageEvent)) {
              return;
            }
            log.sub("outgoing")(e.data);
            client.send(e.data);
          };

          client.onopen = () => {
            log.sub("onopen")("socket is open.");
            this.addEventListener("close", clientCloser);
            this.clients.add(client);
            this.addEventListener("outgoing", outgoing);
          };
          client.onmessage = (e: MessageEvent) => {
            log.sub("onmessage")(e.data);
            this.dispatchEvent(new MessageEvent("incoming", { data: e.data }));
            [...this.clients.values()]
              .filter(isNot(client))
              .forEach((client) => client.send(e.data));
          };
          client.onclose = () => {
            log.sub("onclose")("");
            this.clients.delete(client);
            this.removeEventListener("outgoing", outgoing);
            this.removeEventListener("close", clientCloser);
          };
          client.onerror = (e) => {
            log.sub("onerror")(
              ":",
              e instanceof ErrorEvent ? e?.message ?? e : e,
            );
          };
          await requestEvent.respondWith(response);
        }
      }
    } finally {
      this.removeEventListener("close", connCloser);
    }
  }
}
