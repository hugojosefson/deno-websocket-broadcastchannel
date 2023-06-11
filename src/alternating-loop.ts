import { Being, BeingResult, ListenOptions } from "./types.ts";
import { DEFAULT_SLEEP_DURATION_MS, sleep } from "./fn.ts";
import { logger } from "./log.ts";

const log = logger(import.meta.url);
export async function alternatingLoop(
  options: ListenOptions,
  beings: Being[],
): Promise<BeingResult> {
  let i = 0;
  while (true) {
    const being: Being = beings[i];
    let result: BeingResult;
    do {
      result = await being(options);
      await sleep(DEFAULT_SLEEP_DURATION_MS, log);
    } while (result.shouldRetryMe);

    if (result.shouldTryNextBeing) {
      i = (i + 1) % beings.length;
      continue;
    }

    return result;
  }
}
