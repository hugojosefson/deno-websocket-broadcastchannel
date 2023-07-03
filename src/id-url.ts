const instances: Map<string, IdUrl> = new Map();

function normalizeUrl(url: string | URL): string {
  return new URL(url).href;
}

/**
 * Object that is triple-equal (===) to another IdUrl object if they have the same href.
 *
 * Extends URL, so it can ultimately be used in place of a URL object.
 */
export class IdUrl extends URL {
  private constructor(url: string) {
    super(url);
  }

  /**
   * Creates or retrieves THE IdUrl object for a given URL.
   * @param url
   */
  static of(url: string | URL | IdUrl): IdUrl {
    if (url instanceof IdUrl) {
      return url;
    }

    const normalizedUrl = normalizeUrl(url);
    const existingInstance: IdUrl | undefined = instances.get(normalizedUrl);
    if (existingInstance) {
      return existingInstance;
    }
    const instance = new IdUrl(normalizedUrl);
    instances.set(normalizedUrl, instance);
    return instance;
  }
}
