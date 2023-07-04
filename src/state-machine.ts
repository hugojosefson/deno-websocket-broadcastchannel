import { s } from "./fn.ts";
import { PromiseQueue } from "./promise-queue.ts";

export interface TransitionDefinition<S> {
  from: S;
  to: S;
  fn?: OnTransition<S>;
  description?: string;
}

export type ErrorResponse = void | never | Promise<void | never>;
export type OnTransition<S> = Fn<S, void | Promise<void>>;
export type Fn<S, R> = (transition: TransitionDefinition<S>) => R;
export type OnDisallowedTransition<S, E extends ErrorResponse> = (
  from: S,
  to: S,
) => E;
export type OnBeforeTransition<S> = (
  transition: TransitionDefinition<S>,
  createTransition: (to: S) => TransitionDefinition<S>,
) => TransitionDefinition<S>;

function noop<S>(): void {}

type TransitionMeta<S> = Pick<TransitionDefinition<S>, "fn" | "description">;

export class StateMachine<
  S,
  E extends ErrorResponse = never,
> {
  private _state: S;
  private readonly onDisallowedTransition: OnDisallowedTransition<S, E>;
  private readonly onBeforeTransition: OnBeforeTransition<S>;
  private readonly transitions: Map<S, Map<S, TransitionMeta<S>>> = new Map();
  private readonly promiseQueue: PromiseQueue = new PromiseQueue();

  constructor(
    initialState: S,
    onBeforeTransition: OnBeforeTransition<S> = (transition) => transition,
    onDisallowedTransition: OnDisallowedTransition<S, E> = (from: S, to: S) => {
      throw new Error(
        `Transition from ${s(from)} to ${s(to)} is not allowed.`,
      );
    },
    allowedTransitions: TransitionDefinition<S>[] = [],
  ) {
    this._state = initialState;
    this.onDisallowedTransition = onDisallowedTransition;
    this.onBeforeTransition = onBeforeTransition;

    for (const transition of allowedTransitions) {
      this.setTransition({
        fn: noop,
        ...transition,
      });
    }
  }

  createTransition(to: S): TransitionDefinition<S> {
    return {
      from: this._state,
      to,
      ...this.getAnyTransitionMeta(to),
    };
  }

  transitionTo(to: S): E | void | Promise<void> {
    let transition: TransitionDefinition<S> = this.createTransition(to);

    /** enqueue transition if another transition is in progress */
    if (this.promiseQueue.isWaiting) {
      return this.promiseQueue.enqueue(async () => {
        await this.transitionTo(to);
      });
    }
    // otherwise, go ahead and transition

    /** possibly override transition */
    transition = this.onBeforeTransition(
      transition,
      this.createTransition.bind(this),
    );

    /** check if transition is allowed */
    if (transition.fn === undefined) {
      return this.onDisallowedTransition(this._state, to);
    }

    /** transition */
    this._state = to;

    /** run transition function */
    const fn = transition.fn;
    const result: void | Promise<void> = fn(transition);
    /** if transition function returns a Promise, enqueue it */
    if (result instanceof Promise) {
      return this.promiseQueue.enqueue(async () => {
        await result;
      });
    }
    return result;
  }

  get state(): S {
    return this._state;
  }

  isFinal(from: S = this._state): boolean {
    const availableTransitions = this.getAvailableTransitions(from);
    return availableTransitions.length === 0 ||
      (availableTransitions.length === 1 && availableTransitions[0] === from);
  }

  getAvailableTransitions(from: S = this._state): S[] {
    const fromTo: Map<S, TransitionMeta<S>> | undefined = this.transitions.get(
      from,
    );
    return Array.from(fromTo?.keys() ?? []);
  }

  /**
   * Returns this state machine's PlantUML diagram.
   */
  toPlantUml(title?: string, includeFinal = true): string {
    function short(state: S): string {
      return `${state}`.replace(/ /g, "_");
    }

    let states: S[] = Array.from(
      new Set([
        ...this.transitions.keys(),
        ...[...this.transitions.values()].flatMap((
          fromTo: Map<S, TransitionMeta<S>>,
        ) => [
          ...fromTo.keys(),
        ]),
      ]),
    );
    let transitions: TransitionDefinition<S>[] = [];
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
    let finalStates: S[] = states.filter((state: S) => this.isFinal(state));

    /** remove final states, transitions to them */
    if (!includeFinal) {
      states = states.filter((state: S) => !finalStates.includes(state));

      transitions = transitions.filter((
        transition: TransitionDefinition<S>,
      ) => !finalStates.includes(transition.to));

      finalStates = [];
    }

    /**
     * Returns the arrow to use for the transition. Final states are marked with
     * a dotted arrow.
     * @param _from from state, unused for now
     * @param to to state
     * @param fn transition function
     */
    function arrow(
      { to, fn }: Pick<TransitionDefinition<S>, "to" | "fn">,
    ): string {
      const modifiers: string[] = [];
      if (finalStates.includes(to)) {
        modifiers.push("dotted");
      }
      if (fn !== undefined && fn !== noop) {
        modifiers.push("thickness=2");
      }
      if (modifiers.length === 0) {
        return "-->";
      }
      return `-[${modifiers.join()}]->`;
    }

    /**
     * Returns the note to use for the transition. If the transition has a
     * description, it is used. Otherwise, an empty string is returned.
     * @param description
     */
    function note(description: TransitionDefinition<S>["description"]): string {
      if (typeof description === "string" && description.length > 0) {
        return `: ${description.replace(/"/g, "'")}`;
      }
      return "";
    }

    /**
     * Renders the PlantUML state machine diagram.
     */
    return [
      "@startuml",
      ...`
      hide empty description
      skinparam shadowing true
      skinparam ArrowFontColor #bbb
      skinparam ArrowFontStyle italic
      skinparam ArrowColor blue
      skinparam ArrowThickness 0.2
      skinparam StateFontColor blue
      skinparam StateBackgroundColor lightblue
      skinparam StateBorderColor blue
      skinparam StateBorderThickness 2
      `.trim().split("\n").map((line) => line.trim()),

      /** Declare title. */
      ...(typeof title === "string" && title.length > 0
        ? [`title ${this.escapePlantUmlString(title)}`]
        : []),

      /** Declare the states. */
      ...states
        .map(
          (state: S) =>
            `state ${this.escapePlantUmlString(`${state}`)} as ${short(state)}`,
        ),

      /** Declare initial state. */
      `[*] --> ${short(initial)}`,

      /** Declare transitions. */
      ...transitions.map(
        ({ from, to, description, fn }: TransitionDefinition<S>) =>
          `${short(from)} ${arrow({ to, fn })} ${short(to)}${
            note(description)
          }`,
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
