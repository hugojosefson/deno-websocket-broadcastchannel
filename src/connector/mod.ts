// TODO: use EventTarget instead of MessageListener, MessageSender

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
    protected readonly websocketUrl: URL = DEFAULT_WEBSOCKET_URL,
  ) {
    super(`${BaseConnectorWithUrl.name}(${websocketUrl})`);
  }
  abstract run(): Promise<void>;
}
