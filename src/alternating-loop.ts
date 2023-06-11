import { Being, BeingResult, ListenOptions, OnMessage } from "./types.ts";
import { DEFAULT_SLEEP_DURATION_MS, sleep } from "./fn.ts";
import { logger } from "./log.ts";

const log = logger(import.meta.url);
export async function alternatingLoop<T>(
  options: ListenOptions,
  beings: Being[],
  onmessage: OnMessage<T>,
  messageGenerator: EventTarget,
): Promise<BeingResult> {
  let i = 0;
  while (true) {
    const being: Being = beings[i];
    let result: BeingResult;
    do {
      result = await being(options, onmessage, messageGenerator);
      log("result", result);
      await sleep(DEFAULT_SLEEP_DURATION_MS, log);
    } while (result.shouldRetryMe);

    if (result.shouldTryNextBeing) {
      i = (i + 1) % beings.length;
      continue;
    }

    return result;
  }
}
