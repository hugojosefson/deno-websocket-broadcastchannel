// TODO: use EventTarget instead of MessageListener, MessageSender

export type MessageListener = (message: string) => void;
export class MessageSender {
  private readonly target: EventTarget = new EventTarget();
  private readonly messageListeners: Set<MessageListener> = new Set();
  private readonly eventListener = (e: Event) => {
    if (!(e instanceof MessageEvent)) {
      return;
    }
    for (const messageListener of this.messageListeners) {
      messageListener(e.data);
    }
  };

  send(message: string) {
    this.target.dispatchEvent(new MessageEvent("message", { data: message }));
  }
  addMessageListener(messageListener: MessageListener) {
    this.messageListeners.add(messageListener);
    this.target.addEventListener("message", this.eventListener); // will be ignored if already added
  }
  removeMessageListener(messageListener: MessageListener) {
    this.messageListeners.delete(messageListener);
    if (this.messageListeners.size === 0) {
      this.target.removeEventListener("message", this.eventListener);
    }
  }
}

export interface Connector extends EventTarget, Deno.Closer {
  run(): Promise<void>;
}

export abstract class ClosableEventTarget extends EventTarget
  implements Deno.Closer {
  protected closed = false;
  protected readonly name: string;
  protected constructor(name?: string) {
    super();
    this.name = name ?? this.constructor.name;
  }
  close() {
    this.closed = true;
    this.dispatchEvent(new Event("close"));
  }
  protected assertNotClosed() {
    if (this.closed) {
      throw new Error(
        `${this.name} is closed`,
      );
    }
  }
}

export const DEFAULT_WEBSOCKET_URL = new URL("ws://localhost:51799");

export abstract class BaseConnector extends ClosableEventTarget
  implements Connector {
  abstract run(): Promise<void>;
}

export abstract class BaseConnectorWithUrl extends BaseConnector {
  protected constructor(
    protected readonly incoming: MessageListener,
    protected readonly outgoing: MessageSender,
    protected readonly websocketUrl: URL = DEFAULT_WEBSOCKET_URL,
  ) {
    super(`${BaseConnectorWithUrl.name}(${websocketUrl})`);
  }
  abstract run(): Promise<void>;
}
