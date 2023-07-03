/**
 * OneTimeFuse
 *
 * You can blow it once, and after that, it will throw an exception if you try again.
 */
export class OneTimeFuse {
  private blown: boolean;
  constructor(
    private readonly errorMessage = "Already blown!",
    private readonly errorConstructor = Error,
  ) {
    this.blown = false;
  }
  blow(): void | never {
    if (this.blown) {
      throw new this.errorConstructor(this.errorMessage);
    }
    this.blown = true;
  }
  get isBlown(): boolean {
    return this.blown;
  }
}
