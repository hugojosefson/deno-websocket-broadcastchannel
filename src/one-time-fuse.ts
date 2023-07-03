import { StateMachine } from "./state-machine.ts";

/**
 * OneTimeFuse
 *
 * You can blow it once, and after that, it will throw an exception if you try again.
 */
export class OneTimeFuse {
  private readonly blown: StateMachine<boolean>;
  constructor(
    private readonly errorMessage = "Already blown!",
    private readonly errorConstructor = Error,
  ) {
    this.blown = new StateMachine<boolean>(
      false,
      [
        [false, true],
      ],
      (): never => {
        throw new this.errorConstructor(this.errorMessage);
      },
    );
  }
  blow(): void | never {
    this.blown.transitionTo(true);
  }
  get isBlown(): boolean {
    return this.blown.isFinal();
  }
}
