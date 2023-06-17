import {
  ClosableIterable,
  DEFAULT_SLEEP_DURATION_MS,
  instanceGenerator,
  loopingIterator,
  NoArgsConstructor,
  sleep,
} from "../fn.ts";
import { Logger, logger } from "../log.ts";
import { BaseConnector, Connector, MultiplexMessage } from "./mod.ts";
import { Server } from "./server.ts";
import { Client } from "./client.ts";

const log: Logger = logger(import.meta.url);
export class LoopingConnector extends BaseConnector implements Connector {
  constructor() {
    super();
    void this.run();
  }
  private connector?: Connector;
  private connectorIsOpen = false;
  private messageQueue: MultiplexMessage[] = [];
  private async run(): Promise<void> {
    const connectorConstructors: NoArgsConstructor<Connector>[] = [
      Server,
      Client,
    ];

    const connectorIterator: ClosableIterable<NoArgsConstructor<Connector>> =
      loopingIterator(connectorConstructors);
    this.addEventListener("close", () => {
      connectorIterator.close();
    });

    const connectors: Generator<Connector> = instanceGenerator<Connector>(
      connectorIterator,
    );
    for (const connector of connectors) {
      // If we just created a new Connector, but we were already closed,
      // close the new Connector and stop looping.
      if (this.closed) {
        connector.close();
        break;
      }

      // If we decide to close or if we have an error, close the connector.
      this.addEventListener("close", () => connector.close());
      this.addEventListener("error", () => connector.close());

      // When the connector opens, set the flag and possibly send messages.
      connector.addEventListener("open", () => {
        this.connectorIsOpen = true;
        this.possiblySendMessages();
      });

      // When the connector receives a message from the other process,
      // emit it as an event from us to anyone listening outside.
      connector.addEventListener("message", (e: Event) => {
        this.dispatchEvent(e);
      });

      // Use this connector until it closes or errors.
      // Then try the next connector.
      await new Promise((resolve) => {
        connector.addEventListener("close", resolve);
        connector.addEventListener("error", resolve);
      });
      this.connectorIsOpen = false;
      connector.close();

      if (!this.closed) {
        await sleep(DEFAULT_SLEEP_DURATION_MS, log);
      }
      if (this.closed) {
        break;
      }
    }
  }

  postMessage(message: MultiplexMessage): void {
    this.messageQueue.push(message);
    this.possiblySendMessages();
  }

  private possiblySendMessages(): void {
    while (
      this.connectorIsOpen &&
      this.connector &&
      this.messageQueue.length > 0
    ) {
      const message = this.messageQueue.shift();
      if (message) {
        this.connector.postMessage(message);
      }
    }
  }
}
