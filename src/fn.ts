import { Logger, logger } from "./log.ts";

/**
 * Checks if we are definitively allowed to access a given environment variable.
 * @param variable The name of the environment variable.
 * @returns Whether we are allowed to access the environment variable.
 */
export async function isAllowedEnv(variable: string): Promise<boolean> {
  const query = { name: "env", variable } as const;
  const response = await Deno.permissions.query(query);
  return response.state === "granted";
}

/**
 * Gets an environment variable, but only if getting it is allowed already.
 * @param variable The name of the environment variable.
 * @returns The value of the environment variable, or undefined if it is not
 * allowed, or not set.
 */
export async function weakEnvGet(
  variable: string,
): Promise<string | undefined> {
  if (await isAllowedEnv(variable)) {
    return Deno.env.get(variable);
  }
  return undefined;
}

/**
 * Checks if the current environment is Deno Deploy.
 */
export async function isDenoDeploy(): Promise<boolean> {
  return (await weakEnvGet("DENO_DEPLOYMENT_ID")) !== undefined;
}

export async function sleep(
  ms: number,
  log: Logger = logger(import.meta.url),
): Promise<void> {
  log(`sleep(${ms}ms)...`);
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export const DEFAULT_SLEEP_DURATION_MS = 50;
