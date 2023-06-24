import {
  WebSocketClientEvent,
  WebSocketClientMessageEvent,
  WebSocketServer,
} from "./web-socket-server.ts";
import {
  getPortNumber,
  MultiplexMessage,
  s,
  safely,
  webSocketReadyState,
} from "./fn.ts";
import { Logger, logger } from "./log.ts";

const log0: Logger = logger(import.meta.url);

export type WhatAmI = "closed" | "client" | "server";
export const DEFAULT_WEBSOCKET_URL = new URL("ws://localhost:51799");

export class WebSocketClientServer extends EventTarget implements Deno.Closer {
  private readonly log1: Logger = log0.sub(WebSocketClientServer.name);
  private whatAmI: WhatAmI = "server";
  private wss?: WebSocketServer;
  private ws?: WebSocket;
  private outgoingMessages: MultiplexMessage[] = [];

  constructor(
    private readonly url: URL = DEFAULT_WEBSOCKET_URL,
  ) {
    super();
    const log2: Logger = this.log1.sub("constructor");
    (async () => {
      let log3: Logger;

      while (this.isOpen()) {
        if (this.whatAmI === "server") {
          log3 = log2.sub("server");
          log3("becoming server...");
          try {
            await new Promise<void>((resolve, reject) => {
              const port: number = getPortNumber(this.url);
              this.wss = new WebSocketServer(port);
              log3(`created server on port ${port}...`);

              this.wss.addEventListener("open", () => {
                log3("open");
              });
              this.wss.addEventListener("close", () => {
                log3("close");
                this.disposeServer();
                resolve();
              });
              this.wss.addEventListener("error", reject);

              this.wss.addEventListener("client:open", () => {
                log3("client:open");
              });
              this.wss.addEventListener("client:close", () => {
                log3("client:close");
              });

              this.wss.addEventListener(
                "client:message",
                (event: WebSocketClientMessageEvent) => {
                  log3("client:message");
                  this.dispatchEvent(
                    new MessageEvent("message", {
                      data: JSON.parse(event.data.clientEvent.data),
                    }),
                  );
                },
              );
            });
          } catch (e) {
            log3(`error: ${s(e)}`);
            this.disposeServer();
          }
        }
        if (this.isClosed()) {
          log2("closed; not sleeping after server. breaking loop.");
          break;
        } else {
          log2("sleeping after server...");
          await new Promise((resolve) => setTimeout(resolve, 1000));
          log2("woke up after server");
        }

        if (this.whatAmI === "client") {
          log3 = log2.sub("client");
          log3("becoming client...");
          try {
            await new Promise<void>((resolve, reject) => {
              this.ws = new WebSocket(this.url);
              log3(`created client to url ${this.url}...`);

              this.ws.addEventListener("open", () => {
                log3("open");
              });
              this.ws.addEventListener("close", () => {
                log3("close");
                this.disposeClient();
                resolve();
              });
              this.ws.addEventListener("message", (event: MessageEvent) => {
                const log4: Logger = log3.sub("message");
                log3(`event.data: ${s(event.data)}`);
                log3(`JSON.parsing event.data...`);
                const data = JSON.parse(event.data);
                log3(`JSON.parsed event.data: ${s(data)}`);
                log4(`dispatching message event...`);
                this.dispatchEvent(
                  new MessageEvent("message", { data }),
                );
                log4(`dispatched message event`);
              });
              this.ws.addEventListener("error", reject);
            });
          } catch (e) {
            log3(`error: ${s(e)}`);
            this.disposeClient();
          }
        }
        if (this.isClosed()) {
          log2("closed; not sleeping after client. breaking loop.");
        } else {
          log2("sleeping after client...");
          await new Promise((resolve) => setTimeout(resolve, 1000));
          log2("woke up after client");
        }
      }
      log2("finished");
    })();
  }

  private disposeClient(): void {
    const log1: Logger = log0.sub(this.disposeClient.name);
    log1(`!!this.ws === ${s(!!this.ws)}`);
    if (this.ws) {
      const ws = this.ws;
      this.ws = undefined;
      safely(() => {
        log1(`ws.readyState === ${webSocketReadyState(ws)}`);
        log1(`closing ws...`);
        ws.close();
        log1(`closed ws`);
        log1(`ws.readyState === ${webSocketReadyState(ws)}`);
      });
    }
    if (this.whatAmI === "client") {
      log1("becoming server...");
      this.whatAmI = "server";
    } else {
      log1(`whatAmI === ${s(this.whatAmI)}; not becoming server`);
    }
  }

