import { Logger, logger } from "../log.ts";
import {
  BaseConnector,
  ConnectorResult,
  DEFAULT_WEBSOCKET_URL,
  MessageListener,
  MessageSender,
  MessageT,
} from "./mod.ts";
import { getPortNumber, isNot } from "../fn.ts";

const log0: Logger = logger(import.meta.url);

export class Server<T extends MessageT> extends BaseConnector<T> {
  private readonly clients: Set<WebSocket> = new Set();
  constructor(
    incoming: MessageListener<T>,
    outgoing: MessageSender<T>,
    abortSignal: AbortSignal,
    websocketUrl: URL = DEFAULT_WEBSOCKET_URL,
  ) {
    super(incoming, outgoing, abortSignal, websocketUrl);
  }

  async run(): Promise<ConnectorResult> {
    const log: Logger = log0.sub(Server.name);
    const { websocketUrl, abortSignal } = this;
    log(`Becoming the server at ${websocketUrl}...`);

    let listener: Deno.Listener | undefined = undefined;
    const listenerCloser = () => listener?.close();
    abortSignal.addEventListener("abort", listenerCloser);
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
        return abortSignal.aborted ? "stop" : "try_next";
      } else {
        log("Unexpected error:", e);
        throw e;
      }
    } finally {
      log(`No longer the server at ${websocketUrl}.`);
      abortSignal.removeEventListener("abort", listenerCloser);
    }
    return abortSignal.aborted ? "stop" : "retry";
  }

  private async handleHttp(conn: Deno.Conn): Promise<void> {
    const log1: Logger = log0.sub(this.handleHttp.name);
    for await (const requestEvent of Deno.serveHttp(conn)) {
      if (requestEvent) {
        const { request }: Deno.RequestEvent = requestEvent;
        const { socket: client, response }: Deno.WebSocketUpgrade = Deno
          .upgradeWebSocket(request);
        const log: Logger = log1.sub("webSocket");

        const clientCloser: EventListener = () => client.close();
        const messageListener: MessageListener<T> = (message: T) =>
          client.send(message);

        client.onopen = () => {
          log.sub("onopen")("socket is open.");
          this.clients.add(client);
          this.abortSignal.addEventListener("abort", clientCloser);
          this.outgoing.addMessageListener(messageListener);
        };
        client.onmessage = (e: MessageEvent) => {
          log.sub("onmessage")(e.data);
          [...this.clients.values()]
            .filter(isNot(client))
            .forEach((client) => client.send(e.data));
        };
        client.onclose = () => {
          log.sub("onclose")("");
          this.clients.delete(client);
          this.outgoing.removeMessageListener(messageListener);
          this.abortSignal.removeEventListener("abort", clientCloser);
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
  }
}
