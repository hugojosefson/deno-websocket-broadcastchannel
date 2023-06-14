export type ConnectorResult = "retry" | "try_next" | "stop";
export type MessageListener<T extends MessageT> = (message: T) => void;
export class MessageSender<T extends MessageT> {
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

export abstract class Connector<T extends MessageT> {
  protected constructor(
    protected readonly incoming: MessageListener<T>,
    protected readonly outgoing: MessageSender<T>,
    protected readonly abortSignal: AbortSignal,
    protected readonly port: number,
    protected readonly hostname: string,
  ) {}
  abstract run(): Promise<ConnectorResult>;
}

export type MessageT = string | ArrayBufferLike | Blob | ArrayBufferView;