  private disposeServer(): void {
    const log1: Logger = log0.sub(this.disposeServer.name);
    log1(`!!this.wss === ${s(!!this.wss)}`);
    if (this.wss) {
      const wss = this.wss;
      this.wss = undefined;
      safely(() => {
        log1(`wss.isListening() === ${s(wss.isListening())}`);
        log1(`wss.clients.size === ${s(wss.clients.size)}`);
        for (const client of wss.clients) {
          safely(() => {
            log1(`client.readyState === ${webSocketReadyState(client)}`);
            log1(`closing client...`);
            client.close();
            log1(`closed client`);
            log1(`client.readyState === ${webSocketReadyState(client)}`);
          });
        }
      });
      safely(() => {
        log1(`wss.isListening() === ${s(wss.isListening())}`);
        log1(`closing wss...`);
        wss.close();
        log1(`closed wss`);
        log1(`wss.isListening() === ${s(wss.isListening())}`);
      });
    }
    if (this.whatAmI === "server") {
      log1("becoming client...");
      this.whatAmI = "client";
    } else {
      log1(`whatAmI === ${s(this.whatAmI)}; not becoming client`);
    }
  }

  isClosed(): boolean {
    return this.whatAmI === "closed";
  }

  isOpen(): boolean {
    return !this.isClosed();
  }

  private isConnected(): boolean {
    if (this.isClosed()) {
      return false;
    }
    if (this.whatAmI === "server") {
      return this.wss?.isListening() ?? false;
    }
    if (this.whatAmI === "client") {
      return this.ws?.readyState === WebSocket.OPEN;
    }
    return false;
  }

  close(): void {
    const log2: Logger = this.log1.sub(this.close.name);
    if (this.isClosed()) {
      log2(`already ${this.whatAmI}`);
      return;
    }
    log2("closing");
    this.whatAmI = "closed";
    safely(() => this.ws?.close());
    safely(() => this.wss?.close());
    this.dispatchEvent(new Event("close"));
  }

  postMessage(message: MultiplexMessage): void {
    const log2: Logger = this.log1.sub(this.postMessage.name);
    log2(`message: ${s(message)}`);
    if (this.isClosed()) {
      log2("we're closed");
      return;
    }
    this.outgoingMessages.push(message);
    this.possiblySendOutgoingMessages();
  }

  private sendMessage(message: MultiplexMessage): boolean {
    const log2: Logger = this.log1.sub(this.sendMessage.name);
    log2(`message: ${s(message)}`);
    let log3: Logger;
    if (this.whatAmI === "server") {
      log3 = log2.sub("server");
      if (this.wss?.isListening()) {
        log3(`sending message to ${this.wss.clients.size} clients`);
        for (const ws of this.wss.clients) {
          try {
            ws.send(JSON.stringify(message));
          } catch (e) {
            log3(`error sending message to client: ${s(e)}`);
            this.wss.clients.delete(ws);
          }
        }
        log3(`sent message to ${this.wss.clients.size} clients`);
        return true;
      } else {
        log3("not sending message to client, because not listening");
        return false;
      }
    }
    if (this.whatAmI === "client") {
      log3 = log2.sub("client");
      if (this.ws?.readyState === WebSocket.OPEN) {
        log3(`sending message to server: ${s(message)}`);
        this.ws.send(JSON.stringify(message));
        return true;
      } else {
        log3(
          `not sending message to server, because readyState is ${
            webSocketReadyState(this.ws?.readyState)
          }`,
        );
      }
    }
    log2(`not sending message, because whatAmI is ${s(this.whatAmI)}`);
    return false;
  }

  private possiblySendOutgoingMessages(): void {
    const log2: Logger = this.log1.sub(this.possiblySendOutgoingMessages.name);
    log2(`outgoingMessages.length: ${this.outgoingMessages.length}`);
    log2(`isConnected(): ${this.isConnected()}`);
    log2(`whatAmI: ${s(this.whatAmI)}`);

    while (this.outgoingMessages.length > 0 && this.isConnected()) {
      const message: MultiplexMessage = this.outgoingMessages.shift()!;
      log2(`sending message: ${s(message)}`);
      const didSendMessage = this.sendMessage(message);
      log2(`didSendMessage: ${didSendMessage}`);
      if (!didSendMessage) {
        log2(`failed to send message: ${s(message)}`);
        this.outgoingMessages.unshift(message);
        break;
      }
    }
    log2(`done`);
    log2(`outgoingMessages.length: ${this.outgoingMessages.length}`);
    log2(`isConnected(): ${this.isConnected()}`);
    log2(`whatAmI: ${s(this.whatAmI)}`);
  }
}
