import { DEFAULT_SLEEP_DURATION_MS, sleep } from "../fn.ts";
import { logger } from "../log.ts";
import {
  Connector,
  ConnectorOptions,
  ConnectorResult,
  OnMessage,
} from "./mod.ts";

const log = logger(import.meta.url);
export async function alternatingLoop<T>(
  options: ConnectorOptions,
  connectors: Connector<T>[],
  onmessage: OnMessage<T>,
  messageGenerator: EventTarget,
  abortSignal: AbortSignal,
): Promise<ConnectorResult> {
  let i = 0;
  while (true) {
    const connector: Connector<T> = connectors[i];
    let result: ConnectorResult;
    do {
      result = await connector(
        options,
        onmessage,
        messageGenerator,
        abortSignal,
      );
      log("result", result);
      await sleep(DEFAULT_SLEEP_DURATION_MS, log);
    } while (result === "retry");

    if (result === "try_next") {
      i = (i + 1) % connectors.length;
      continue;
    }

    return result;
  }
}
