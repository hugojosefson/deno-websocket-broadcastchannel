export interface ConnectorOptions {
  hostname: string;
  port: number;
}

export const DEFAULT_CONNECTOR_OPTIONS: ConnectorOptions = {
  port: 49152,
  hostname: "localhost",
};
export type OnMessage<T> = (message: T) => void;
export type Connector<T> = (
  connectorOptions: ConnectorOptions,
  onmessage: OnMessage<T>,
  messageGenerator: EventTarget,
  abortSignal: AbortSignal,
) => Promise<ConnectorResult>;
export type ConnectorResult = "retry" | "try_next" | "stop";
