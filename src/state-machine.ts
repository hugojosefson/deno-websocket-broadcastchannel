import { equals, s } from "./fn.ts";
import { PromiseQueue } from "./promise-queue.ts";
import { Logger, logger } from "./log.ts";

const log0: Logger = logger(import.meta.url);

const INITIAL_STATE = `[*]`;
const DEFAULT_ARROW = `-->`;
const FINAL_STATE = `[*]`;

const GOTO_SYMBOL: unique symbol = Symbol("goto");

export interface TransitionDefinition<S> {
  from: S;
  to: S;
  fn?: OnTransition<S>;
  description?: string;
}

export type ErrorResponse = void | never | Promise<void | never>;
export type OnTransition<S> = Fn<S, void | Promise<void>> & {
  [GOTO_SYMBOL]?: true;
};
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

export function defaultOnDisallowedTransition<S>(from: S, to: S): never {
  throw new Error(
    `Transition from ${s(from)} to ${s(to)} is not allowed.`,
  );
}

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
    onDisallowedTransition: OnDisallowedTransition<S, E> =
      defaultOnDisallowedTransition<S>,
    allowedTransitions: TransitionDefinition<S>[] = [],
  ) {
    const log1: Logger = log0.sub(`${StateMachine.name} constructor`);
    log1(`initialState: ${s(initialState)}`);
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
    const log1: Logger = log0.sub(StateMachine.prototype.transitionTo.name);
    log1(`to: ${s(to)}`);

    let transition: TransitionDefinition<S> = this.createTransition(to);
    log1(`transition: ${s(transition)}`);

    /** enqueue transition if another transition is in progress */
    log1(`this.promiseQueue.isWaiting: ${this.promiseQueue.isWaiting}`);
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
    log1(`transition: ${s(transition)}`);

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
    // deno-lint-ignore no-this-alias
    const that: StateMachine<S, E> = this;

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
      { from, to, fn }:
        | (
          & Pick<TransitionDefinition<S>, "to">
          & Partial<Pick<TransitionDefinition<S>, "fn" | "from">>
        )
        | (
          & Pick<TransitionDefinition<S>, "from">
          & Partial<Pick<TransitionDefinition<S>, "fn" | "to">>
        ),
    ): string {
      const modifiers: string[] = [];
      if (
        to !== undefined && finalStates.includes(to) ||
        from !== undefined && finalStates.includes(from)
      ) {
        modifiers.push("dotted");
      }
      if (fn !== undefined && fn !== noop) {
        if (fn[GOTO_SYMBOL]) {
          modifiers.push("thickness=2");
        } else {
          modifiers.push("thickness=5");
        }
      }
      if (modifiers.length === 0) {
        return DEFAULT_ARROW;
      }
      return `-[${modifiers.join()}]->`;
    }

    function unbound(name = ""): string {
      return name.replace(/^bound /g, "");
    }

    /**
     * Returns the name of the transition function, uncamelcased.
     * Example:
     *   "startListening" -> "start listening"
     * @param name
     */
    function unCamelCase(name = ""): string {
      return name.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
    }

    function cleanupDescription(description = "", to: S): string {
      description = description.trim();
      description = description.replace(/,? and /g, ", ");
      description = description.replace(/\bgoto /g, " → ");

      const availableTransitionsAfter = that.getAvailableTransitions(to);
      const availableTransitionsAfterExceptFinalStates: S[] =
        availableTransitionsAfter.filter((s) => !that.isFinal(s));

      if (availableTransitionsAfterExceptFinalStates.length === 1) {
        const after: S = availableTransitionsAfterExceptFinalStates[0];
        description = description.replace(`${after}`, "");
      }
      description = description.trim();
      description = description.replace(/→$/g, "");
      description = description.trim();
      return description;
    }

    /**
     * Returns the note to use for the transition. If the transition has a
     * description, it is used. Otherwise, an empty string is returned.
     * @param description transition description
     * @param fn transition function
     * @param to to state
     */
    function note(
      { description, fn, to }:
        & Partial<
          Pick<TransitionDefinition<S>, "description" | "fn">
        >
        & Pick<TransitionDefinition<S>, "to">,
    ): string {
      const s = (() => {
        if (typeof description === "string" && description.length > 0) {
          return cleanupDescription(description.replace(/"/g, "'"), to);
        }
        if (
          fn !== undefined && fn !== noop && unbound(fn?.name).length > 0
        ) {
          return cleanupDescription(
            unCamelCase(unbound(fn.name)),
            to,
          );
        }

        return "";
      })();
      if (s.length === 0 || equals({ a: s, b: to })) {
        return "";
      }
      return `: ${s}`;
    }

    const stateMaxWidth = Math.max(
      ...states.map((s) => this.escapePlantUmlString(`${s}`).length),
    );
    const fromMaxWidth = Math.max(
      INITIAL_STATE.length,
      ...transitions.map((t) => `${t.from}`.length),
    );
    const arrowMaxWidth = Math.max(...transitions.map((t) => arrow(t).length));
    const toMaxWidth = Math.max(...transitions.map((t) => `${t.to}`.length));

    /**
     * Renders the PlantUML state machine diagram.
     */
    return [
      "@startuml",
      ...`
      hide empty description

      skinparam shadowing            true
      skinparam ArrowFontColor       #bbb
      skinparam ArrowFontStyle       italic
      skinparam ArrowColor           blue
      skinparam ArrowThickness       0.3
      skinparam StateFontColor       blue
      skinparam StateBackgroundColor lightblue
      skinparam StateBorderColor     blue
      skinparam StateBorderThickness 2
      `.trim().split("\n").map((line) => line.trim()),

      "",
      /** Declare title. */
      ...(typeof title === "string" && title.length > 0
        ? [`title ${this.escapePlantUmlString(title)}`]
        : []),

      "",
      /** Declare the states. */
      ...states
        .map(
          (state: S) =>
            `state ${
              this.escapePlantUmlString(`${state}`).padEnd(stateMaxWidth)
            } as ${short(state)}`,
        ),

      "",
      /** Declare initial state. */
      `${INITIAL_STATE.padEnd(fromMaxWidth)} ${
        DEFAULT_ARROW.padEnd(arrowMaxWidth)
      } ${short(initial)}`,

      /** Declare transitions. */
      ...transitions.map(
        ({ from, to, description, fn }: TransitionDefinition<S>) =>
          `${short(from).padEnd(fromMaxWidth)} ${
            arrow({ to, fn }).padEnd(arrowMaxWidth)
          } ${short(to).padEnd(toMaxWidth)} ${note({ description, fn, to })}`,
      ),

      /** Declare final states. */
      ...finalStates.map(
        (state: S) =>
          `${short(state).padEnd(fromMaxWidth)} ${
            arrow({ from: state }).padEnd(arrowMaxWidth)
          } ${FINAL_STATE}`,
      ),

      "@enduml",
    ]
      .map((line) => line.trim())
      .join("\n");
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

  transitionToNextState() {
    const availableTransitions: S[] = this.getAvailableTransitions();
    if (availableTransitions.length !== 1) {
      throw new Error(
        `Expected exactly one available transition from ${
          s(this._state)
        }, found ${availableTransitions.length}.`,
      );
    }
    const transition: S = availableTransitions[0];
    this.transitionTo(transition);
  }

  transitionToNextNonFinalState() {
    const availableTransitions: S[] = this.getAvailableTransitions();
    if (availableTransitions.length === 0) {
      throw new Error(
        `Expected at least one available transition from ${
          s(this._state)
        }, found none.`,
      );
    }
    const nonFinalTransitions: S[] = availableTransitions.filter(
      (to: S) => !this.isFinal(to),
    );
    if (nonFinalTransitions.length === 0) {
      throw new Error(
        `Expected at least one available non-final transition from ${
          s(
            this._state,
          )
        }, found none.`,
      );
    }
    const transition: S = nonFinalTransitions[0];
    this.transitionTo(transition);
  }

  static gotoFn<S>(
    instanceGetter: () => StateMachine<S>,
    to: S,
  ): OnTransition<S> {
    const fn: OnTransition<S> = () => {
      instanceGetter().transitionTo(to);
    };
    const name = `goto ${to}`;
    Object.defineProperty(fn, "name", { value: name });
    Object.defineProperty(fn, GOTO_SYMBOL, { value: true });
    return fn;
  }

  /**
   * Checks if current state is any of the arguments.
   * @param either
   */
  is(...either: S[]): boolean {
    return either.includes(this._state);
  }
}
