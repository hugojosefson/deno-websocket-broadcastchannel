/**
 * A function that returns a Promise.
 */
export type Promiser<T> = () => Promise<T>;

/**
 * PromiseQueue
 *
 * Lets you enqueue a function that returns a Promise, and get back a Promise that resolves when the enqueued promise resolves.
 * The Promise-returning function you enqueue, is guaranteed to execute after all previously enqueued promises.
 */
export class PromiseQueue {
  private current: Promise<void> = Promise.resolve();
  private waitingCount = 0;

  enqueue(promiser: Promiser<void>): Promise<void> {
    const current = this.current;
    const next: Promiser<void> = async () => {
      await current;
      await promiser();
      this.waitingCount--;
    };
    const promiseOfAllBeforeYouAndPromiser: Promise<void> = next();
    this.waitingCount++;
    this.current = promiseOfAllBeforeYouAndPromiser;
    return promiseOfAllBeforeYouAndPromiser;
  }

  get isWaiting(): boolean {
    return this.waitingCount > 0;
  }

  get isIdle(): boolean {
    return !this.isWaiting;
  }
}
