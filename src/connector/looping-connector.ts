import { DEFAULT_SLEEP_DURATION_MS, loopingIterator, sleep } from "../fn.ts";
import { Logger, logger } from "../log.ts";
import { BaseConnector, Connector, ConnectorResult, MessageT } from "./mod.ts";

const log: Logger = logger(import.meta.url);
export class LoopingConnector<T extends MessageT> extends BaseConnector<T>
  implements Connector<T> {
  private readonly connectors: Iterable<Connector<T>>;
  constructor(
    connectors: Connector<T>[],
  ) {
    super();
    this.connectors = loopingIterator(connectors);
  }
  async run(): Promise<ConnectorResult> {
    let result: ConnectorResult = "stop";
    for (const connector of this.connectors) {
      do {
        result = await connector.run();
        log("result", result);
        if (this.closed) {
          return "stop";
        }
        await sleep(DEFAULT_SLEEP_DURATION_MS, log);
      } while (result === "retry");

      if (result === "try_next") {
        continue;
      }

      return result;
    }
    return result;
  }
}
