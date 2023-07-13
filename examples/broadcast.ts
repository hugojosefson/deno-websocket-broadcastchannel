#!/usr/bin/env -S deno run --allow-net --watch
import "../polyfill.ts";

const pid = Deno.pid;
const pidLastDigit = pid % 10;
const delay = pidLastDigit * 1000;

const log = (s: string, ...args: unknown[]) => {
  console.log(`[broadcast.ts#${pid}] ${s}`, ...args);
};

log("run this in multiple terminals on the same host, to see it work");

log("starting...");
const testChannel = new BroadcastChannel("test");
log("testChannel.constructor.name", testChannel.constructor.name);

testChannel.onmessage = (event: Event) => {
  log("onmessage event.data =", (event as MessageEvent).data);
};

testChannel.onmessageerror = (event: Event) => {
  log("onmessageerror event =", event);
};

setInterval(() => {
  log("posting...");
  testChannel.postMessage(`hello from ${pid}`);
  log("posted");
  log(`waiting ${delay / 1000}s...`);
}, delay);
