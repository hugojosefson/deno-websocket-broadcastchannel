export interface ListenOptions {
  hostname: string;
  port: number;
}

export const DEFAULT_LISTEN_OPTIONS: ListenOptions = {
  port: 49152,
  hostname: "localhost",
};

export type Being = (listenOptions: ListenOptions) => Promise<BeingResult>;
export type BeingResult = "retry" | "try_next" | "stop";

export type OnMessage<T> = (message: T) => void;
