export type MultiplexMessage = {
  channel: string;
  message: string;
};

export interface Connector extends EventTarget, Deno.Closer {
  postMessage(message: MultiplexMessage): void;
}

export abstract class NamedClosableEventTarget extends EventTarget
  implements Deno.Closer {
  protected closed = false;
  public get isClosed(): boolean {
    return this.closed;
  }
  public get isOpen(): boolean {
    return !this.closed;
  }
  public readonly name: string;
  protected constructor(name?: string) {
    super();
    this.name = name ?? this.constructor.name;
  }
  close() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.dispatchEvent(new Event("close"));
  }
  protected assertNotClosed() {
    if (this.closed) {
      throw new Error(
        `${this.constructor.name}(${this.name}) is closed`,
      );
    }
  }
}

export const DEFAULT_WEBSOCKET_URL = new URL("ws://localhost:51799");

export abstract class BaseConnector extends NamedClosableEventTarget
  implements Connector {
  abstract postMessage(message: MultiplexMessage): void;
}

export abstract class BaseConnectorWithUrl extends BaseConnector {
  protected constructor(
    protected readonly websocketUrl: URL = DEFAULT_WEBSOCKET_URL,
  ) {
    super(`${BaseConnectorWithUrl.name}(${websocketUrl})`);
  }
  abstract run(): Promise<void>;
}
