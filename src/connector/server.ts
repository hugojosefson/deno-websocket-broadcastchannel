import { Logger, logger } from "../log.ts";
import {
  BaseConnector,
  ConnectorResult,
  DEFAULT_HOSTNAME,
  DEFAULT_PORT,
  MessageListener,
  MessageSender,
  MessageT,
} from "./mod.ts";
import { isNot } from "../fn.ts";

const log0: Logger = logger(import.meta.url);

export class Server<T extends MessageT> extends BaseConnector<T> {
  private readonly clients: Set<WebSocket> = new Set();
  constructor(
    incoming: MessageListener<T>,
    outgoing: MessageSender<T>,
    abortSignal: AbortSignal,
    port: number = DEFAULT_PORT,
    hostname: string = DEFAULT_HOSTNAME,
  ) {
    super(incoming, outgoing, abortSignal, port, hostname);
  }

  async run(): Promise<ConnectorResult> {
    const log: Logger = log0.sub(Server.name);
    const { hostname, port, abortSignal } = this;
    log(`Becoming the server at ${hostname}:${port}...`);

    let listener: Deno.Listener | undefined = undefined;
    const listenerCloser = () => listener?.close();
    abortSignal.addEventListener("abort", listenerCloser);
    try {
      listener = Deno.listen({ port, hostname });
      log(`Became the server at ${hostname}:${port}.`);
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
      log(`No longer the server at ${hostname}:${port}.`);
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
          client.send(`Hello from ${Deno.pid}.`);
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
