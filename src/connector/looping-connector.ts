import { DEFAULT_SLEEP_DURATION_MS, sleep } from "../fn.ts";
import { Logger, logger } from "../log.ts";
import { Connector, ConnectorResult, MessageT } from "./mod.ts";

const log: Logger = logger(import.meta.url);
export class LoopingConnector<T extends MessageT>
  implements Connector<T>, Iterator<Connector<T>> {
  private connectorIndex = 0;
  constructor(
    private readonly connectors: Connector<T>[],
    private readonly abortSignal: AbortSignal,
  ) {}
  async run(): Promise<ConnectorResult> {
    let result: ConnectorResult = "stop";
    for (const connector of this) {
      do {
        result = await connector.run();
        log("result", result);
        if (this.abortSignal.aborted) {
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
  [Symbol.iterator](): Iterator<Connector<T>> {
    return this;
  }
  next(): IteratorResult<Connector<T>> {
    if (this.connectors.length === 0) {
      return { done: true, value: undefined };
    }
    this.connectorIndex %= this.connectors.length;
    const connector: Connector<T> = this.connectors[this.connectorIndex];
    this.connectorIndex++;
    return {
      done: false,
      value: connector,
    };
  }
}
