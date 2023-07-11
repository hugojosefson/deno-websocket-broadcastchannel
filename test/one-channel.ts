#!/usr/bin/env -S deno run --allow-net --allow-env
import { parse } from "https://deno.land/std@0.193.0/flags/mod.ts";
import { Manager } from "../mod.ts";
import { deferred } from "https://deno.land/std@0.193.0/async/deferred.ts";
import { s, sleep, ss } from "../src/fn.ts";
import { CommandFailureError } from "https://deno.land/x/run_simple@2.1.0/src/run.ts";

const SLEEP_MULTIPLIER = Deno.isatty(Deno.stdin.rid) ? 100 : 1;
const TOTAL_TIMEOUT = 500 * SLEEP_MULTIPLIER;
const SLEEP_BEFORE_READING_STDIN = 50 * SLEEP_MULTIPLIER;
const SLEEP_BEFORE_CLOSE = 50 * SLEEP_MULTIPLIER;

async function main(channelName: string, expectedCount: number) {
  console.error(`pid: ${Deno.pid}`);
  console.error(`channelName: ${s(channelName)}`);

  const closed = deferred<void>();
  const received = deferred<void>();

  const timeout = setTimeout(() => {
    console.error("timeout");
    bc.close();
    closed.reject(new Error("timeout"));
  }, TOTAL_TIMEOUT);
  void closed.then(() => clearTimeout(timeout));

  const bc = new Manager().createBroadcastChannel(channelName);
  console.error(`bc.name: ${s(bc.name)}`);
  bc.addEventListener("close", () => {
    console.error("bc closed");
    closed.resolve();
  }, { once: true });
  bc.addEventListener("error", (e: Event) => {
    console.error("bc error", e);
    closed.reject(e);
  }, { once: true });
  bc.addEventListener("open", () => {
    console.error("bc opened");
  }, { once: true });

  let receivedCount = 0;
  const onMessage: EventListener = (e: Event) => {
    const message = (e as MessageEvent).data;
    console.log(message);
    receivedCount++;
    if (receivedCount >= expectedCount) {
      received.resolve();
    }
  };
  bc.addEventListener("message", onMessage);
  closed.finally(() => bc.removeEventListener("message", onMessage));

  console.error("waiting for message...");

  console.error("sleeping before reading from stdin...");
  await sleep(SLEEP_BEFORE_READING_STDIN);
  const decoder = new TextDecoder();
  console.error("continuously reading from stdin");
  for await (const chunk of Deno.stdin.readable) {
    const text = decoder.decode(chunk).trimEnd();
    console.error("stdin text =", text);
    bc.postMessage(text);
    console.error("message posted");
  }
  console.error("stdin closed");

  console.error("waiting for received...");
  await received;
  console.error("received");

  console.error("sleeping before closing...");
  await sleep(SLEEP_BEFORE_CLOSE);
  console.error("slept");

  console.error("closing chat");
  bc.close();
  console.error("closed chat");
  console.error("waiting for closed...");
  await closed;
  console.error("closed");
  console.error("exiting");
  Deno.exit(0);
}

if (import.meta.main) {
  try {
    const [channelName, expectedCount] = parse(Deno.args)._ as [string, number];
    await main(channelName, expectedCount);
  } catch (e) {
    if (e instanceof CommandFailureError) {
      console.error(ss(e));
    } else {
      console.error(e);
    }

    Deno.exit(1);
  }
}
