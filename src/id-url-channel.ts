import { IdUrl } from "./id-url.ts";

const instances: Map<string, IdUrlChannel> = new Map();

function keyOf(idUrl: IdUrl, channel: string): string {
  return JSON.stringify({ idUrl, channel });
}

/**
 * Object that is triple-equal (===) to another IdUrlChannel object if they have the same IdUrl and channel name.
 */
export class IdUrlChannel {
  private constructor(
    readonly url: IdUrl,
    readonly channel: string,
  ) {}

  /**
   * Creates or retrieves THE IdUrlChannel object for a given IdUrl and channel name.
   * @param url The url of the channel.
   * @param channel The name of the channel.
   */
  static of(
    url: string | URL | IdUrl,
    channel: string,
  ): IdUrlChannel {
    const idUrl: IdUrl = IdUrl.of(url);
    const key: string = keyOf(idUrl, channel);

    const existingInstance: IdUrlChannel | undefined = instances.get(key);
    if (existingInstance) {
      return existingInstance;
    }

    const newInstance: IdUrlChannel = new IdUrlChannel(idUrl, channel);
    instances.set(key, newInstance);
    return newInstance;
  }
}
