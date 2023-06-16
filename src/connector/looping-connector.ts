import { DEFAULT_SLEEP_DURATION_MS, loopingIterator, sleep } from "../fn.ts";
import { Logger, logger } from "../log.ts";
import { BaseConnector, Connector } from "./mod.ts";

const log: Logger = logger(import.meta.url);
export class LoopingConnector extends BaseConnector implements Connector {
  private readonly connectors: Iterable<Connector>;
  constructor(
    connectors: Connector[],
  ) {
    super();
    for (const connector of connectors) {
      this.addEventListener("close", () => connector.close());
    }
    this.connectors = loopingIterator(connectors);
  }
  async run(): Promise<void> {
    this.assertNotClosed();
    for (const connector of this.connectors) {
      await connector.run();
      if (this.closed) {
        return;
      }
      await sleep(DEFAULT_SLEEP_DURATION_MS, log);
    }
  }
}
