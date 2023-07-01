export const DEFAULT_TEST_TIMEOUT = 2000;

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
