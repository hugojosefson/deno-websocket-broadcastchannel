import { Logger, logger } from "./log.ts";

/**
 * Checks if we are definitively allowed to access a given environment variable.
 * @param variable The name of the environment variable.
 * @returns Whether we are allowed to access the environment variable.
 */
export async function isAllowedEnv(variable: string): Promise<boolean> {
  const query = { name: "env", variable } as const;
  const response = await Deno.permissions.query(query);
  return response.state === "granted";
}

/**
 * Gets an environment variable, but only if getting it is allowed already.
 * @param variable The name of the environment variable.
 * @returns The value of the environment variable, or undefined if it is not
 * allowed, or not set.
 */
export async function weakEnvGet(
  variable: string,
): Promise<string | undefined> {
  if (await isAllowedEnv(variable)) {
    return Deno.env.get(variable);
  }
  return undefined;
}

/**
 * Checks if the current environment is Deno Deploy.
 */
export async function isDenoDeploy(): Promise<boolean> {
  return (await weakEnvGet("DENO_DEPLOYMENT_ID")) !== undefined;
}

export const DEFAULT_SLEEP_DURATION_MS = 50;
export async function sleep(
  ms: number,
  log: Logger = logger(import.meta.url),
): Promise<void> {
  log(`sleep(${ms}ms)...`);
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function isNot<T>(value: T): (other: T) => boolean {
  return (other: T): boolean => other !== value;
}

/**
 * Extracts the port number from a URL.
 * Responds correctly to the default port for a given protocol.
 * @param url
 */
export function getPortNumber(url: URL): number {
  const asNumber = parseInt(url.port);
  if (!isNaN(asNumber)) {
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
 * Creates an iterator that loops over the given items, over and over again.
 * @param items
 */
export function loopingIterator<T>(items: T[]): IterableIterator<T> {
  let index = 0;
  const iterator = {
    [Symbol.iterator](): IterableIterator<T> {
      return iterator;
    },
    next(): IteratorResult<T> {
      if (items.length === 0) {
        return { done: true, value: undefined };
      }
      index %= items.length;
      const item: T = items[index];
      index++;
      return {
        done: false,
        value: item,
      };
    },
  };
  return iterator;
}
