import { assertNotStrictEquals } from "https://deno.land/std@0.203.0/testing/asserts.ts";

export const DEFAULT_TEST_TIMEOUT = 2000;

/**
 * Rejects the promise if it does not resolve within the given timeout.
 * @param promise The promise to reject on timeout.
 * @param timeoutMs The timeout in milliseconds.
 */
export function rejectOnTimeout<T>(
  promise: Promise<T> | Promise<T>[],
  timeoutMs = DEFAULT_TEST_TIMEOUT,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("timeout")),
      timeoutMs,
    );
    if (Array.isArray(promise)) {
      promise = Promise.all(promise) as Promise<T>;
    }
    promise.then(
      (t: T) => {
        clearTimeout(timeout);
        resolve(t);
      },
      (e) => {
        clearTimeout(timeout);
        reject(e);
      },
    );
  });
}

/** Asserts that all elements in the array are different instances. */
export function assertDifferentInstances<T>(xs: T[]) {
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      assertNotStrictEquals(xs[i], xs[j]);
    }
  }
}
