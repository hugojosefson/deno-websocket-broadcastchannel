interface SymbolConstructor {
  readonly dispose: unique symbol;
  readonly asyncDispose: unique symbol;
}

function existsDisposeSymbol(s: unknown): s is SymbolConstructor & {
  readonly dispose: unique symbol;
} {
  return typeof s === "function" &&
    typeof (s as { dispose?: unknown }).dispose === "symbol";
}

function existsAsyncDisposeSymbol(s: unknown): s is SymbolConstructor & {
  readonly asyncDispose: unique symbol;
} {
  return typeof s === "function" &&
    typeof (s as { asyncDispose?: unknown }).asyncDispose === "symbol";
}

const fallbackDisposeSymbol: symbol = globalThis.Symbol("@@dispose");
const fallbackAsyncDisposeSymbol: symbol = globalThis.Symbol("@@asyncDispose");

if (!existsDisposeSymbol(globalThis.Symbol)) {
  Object.assign(globalThis.Symbol, {
    dispose: fallbackDisposeSymbol,
  });
}
if (!existsAsyncDisposeSymbol(globalThis.Symbol)) {
  Object.assign(globalThis.Symbol, {
    asyncDispose: fallbackAsyncDisposeSymbol,
  });
}

export const Symbol: SymbolConstructor = globalThis
  .Symbol as unknown as SymbolConstructor;

export type Disposable = { [Symbol.dispose](): void };
export type AsyncDisposable = { [Symbol.asyncDispose](): Promise<void> };

export type Resource =
  | Deno.Closer
  | Disposable
  | AsyncDisposable;

export type ResourceFactory<R extends Resource> = () => R | Promise<R>;

/**
 * Similar to TC39 proposal for `using` blocks.
 *
 * Give it a bunch of functions that each create a resource, and a function that uses those resources.
 * It will call the resource-creating functions, and pass the resources to the using function.
 * Then "finally" it will [Symbol.dispose]?.(), await [Symbol.asyncDispose]?.(), and await close?.() all the resources.
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
        if (Symbol.dispose in resource) {
          resource[Symbol.dispose]();
        }
      }
    } finally {
      if (Symbol.asyncDispose in resource) {
        await resource[Symbol.asyncDispose]();
      }
    }
  } finally {
    if ("close" in resource && typeof resource.close === "function") {
      await resource.close();
    }
  }
}
