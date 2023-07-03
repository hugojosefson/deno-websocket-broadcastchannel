#!/usr/bin/env -S deno run --allow-net --allow-env=DEBUG
import {
  BroadcastChannelIsh,
  createBroadcastChannel,
  Logger,
  logger,
  WebSocketBroadcastChannel,
} from "../mod.ts";
const log: Logger = logger(import.meta.url);

/**
 * The application's main entry point.
 */
async function main() {
  log("Starting...");
  const chat: BroadcastChannelIsh = await createBroadcastChannel("chat");

  if (chat instanceof WebSocketBroadcastChannel) {
    console.error(`
===============================================================================
Welcome to the chat example of WebSocketBroadcastChannel!

You are not running on Deno Deploy. This means that you are not guaranteed to
have application-wide BroadcastChannel available. This example uses a WebSocket
to provide a host-wide one.

Do start several processes of this example in different terminals on the same
computer. Then type messages in one, and see them appear in them all.

To exit a process, press ctrl-d on a separate line. Remaining processes will
continue to run. If you exit the one that happened to act as server, one of
the others will take over that duty, and the rest will reconnect to it.
-------------------------------------------------------------------------------
    `.trim());
  } else {
    console.error(`
===============================================================================
Running on Deno Deploy. Application-wide BroadcastChannel is fully supported,
so you don't need WebSocketBroadcastChannel!

(However, it makes little sense to read from stdin on Deno Deploy, so this
example CLI-based chat app is only useful on Deno Deploy, for seeing this
detection in your logs :)
===============================================================================
`);
  }

  chat.addEventListener("message", handleIncoming);

  log("continuously reading from stdin");
  const decoder = new TextDecoder();
  for await (const chunk of Deno.stdin.readable) {
    const text = decoder.decode(chunk).trimEnd();
    log("stdin text =", text);
    chat.postMessage(text);
  }

  log("stdin closed, closing chat");
  chat.removeEventListener("message", handleIncoming);
  chat.close();

  log("Done.");
}

/**
 * Prints an incoming chat message to stdout.
 * @param event
 */
function handleIncoming(event: Event): void {
  if (!(event instanceof MessageEvent)) {
    log.sub(handleIncoming.name)("not a MessageEvent");
    return;
  }

  console.log(event.data);
}

if (import.meta.main) {
  await main();
}
