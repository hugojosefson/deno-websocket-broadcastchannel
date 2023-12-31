import { Logger, logger } from "./log.ts";

import { WebSocketClientMessageEvent } from "./web-socket-server.ts";
import { s, safely } from "./fn.ts";
import { WebSocketBroadcastChannel } from "./web-socket-broadcast-channel.ts";

const log0: Logger = logger(import.meta.url);

/**
 * Internal message format for multiplexing messages over a single WebSocket, for several channels.
 */
export interface MultiplexMessage {
  /** Uuid of the WebSocketBroadcastChannel that sent the message. */
  from: string;

  /** Name of the WebSocketBroadcastChannel where the message is to be sent. */
  channel: string;

  /** The message to be sent. */
  message: string;
}

/**
 * Creates a MultiplexMessage from the given WebSocketBroadcastChannel and message.
 * @param from WebSocketBroadcastChannel that sends the message.
 * @param message Message to be sent.
 */
export function createMultiplexMessage(
  from: WebSocketBroadcastChannel,
  message: string,
): MultiplexMessage {
  return {
    from: from.uuid,
    channel: from.name,
    message,
  };
}
/**
 * Checks whether the given message is a MultiplexMessage.
 * @param message possibly a MultiplexMessage.
 * @returns Whether the given message is a MultiplexMessage.
 */
export function isMultiplexMessage(
  message: unknown,
): message is MultiplexMessage {
  const log1 = log0.sub(isMultiplexMessage.name);

  const typeofMessage = typeof message;
  const messageIsNotNull = message !== null;
  const partialMultiplexMessage = message as Partial<MultiplexMessage>;
  const typeofMessageFrom = typeof partialMultiplexMessage?.from;
  const typeofMessageChannel = typeof partialMultiplexMessage?.channel;
  const typeofMessageMessage = typeof partialMultiplexMessage?.message;

  const verdict: boolean = typeofMessage === "object" &&
    messageIsNotNull &&
    typeofMessageFrom === "string" &&
    typeofMessageChannel === "string" &&
    typeofMessageMessage === "string";

  log1(`typeof message: ${s(typeofMessage)}`);
  log1(`message !== null: ${s(messageIsNotNull)}`);
  log1(`typeof message?.from: ${s(typeofMessageFrom)}`);
  log1(`typeof message?.channel: ${s(typeofMessageChannel)}`);
  log1(`typeof message?.message: ${s(typeofMessageMessage)}`);
  log1("verdict", verdict);

  return verdict;
}

/**
 * Extracts any MultiplexMessage object from an Event, if present.
 * Throws if the event does not contain a MultiplexMessage.
 * @param event
 */
export function extractAnyMultiplexMessage(
  event: Event,
): MultiplexMessage | never {
  const log1 = log0.sub(extractAnyMultiplexMessage.name);
  log1("event.constructor.name", event.constructor.name);
  try {
    if (event instanceof MessageEvent) {
      log1(`event.data: ${s(event.data)}`);
      if (isMultiplexMessage(event.data)) {
        log1("event.data is MultiplexMessage");
        return event.data as MultiplexMessage;
      }
      const parsed = safely(() => JSON.parse(event.data));
      log1(`parsed: ${s(parsed)}`);
      if (isMultiplexMessage(parsed)) {
        log1("parsed is MultiplexMessage");
        return parsed as MultiplexMessage;
      }
      log1("parsed is not MultiplexMessage");
      log1(
        `(event as WebSocketClientMessageEvent).data?.clientEvent?.data: ${
          s((event as WebSocketClientMessageEvent).data?.clientEvent?.data)
        }`,
      );
      const parsed2 = safely(() =>
        JSON.parse(
          (event as WebSocketClientMessageEvent).data.clientEvent.data,
        )
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
