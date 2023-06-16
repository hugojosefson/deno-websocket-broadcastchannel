import { Connector, MessageListener, MessageSender } from "./connector/mod.ts";
import { LoopingConnector } from "./connector/looping-connector.ts";
import { Server } from "./connector/server.ts";
import { Client } from "./connector/client.ts";

type MultiplexMessage = {
  channel: string;
  message: string;
};

let connector: Connector | undefined = undefined;
const incoming: MessageListener = function incoming(
  _message: string,
) {
  // TODO: Handle incoming messages.
};
const outgoing: MessageSender = new MessageSender();

function ensureConnector() {
  if (connector === undefined) {
    connector = new LoopingConnector([
      new Server(incoming, outgoing),
      new Client(incoming, outgoing),
    ]);
  }
}

function getConnector(): Connector {
  ensureConnector();
  return connector!;
}

function possiblyUnregisterConnector() {
  if (connector !== undefined) {
    if (channelSets.size === 0) {
      connector.close();
      connector = undefined;
    }
  }
}

const channelSets: Map<string, Set<WebSocketBroadcastChannel>> = new Map();

function _registerChannel(
  channel: WebSocketBroadcastChannel,
): void {
  ensureConnector();
  const { name } = channel;
  if (!channelSets.has(name)) {
    channelSets.set(name, new Set());
  }
  const channelSet: Set<WebSocketBroadcastChannel> = channelSets.get(name)!;
  channelSet.add(channel);
}

function unregisterChannel(
  channel: WebSocketBroadcastChannel,
): void {
  const { name } = channel;
  const channelSet: Set<WebSocketBroadcastChannel> = channelSets.get(name)!;
  channelSet.delete(channel);
  if (channelSet.size === 0) {
    channelSets.delete(name);
  }
  possiblyUnregisterConnector();
}

function getChannelSet(
  name: string,
): Set<WebSocketBroadcastChannel> {
  if (!channelSets.has(name)) {
    channelSets.set(name, new Set());
  }
  return channelSets.get(name)!;
}

function _foreachChannelDo(
  name: string,
  callback: (channel: WebSocketBroadcastChannel) => void,
): void {
  const channelSet: Set<WebSocketBroadcastChannel> = getChannelSet(name);
  for (const channel of channelSet) {
    callback(channel);
  }
}

export class WebSocketBroadcastChannel extends EventTarget {
  readonly name: string;
  private closed = false;

  constructor(name: string) {
    super();
    this.name = name;
  }
  postMessage(message: string): void {
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
  protected assertNotClosed() {
    if (this.closed) {
      throw new Error(
        `BroadcastChannel(${JSON.stringify(this.name)}) is closed`,
      );
    }
  }
}
