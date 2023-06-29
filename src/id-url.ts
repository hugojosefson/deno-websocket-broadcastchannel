/**
 * Object that is triple-equal (===) to another IdUrl object if they have the same href.
 *
 * Extends URL, so it can ultimately be used in place of a URL object.
 */
export class IdUrl extends URL {
  private static instances: Map<string, IdUrl> = new Map();

  private constructor(url: string) {
    super(url);
  }

  private static ofNormalizedString(url: string): IdUrl {
    if (!this.instances.has(url)) {
      const idUrl = new IdUrl(url);
      this.instances.set(url, idUrl);
    }
    return this.instances.get(url)!;
  }

  /**
   * Creates or retrieves THE IdUrl object for a given URL.
   * @param url
   */
  static of(url: string | URL | IdUrl): IdUrl {
    if (url instanceof IdUrl) {
      return url;
    }
    if (url instanceof URL) {
      return IdUrl.ofNormalizedString(url.href);
    }
    return IdUrl.ofNormalizedString(new URL(url).href);
  }
}
