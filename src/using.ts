const SymbolWithDispose = Symbol as
  & SymbolConstructor
  & {
    readonly dispose: unique symbol;
    readonly asyncDispose: unique symbol;
  };

type Disposable =
  | { [SymbolWithDispose.dispose](): void }
  | { [SymbolWithDispose.asyncDispose]: () => Promise<void> };

export type Resource =
  | Deno.Closer
  | Disposable;

export type ResourceFactory<R extends Resource> = () => R | Promise<R>;

/**
 * Similar to TC39 proposal for `using` blocks.
 *
 * Give it a bunch of functions that each create a resource, and a function that uses those resources.
 * It will call the resource-creating functions, and pass the resources to the using function.
 * Then "finally" it will [Symbol.dispose]/[Symbol.asyncDispose]/close all the resources.
 */
export async function using<
  T,
  R extends Resource,
  Rs extends R[] & { length: N },
  N extends number,
>(
  resourceFactories: ResourceFactory<R>[] & { length: N },
  fn: (resources: Rs) => T | Promise<T>,
): Promise<T> {
  return await recursiveUsing(resourceFactories, fn, []);
}

async function recursiveUsing<
  T,
  R extends Resource,
  Rs extends R[] & { length: N },
  N extends number,
>(
  resourceFactories: ResourceFactory<R>[] & { length: N },
  fn: (resources: Rs) => T | Promise<T>,
  resources: R[],
): Promise<T> {
  if (resourceFactories.length === 0) {
    return fn(resources as Rs);
  }
  const [head, ...tail]: ResourceFactory<R>[] & { length: N } =
    resourceFactories;
  const resource = await head();
  try {
    try {
      try {
        return await recursiveUsing(tail, fn, [...resources, resource]);
      } finally {
        if (typeof SymbolWithDispose.dispose === "symbol" && SymbolWithDispose.dispose in resource) {
          resource[SymbolWithDispose.dispose]();
        }
      }
    } finally {
      if (typeof SymbolWithDispose.asyncDispose === "symbol" && SymbolWithDispose.asyncDispose in resource) {
        await resource[SymbolWithDispose.asyncDispose]();
      }
    }
  } finally {
    if ("close" in resource) {
      resource.close();
    }
  }
}
