#!/usr/bin/env -S DEBUG=* deno run --unstable --allow-env=DEBUG --allow-write=example-person-invoice.db --allow-read=example-person-invoice.db
import { isDenoDeploy, logger } from "../mod.ts";
const log = logger(import.meta.url);

log("Starting...");

if (await isDenoDeploy()) {
  log("Running on Deno Deploy. BroadcastChannel is already fully supported.");
} else {
  log(
    "Not running on Deno Deploy. You MAY WANT to use this module for a host-wide BroadcastChannel via a WebSocket!",
  );
}

log("Done.");
