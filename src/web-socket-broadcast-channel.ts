import {
  Connector,
  MessageListener,
  MessageSender,
  MessageT,
} from "./connector/mod.ts";
import { LoopingConnector } from "./connector/looping-connector.ts";
import { Server } from "./connector/server.ts";
import { Client } from "./connector/client.ts";

let connector: Connector<MessageT> | undefined = undefined;

function ensureConnector() {
  if (connector === undefined) {
    connector = new LoopingConnector<MessageT>([
      new Server<MessageT>(incoming, outgoing),
      new Client<MessageT>(incoming, outgoing),
    ]);
  }
}

function getConnector(): Connector<MessageT> {
  ensureConnector();
  return connector!;
}

function possiblyUnregisterConnector() {
  if (connector !== undefined) {
    if (channelSets.size === 0) {
      connector = undefined;
    }
  }
}

const channelSets: Map<string, Set<WebSocketBroadcastChannel<MessageT>>> =
  new Map();

function registerChannel(channel: WebSocketBroadcastChannel<MessageT>): void {
  ensureConnector();
  const { name } = channel;
  if (!channelSets.has(name)) {
    channelSets.set(name, new Set());
  }
  const channelSet: Set<WebSocketBroadcastChannel<MessageT>> = channelSets.get(
    name,
  )!;
  channelSet.add(channel);
}

function unregisterChannel(channel: WebSocketBroadcastChannel<MessageT>): void {
  const { name } = channel;
  const channelSet: Set<WebSocketBroadcastChannel<MessageT>> = channelSets.get(
    name,
  )!;
  channelSet.delete(channel);
  if (channelSet.size === 0) {
    channelSets.delete(name);
  }
  possiblyUnregisterConnector();
}

function getChannelSet(name: string): Set<WebSocketBroadcastChannel<MessageT>> {
  if (!channelSets.has(name)) {
    channelSets.set(name, new Set());
  }
  return channelSets.get(name)!;
}

function foreachChannelDo(
  name: string,
  callback: (channel: WebSocketBroadcastChannel<MessageT>) => void,
): void {
  const channelSet: Set<WebSocketBroadcastChannel<MessageT>> = getChannelSet(
    name,
  );
  for (const channel of channelSet) {
    callback(channel);
  }
}

const incoming: MessageListener<MessageT> = function incoming(
  message: MessageT,
) {
  // TODO: Handle incoming messages.
};
const outgoing: MessageSender<MessageT> = new MessageSender<MessageT>();

export class WebSocketBroadcastChannel<T extends MessageT> extends EventTarget {
  readonly name: string;
  private closed = false;

  constructor(name: string) {
    super();
    this.name = name;
  }
  postMessage(message: T): void {
    this.assertNotClosed();
    getConnector().dispatchEvent(
      new MessageEvent("message", { data: message }),
    );
  }
  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    unregisterChannel(this);
    this.dispatchEvent(new Event("close"));
  }
  private assertNotClosed() {
    if (this.closed) {
      throw new Error(
        `BroadcastChannel(${JSON.stringify(this.name)}) is closed`,
      );
    }
  }
}
