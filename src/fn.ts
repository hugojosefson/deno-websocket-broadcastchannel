import { Logger, logger } from "./log.ts";

const log0: Logger = logger(import.meta.url);

/**
 * Checks if two items are the same, and the same type.
 * @param items.a The first item.
 * @param items.b The second item.
 * @returns Whether the two items are the same, and the same type.
 */
export function equals<A, B>(
  items: { a: A; b: B },
): items is typeof items & { a: B; b: B } & { a: A; b: A } {
  return items.a as unknown === items.b;
}

export async function sleep(
  ms: number,
  log: Logger = log0,
): Promise<void> {
  log(`sleep(${s(ms)}ms)...`);
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extracts the port number from a URL.
 * Responds correctly to the default port for a given protocol.
 * @param url
 */
export function getPortNumber(url: URL): number {
  const asNumber = parseInt(url.port);
  if (!Number.isNaN(asNumber)) {
    return asNumber;
  }
  switch (url.protocol) {
    case "http:":
    case "ws:":
      return 80;
    case "https:":
    case "wss:":
      return 443;
    default:
      throw new Error(`Unknown protocol: ${url.protocol}`);
  }
}

/**
 * Short for stringify, useful for logging.
 * Uses JSON.stringify to convert an object to a string.
 * @param object
 */
export function s(object: unknown): string {
  return JSON.stringify(object);
}

/**
 * Short for stringify with indentation, useful for logging.
 * Uses JSON.stringify to convert an object to a string.
 * @param object
 */
export function ss(object: unknown): string {
  return JSON.stringify(object, null, 2);
}

/**
 * Executes a function, but swallows any errors.
 * @param fn the function to execute, and ignore any errors from.
 * @param defaultIfError the value to return if the function throws an error.
 */
export function safely<T = void>(
  fn: () => T,
  defaultIfError: T | undefined = undefined,
): T | undefined {
  try {
    return fn();
  } catch (_ignore) {
    return defaultIfError;
  }
}

/**
 * Create an {@link AbortController} that can also abort when the given
 * {@link AbortSignal} aborts.
 * @param signal Any {@link AbortSignal} to forward abort events from.
 * @returns An {@link AbortController} that will also abort when the given
 * {@link AbortSignal} aborts.
 */
export function createOrAbortController(signal?: AbortSignal): AbortController {
  const controller: AbortController = new AbortController();
  if (signal) {
    signal.addEventListener("abort", () => {
      controller.abort();
    }, { once: true });
  }
  return controller;
}
