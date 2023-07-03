import { s } from "./fn.ts";

export type Fn<T> = () => T;
export type TransitionDefinition<S> = [from: S, to: S, fn?: OnTransition];
export type OnTransition = Fn<void>;
export type OnDisallowedTransition<S, T> = (from: S, to: S) => T;

const noop: Fn<void> = () => {};

export class StateMachine<
  S,
  T extends (void | never) = never,
> {
  private _state: S;
  private readonly onDisallowedTransition: OnDisallowedTransition<S, T>;
  private readonly transitions: Map<S, Map<S, OnTransition>> = new Map();

  constructor(
    initialState: S,
    allowedTransitions: TransitionDefinition<S>[] = [],
    onDisallowedTransition: OnDisallowedTransition<S, T> = (from: S, to: S) => {
      throw new Error(
        `Transition from ${s(from)} to ${s(to)} is not allowed.`,
      );
    },
  ) {
    this._state = initialState;
    this.onDisallowedTransition = onDisallowedTransition;

    for (const [from, to, fn = noop] of allowedTransitions) {
      this.setTransition(from, to, fn);
    }
  }

  transitionTo(to: S): T | void {
    const fn: OnTransition | undefined = this.getAnyTransitionFn(to);
    if (fn === undefined) {
      return this.onDisallowedTransition(this._state, to);
    }
    this._state = to;
    return fn();
  }

  get state(): S {
    return this._state;
  }

  isFinal(): boolean {
    return this.getAvailableTransitions().length === 0;
  }

  getAvailableTransitions(): S[] {
    const fromTo: Map<S, OnTransition> | undefined = this.transitions.get(
      this._state,
    );
    return Array.from(fromTo?.keys() ?? []);
  }

  private setTransition(from: S, to: S, fn: OnTransition): void {
    const fromTo: Map<S, OnTransition> | undefined = this.transitions.get(from);
    if (fromTo) {
      fromTo.set(to, fn);
    } else {
      this.transitions.set(from, new Map([[to, fn]]));
    }
  }

  private getAnyTransitionFn(to: S): OnTransition | undefined {
    const fromTo: Map<S, OnTransition> | undefined = this.transitions.get(
      this._state,
    );
    if (fromTo) {
      const fn: OnTransition | undefined = fromTo.get(to);
      if (fn) {
        return fn;
      }
    }
    return undefined;
  }
}
