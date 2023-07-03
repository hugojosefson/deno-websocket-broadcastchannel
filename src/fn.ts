import { Logger, logger } from "./log.ts";
import { GlobalThisWithBroadcastChannel } from "./types.ts";

const log0: Logger = logger(import.meta.url);

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
 */
export function safely(fn: () => void): void {
  try {
    fn();
  } catch (_ignore) {
    // ignore
  }
}

/**
 * Converts a WebSocket readyState number to a string.
 * @param readyState
 */
export function webSocketReadyState(readyState?: number): string {
  switch (readyState) {
    case WebSocket.CONNECTING:
      return "CONNECTING";
    case WebSocket.OPEN:
      return "OPEN";
    case WebSocket.CLOSING:
      return "CLOSING";
    case WebSocket.CLOSED:
      return "CLOSED";
    default:
      return `UNKNOWN(${s(readyState)})`;
  }
}
