#!/usr/bin/env -S deno run --allow-net --allow-env
import { Manager } from "../mod.ts";
import { deferred } from "https://deno.land/std@0.192.0/async/deferred.ts";
import { s, sleep, ss } from "../src/fn.ts";
import { CommandFailureError } from "https://deno.land/x/run_simple@2.1.0/src/run.ts";

async function main(channelName = "chat") {
  console.error(`pid: ${Deno.pid}`);
  console.error(`channelName: ${s(channelName)}`);

  const closed = deferred<void>();
  const received = deferred<void>();

  const timeout = setTimeout(() => {
    console.error("timeout");
    bc.close();
    closed.reject(new Error("timeout"));
  }, 5000);
  void closed.then(() => clearTimeout(timeout));

  const bc = new Manager().createBroadcastChannel(channelName);
  console.error(`bc.name: ${s(bc.name)}`);
  bc.addEventListener("close", () => {
    console.error("bc closed");
    closed.resolve();
  });
  bc.addEventListener("error", (e: Event) => {
    console.error("bc error", e);
    closed.reject(e);
  });
  bc.addEventListener("open", () => {
    console.error("bc opened");
  });
  bc.addEventListener("message", (e: Event) => {
    const message = (e as MessageEvent).data;
    console.error(
      "bc MMMMMMEEEEESSSSAAAAAGGGGGEEEEE",
      message,
    );
    console.log(message);
    received.resolve();
  });
  console.error("waiting for message...");

  console.error("sleeping before reading from stdin...");
  await sleep(100);
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
    const channelName: string | undefined = Deno.args[0];
    await main(channelName);
  } catch (e) {
    if (e instanceof CommandFailureError) {
      console.error(ss(e));
    } else {
      console.error(e);
    }

    Deno.exit(1);
  }
}
