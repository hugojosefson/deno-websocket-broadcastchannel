import { s } from "./fn.ts";

export interface TransitionDefinition<S> {
  from: S;
  to: S;
  fn?: OnTransition<S>;
  description?: string;
}
export type OnTransition<S> = Fn<S, void>;
export type Fn<S, T> = (transition: TransitionDefinition<S>) => T;
export type OnDisallowedTransition<S, E> = (from: S, to: S) => E;

function noop<S>(): void {}

type TransitionMeta<S> = Pick<TransitionDefinition<S>, "fn" | "description">;

export class StateMachine<
  S,
  E extends (void | never) = never,
> {
  private _state: S;
  private readonly onDisallowedTransition: OnDisallowedTransition<S, E>;
  private readonly transitions: Map<S, Map<S, TransitionMeta<S>>> = new Map();

  constructor(
    initialState: S,
    allowedTransitions: TransitionDefinition<S>[] = [],
    onDisallowedTransition: OnDisallowedTransition<S, E> = (from: S, to: S) => {
      throw new Error(
        `Transition from ${s(from)} to ${s(to)} is not allowed.`,
      );
    },
  ) {
    this._state = initialState;
    this.onDisallowedTransition = onDisallowedTransition;

    for (const transition of allowedTransitions) {
      this.setTransition({
        fn: noop,
        ...transition,
      });
    }
  }

  transitionTo(to: S): E | void {
    const transition: TransitionDefinition<S> = {
      from: this._state,
      to,
      ...this.getAnyTransitionMeta(to),
    };
    if (transition.fn === undefined) {
      return this.onDisallowedTransition(this._state, to);
    }
    this._state = to;
    transition.fn(transition);
  }

  get state(): S {
    return this._state;
  }

  isFinal(from: S = this._state): boolean {
    return this.getAvailableTransitions(from).length === 0;
  }

  getAvailableTransitions(from: S = this._state): S[] {
    const fromTo: Map<S, TransitionMeta<S>> | undefined = this.transitions.get(
      from,
    );
    return Array.from(fromTo?.keys() ?? []);
  }

  /**
   * Returns a PlantUML state machine diagram.
   *
   * Specifically marks the final state with a double circle.
   *
   * Marks the initial state (as read from this._state) with a star.
   */
  toPlantUml(title?: string, includeFinal = true): string {
    function short(state: S): string {
      return `${state}`.replace(/ /g, "_");
    }

    const states: S[] = Array.from(
      new Set([
        ...this.transitions.keys(),
        ...[...this.transitions.values()].flatMap((
          fromTo: Map<S, TransitionMeta<S>>,
        ) => [
          ...fromTo.keys(),
        ]),
      ]),
    );
    const transitions: TransitionDefinition<S>[] = [];
    for (const [from, fromTo] of this.transitions.entries()) {
      for (const to of fromTo.keys()) {
        transitions.push(
          {
            from,
            to,
            ...fromTo.get(to),
          },
        );
      }
    }

    const initial: S = this._state;
    const finalStates: S[] = states.filter((state: S) => this.isFinal(state));

    // splice out the final states from the states list, and the transitions
    if (!includeFinal) {
      for (const finalState of finalStates) {
        const index = states.indexOf(finalState);
        if (index !== -1) {
          states.splice(index, 1);
        }
      }
      for (const transition of transitions) {
        const { to } = transition;
        if (finalStates.includes(to)) {
          const index = transitions.indexOf(transition);
          if (index !== -1) {
            transitions.splice(index, 1);
          }
        }
      }
      finalStates.splice(0, finalStates.length);
    }

    function arrow(_from: S, to: S): string {
      if (finalStates.includes(to)) {
        return "-[dotted]->";
      }
      return "-->";
    }

    function note(description: TransitionDefinition<S>["description"]): string {
      if (typeof description === "string" && description.length > 0) {
        return `: ${description.replace(/"/g, "'")}`;
      }
      return "";
    }

    return [
      "@startuml",
      "hide empty description",
      "skinparam ArrowFontColor #bbb",
      "skinparam ArrowFontStyle italic",
      "skinparam ArrowColor lightblue",
      "skinparam StateFontColor blue",
      "skinparam StateBackgroundColor lightblue",
      "skinparam StateBorderColor none",

      /** Declare title. */
      ...(typeof title === "string" && title.length > 0
        ? [`title ${this.escapePlantUmlString(title)}`]
        : []),

      /** Declare any state short names. */
      ...states.filter((state) => `${state}` !== short(state)).map(
        (state: S) =>
          `state ${this.escapePlantUmlString(`${state}`)} as ${short(state)}`,
      ),

      /** Declare initial state. */
      `[*] --> ${short(initial)}`,

      /** Declare transitions. */
      ...transitions.map(
        ({ from, to, description }: TransitionDefinition<S>) =>
          `${short(from)} ${arrow(from, to)} ${short(to)}${note(description)}`,
      ),

      /** Declare final states. */
      ...finalStates.map(
        (state: S) => `${short(state)} -[dotted]-> [*]`,
      ),

      "@enduml",
    ].join("\n");
  }

  private escapePlantUmlString(str?: string): string {
    return [
      '"',
      (str ?? "")
        .replace(/\n/g, "\\n"),
      '"',
    ].join("");
  }

  private setTransition(
    transition:
      & TransitionDefinition<S>
      & Required<Pick<TransitionDefinition<S>, "fn">>,
  ): void {
    const { from, to, fn, description } = transition;
    const fromTo: Map<S, TransitionMeta<S>> | undefined = this.transitions.get(
      from,
    );
    const meta: TransitionMeta<S> = { fn, description };
    if (fromTo) {
      fromTo.set(to, meta);
    } else {
      this.transitions.set(from, new Map([[to, meta]]));
    }
  }

  private getAnyTransitionMeta(to: S): TransitionMeta<S> | undefined {
    return this.transitions.get(this._state)?.get(to);
  }
}
