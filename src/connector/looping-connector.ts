import {
  ClosableIterable,
  DEFAULT_SLEEP_DURATION_MS,
  instanceGenerator,
  loopingIterator,
  NoArgsConstructor,
  sleep,
} from "../fn.ts";
import { Logger, logger } from "../log.ts";
import { BaseConnector, MultiplexMessage } from "./mod.ts";
import { Server } from "./server.ts";
import { Client } from "./client.ts";

const log0: Logger = logger(import.meta.url);
export class LoopingConnector extends BaseConnector {
  constructor() {
    super();
    void this.run();
  }
  private connector?: BaseConnector;
  private messageQueue: MultiplexMessage[] = [];
  private async run(): Promise<void> {
    const log1: Logger = log0.sub(this.run.name);
    const connectorConstructors: NoArgsConstructor<BaseConnector>[] = [
      Server,
      Client,
    ];
    log1("Looping over connector constructors:", connectorConstructors);

    const connectorIterator: ClosableIterable<
      NoArgsConstructor<BaseConnector>
    > = loopingIterator(connectorConstructors);
    this.addEventListener("close", () => {
      log1("this.addEventListener('close', ...); closing connectorIterator...");
      connectorIterator.close();
    });

    const connectors: Generator<BaseConnector> = instanceGenerator<
      BaseConnector
    >(
      connectorIterator,
    );
    for (const connector of connectors) {
      const log2 = log1.sub(connector.constructor.name);
      this.connector = connector;
      try {
        // If the connector is already closed, skip it.
        if (connector.isClosed) {
          log2("connector.closed; continuing...");
          continue;
        }

        // If we just created a new Connector, but we were already closed,
        // close the new Connector and stop looping.
        if (this.closed) {
          log2("this.closed; closing connector...");
          connector.close();

          log2("this.closed; breaking out of loop...");
          break;
        }

        // If we decide to close or if we have an error, close the connector.
        this.addEventListener("close", () => {
          log2("this.addEventListener('close', ...); closing connector...");
          connector.close();
        });
        this.addEventListener("error", () => {
          log2("this.addEventListener('error', ...); closing connector...");
          connector.close();
        });

        // When the connector opens, set the flag and possibly send messages.
        connector.addEventListener("open", () => {
          log2("connector.addEventListener('open', ...);");
          log2("connector is open.");
          log2("possibly sending messages...");
          this.possiblySendMessages();
        });

        // When the connector receives a message from the other process,
        // emit it as an event from us to anyone listening outside.
        connector.addEventListener("message", (e: Event) => {
          log2(
            "connector.addEventListener('message', ...); this.dispatchEvent(new MessageEvent(\"message\", e))...",
            e,
          );
          this.dispatchEvent(new MessageEvent("message", e));
        });

        // Use this connector until it closes or errors.
        // Then try the next connector.
        log2("awaiting connector to close or error...");
        await new Promise((resolve) => {
          connector.addEventListener("close", resolve);
          connector.addEventListener("error", resolve);
        });
        log2("connector closed or errored.");
        connector.close();

        if (!this.closed) {
          log2("!this.closed; sleeping...");
          await sleep(DEFAULT_SLEEP_DURATION_MS, log0);
        }
        if (this.closed) {
          log2("this.closed; breaking out of loop...");
          break;
        }
        log2("continuing loop...");
      } finally {
        log2("finally; closing connector...");
        if (this.connector?.isOpen) {
          this.connector.close();
        }
        this.connector = undefined;
      }
    }
  }

  postMessage(message: MultiplexMessage): void {
    const log = log0.sub("postMessage(message: MultiplexMessage)");
    log("message:", message);
    this.assertNotClosed();
    this.messageQueue.push(message);
    this.possiblySendMessages();
  }

  private possiblySendMessages(): void {
    const log = log0.sub("possiblySendMessages()");
    log("this.connector?.isOpen:", this.connector?.isOpen);
    log("this.messageQueue.length:", this.messageQueue.length);
    while (this.messageQueue.length > 0 && this.connector?.isOpen) {
      const message = this.messageQueue.shift();
      if (message) {
        log("sending message:", message);
        this.connector.postMessage(message);
      }
    }
    log("done sending messages.");
  }
}
