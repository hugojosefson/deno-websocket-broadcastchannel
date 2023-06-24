import { Logger, logger } from "./log.ts";
import { WebSocketClientMessageEvent } from "./web-socket-server.ts";

const log0: Logger = logger(import.meta.url);

export type MultiplexMessage = {
  channel: string;
  message: string;
};

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

export type ClosableIterable<T> = Deno.Closer & Iterable<T>;

/**
 * Creates an iterator that loops over the given items, over and over again.
 * @param items
 */
export function loopingIterator<T>(
  items: T[],
): ClosableIterable<T> {
  let index = 0;
  let closed = false;
  const iterator = {
    [Symbol.iterator](): IterableIterator<T> {
      return iterator;
    },
    close(): void {
      closed = true;
    },
    next(): IteratorResult<T> {
      if (closed) {
        return { done: true, value: undefined };
      }
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

export type NoArgsConstructor<T> = new () => T;

/**
 * Creates a generator that constructs instances from an iterable of no-args constructors.
 * @param constructors
 */
export function* instanceGenerator<T>(
  constructors: Iterable<NoArgsConstructor<T>>,
): Generator<T> {
  for (const constructor of constructors) {
    yield new constructor();
  }
}

export function isMultiplexMessage(
  message: unknown,
): message is MultiplexMessage {
  const log1 = log0.sub(isMultiplexMessage.name);
  log1("message", message);
  log1(`typeof message: ${s(typeof message)}`);
  log1(`message !== null: ${s(message !== null)}`);
  log1(
    `typeof (message as Partial<MultiplexMessage>)?.channel: ${
      s(typeof (message as Partial<MultiplexMessage>)?.channel)
    }`,
  );
  log1(
    `typeof (message as Partial<MultiplexMessage>)?.message: ${
      s(typeof (message as Partial<MultiplexMessage>)?.message)
    }`,
  );

  const verdict: boolean = typeof message === "object" &&
    message !== null &&
    typeof (message as Partial<MultiplexMessage>)?.channel === "string" &&
    typeof (message as Partial<MultiplexMessage>)?.message === "string";
  log1("verdict", verdict);
  return verdict;
}

/**
 * Extracts any MultiplexMessage object from an Event, if present.
 * Throws if the event does not contain a MultiplexMessage.
 * @param event
 */
export function extractAnyMultiplexMessage(event: Event): MultiplexMessage {
  const log1 = log0.sub(extractAnyMultiplexMessage.name);
  log1("event.constructor.name", event.constructor.name);
  try {
    if (event instanceof MessageEvent) {
      log1(`event.data: ${s(event.data)}`);
      if (isMultiplexMessage(event.data)) {
        log1("event.data is MultiplexMessage");
        return event.data as MultiplexMessage;
      }
      const parsed = JSON.parse(event.data);
      log1(`parsed: ${s(parsed)}`);
      if (isMultiplexMessage(parsed)) {
        log1("parsed is MultiplexMessage");
        return parsed as MultiplexMessage;
      }
      log1("parsed is not MultiplexMessage");
      log1(
        `(event as WebSocketClientMessageEvent).data.clientEvent.data: ${
          s((event as WebSocketClientMessageEvent).data.clientEvent.data)
        }`,
      );
      const parsed2 = JSON.parse(
        (event as WebSocketClientMessageEvent).data.clientEvent.data,
      );
      log1(`parsed2: ${s(parsed2)}`);
      if (isMultiplexMessage(parsed2)) {
        log1("parsed2 as MultiplexMessage");
        return parsed2 as MultiplexMessage;
      }
      log1("parsed2 is not MultiplexMessage");
    }
  } catch (error) {
    log1("error", error);
    // fall-through to error
  }
  throw new Error(`Event contained non-multiplex message: ${event}`);
}

export function asMultiplexMessageEvent(
  multiplexMessage: MultiplexMessage,
  type = "message",
): MessageEvent {
  return new MessageEvent(type, {
    data: JSON.stringify(multiplexMessage),
  });
}

export function asMessageEvent(
  multiplexMessage: MultiplexMessage,
  type = "message",
): MessageEvent {
  return new MessageEvent(type, {
    data: multiplexMessage.message,
  });
}

export function s(object: unknown): string {
  return JSON.stringify(object);
}

export function ss(object: unknown): string {
  return JSON.stringify(object, null, 2);
}

export function safely(fn: () => void): void {
  try {
    fn();
  } catch (_ignore) {
    // ignore
  }
}

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
