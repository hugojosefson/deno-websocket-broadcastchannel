export class WebSocketBroadcastChannel extends EventTarget {
  readonly name: string;
  #closed = false;
  #socket?: WebSocket;

  constructor(name: string) {
    super();
    this.name = name;
    this.#connect();
  }
  // deno-lint-ignore no-explicit-any
  postMessage(message: any): void {
    this.#assertNotClosed();
    this.#socket?.send(JSON.stringify(message));
  }
  close(): void {
    this.#closed = true;
    this.#socket?.close();
  }
  #assertNotClosed() {
    if (this.#closed) {
      throw new Error("BroadcastChannel is closed");
    }
  }
  #connect() {
    const socket = new WebSocket(`wss://${location.host}/ws/${this.name}`);
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.dispatchEvent(new MessageEvent("message", { data: message }));
    };
    socket.onclose = () => {
      this.#socket = undefined;
      if (!this.#closed) {
        this.#connect();
      }
    };
    this.#socket = socket;
  }
}
