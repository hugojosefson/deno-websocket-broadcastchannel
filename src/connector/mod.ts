export type { StructuredClonable } from "https://deno.land/x/oak@v12.5.0/structured_clone.ts";
import type { StructuredClonable } from "https://deno.land/x/oak@v12.5.0/structured_clone.ts";

export type MessageListener<T extends StructuredClonable> = (
  message: T,
) => void;
export class MessageSender<T extends StructuredClonable> {
  private readonly target: EventTarget = new EventTarget();
  private readonly messageListeners: Set<MessageListener<T>> = new Set();
  private readonly eventListener = (e: Event) => {
    if (!(e instanceof MessageEvent)) {
      return;
    }
    for (const messageListener of this.messageListeners) {
      messageListener(e.data);
    }
  };

  send(message: T) {
    this.target.dispatchEvent(new MessageEvent("message", { data: message }));
  }
  addMessageListener(messageListener: MessageListener<T>) {
    this.messageListeners.add(messageListener);
    this.target.addEventListener("message", this.eventListener); // will be ignored if already added
  }
  removeMessageListener(messageListener: MessageListener<T>) {
    this.messageListeners.delete(messageListener);
    if (this.messageListeners.size === 0) {
      this.target.removeEventListener("message", this.eventListener);
    }
  }
}

export interface Connector<T extends StructuredClonable> extends EventTarget {
  run(): Promise<void>;
  close(): void;
}

export const DEFAULT_WEBSOCKET_URL = new URL("ws://localhost:51799");

export abstract class BaseConnector<T extends StructuredClonable>
  extends EventTarget
  implements Connector<T> {
  protected closed = false;
  abstract run(): Promise<void>;
  close() {
    this.closed = true;
    this.dispatchEvent(new Event("close"));
  }
  protected assertNotClosed() {
    if (this.closed) {
      throw new Error(
        `${this.constructor.name} is closed`,
      );
    }
  }
}

export abstract class BaseConnectorWithUrl<T extends StructuredClonable>
  extends EventTarget
  implements Connector<T> {
  protected closed = false;
  protected constructor(
    protected readonly incoming: MessageListener<T>,
    protected readonly outgoing: MessageSender<T>,
    protected readonly websocketUrl: URL = DEFAULT_WEBSOCKET_URL,
  ) {
    super();
  }
  abstract run(): Promise<void>;
  close() {
    this.closed = true;
    this.dispatchEvent(new Event("close"));
  }
}
