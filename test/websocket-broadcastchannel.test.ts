import {
  beforeAll,
  describe,
  it,
} from "https://deno.land/std@0.192.0/testing/bdd.ts";
import { assertStrictEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { createBroadcastChannel } from "../src/create-broadcast-channel.ts";
import { getAvailablePort } from "./get-available-port.ts";
import { defaultWebSocketUrl } from "../src/default-websocket-url.ts";
import { rejectOnTimeout } from "./fn.ts";

let url: URL;
beforeAll(() => {
  url = defaultWebSocketUrl(getAvailablePort());
});

describe("websocket-broadcastchannel", () => {
  describe("two instances in same process", () => {
    it("should create them", async () => {
      const bc1 = await createBroadcastChannel("chat", url);
      try {
        const bc2 = await createBroadcastChannel("chat", url);
        bc2.close();
      } finally {
        bc1.close();
      }
    });
    it("should send one message from each, to the other", async () => {
      const bc1 = await createBroadcastChannel("chat", url);
      try {
        const bc2 = await createBroadcastChannel("chat", url);
        try {
          const receivedPromise1 = new Promise<string>((resolve) => {
            bc1.onmessage = (e) => resolve(e.data);
          });
          const receivedPromise2 = new Promise<string>((resolve) => {
            bc2.onmessage = (e) => resolve(e.data);
          });
          bc1.postMessage("test1");
          bc2.postMessage("test2");
          const [received1, received2] = await rejectOnTimeout([
            receivedPromise1,
            receivedPromise2,
          ]);
          assertStrictEquals(received1, "test2");
          assertStrictEquals(received2, "test1");
        } finally {
          bc2.close();
        }
      } finally {
        bc1.close();
      }
    });
  });
});
