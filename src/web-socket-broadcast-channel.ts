import {
  Connector,
  MessageListener,
  MessageSender,
  StructuredClonable,
} from "./connector/mod.ts";
import { LoopingConnector } from "./connector/looping-connector.ts";
import { Server } from "./connector/server.ts";
import { Client } from "./connector/client.ts";

type MultiplexMessage = {
  channel: string;
  message: StructuredClonable;
};

let connector: Connector<MultiplexMessage> | undefined = undefined;
const incoming: MessageListener<MultiplexMessage> = function incoming(
  _message: MultiplexMessage,
) {
  // TODO: Handle incoming messages.
};
const outgoing: MessageSender<MultiplexMessage> = new MessageSender<
  MultiplexMessage
>();

function ensureConnector() {
  if (connector === undefined) {
    connector = new LoopingConnector<MultiplexMessage>([
      new Server<MultiplexMessage>(incoming, outgoing),
      new Client<MultiplexMessage>(incoming, outgoing),
    ]);
  }
}

function getConnector(): Connector<MultiplexMessage> {
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

const channelSets: Map<
  string,
  Set<WebSocketBroadcastChannel<MultiplexMessage>>
> = new Map();

function _registerChannel(
  channel: WebSocketBroadcastChannel<MultiplexMessage>,
): void {
  ensureConnector();
  const { name } = channel;
  if (!channelSets.has(name)) {
    channelSets.set(name, new Set());
  }
  const channelSet: Set<WebSocketBroadcastChannel<MultiplexMessage>> =
    channelSets.get(
      name,
    )!;
  channelSet.add(channel);
}

function unregisterChannel(
  channel: WebSocketBroadcastChannel<MultiplexMessage>,
): void {
  const { name } = channel;
  const channelSet: Set<WebSocketBroadcastChannel<MultiplexMessage>> =
    channelSets.get(
      name,
    )!;
  channelSet.delete(channel);
  if (channelSet.size === 0) {
    channelSets.delete(name);
  }
  possiblyUnregisterConnector();
}

function getChannelSet(
  name: string,
): Set<WebSocketBroadcastChannel<MultiplexMessage>> {
  if (!channelSets.has(name)) {
    channelSets.set(name, new Set());
  }
  return channelSets.get(name)!;
}

function _foreachChannelDo(
  name: string,
  callback: (channel: WebSocketBroadcastChannel<MultiplexMessage>) => void,
): void {
  const channelSet: Set<WebSocketBroadcastChannel<MultiplexMessage>> =
    getChannelSet(
      name,
    );
  for (const channel of channelSet) {
    callback(channel);
  }
}

export class WebSocketBroadcastChannel<T extends MultiplexMessage>
  extends EventTarget {
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
  protected assertNotClosed() {
    if (this.closed) {
      throw new Error(
        `BroadcastChannel(${JSON.stringify(this.name)}) is closed`,
      );
    }
  }
}
