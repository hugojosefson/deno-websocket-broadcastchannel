import {
  beforeAll,
  describe,
  it,
} from "https://deno.land/std@0.192.0/testing/bdd.ts";
import {
  assertEquals,
  assertInstanceOf,
  assertNotStrictEquals,
  assertStrictEquals,
} from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { createBroadcastChannel } from "../src/create-broadcast-channel.ts";
import { getAvailablePort } from "./get-available-port.ts";
import { defaultWebSocketUrl } from "../src/default-websocket-url.ts";
import { rejectOnTimeout } from "./fn.ts";
import { deferred } from "https://deno.land/std@0.192.0/async/deferred.ts";
import { using } from "../src/using.ts";
import { WebSocketBroadcastChannel } from "../mod.ts";

let url: URL;
beforeAll(() => {
  url = defaultWebSocketUrl(getAvailablePort());
});

describe("websocket-broadcastchannel", () => {
  describe("same channel name", () => {
    describe("two instances in same process", () => {
      it("should create them", async () => {
        await using(
          [
            () => createBroadcastChannel("chat", url),
            () => createBroadcastChannel("chat", url),
          ],
          ([bc0, bc1]) => {
            assertInstanceOf(bc0, WebSocketBroadcastChannel);
            assertInstanceOf(bc1, WebSocketBroadcastChannel);
            assertNotStrictEquals(bc0, bc1);
          },
        );
      });
      it("should send one message from each, to the other", async () => {
        await using(
          [
            () => createBroadcastChannel("chat", url),
            () => createBroadcastChannel("chat", url),
          ],
          async ([bc0, bc1]) => {
            const receivedPromise0 = new Promise<string>((resolve) => {
              bc0.onmessage = (e) => resolve(e.data);
            });
            const receivedPromise1 = new Promise<string>((resolve) => {
              bc1.onmessage = (e) => resolve(e.data);
            });
            bc0.postMessage("test from bc0");
            bc1.postMessage("test from bc1");
            const [received0, received1] = await rejectOnTimeout([
              receivedPromise0,
              receivedPromise1,
            ]);
            assertStrictEquals(received0, "test from bc1");
            assertStrictEquals(received1, "test from bc0");
          },
        );
      });
    });
    describe("three instances in same process", () => {
      it("should create them", async () => {
        await using(
          [
            () => createBroadcastChannel("chat", url),
            () => createBroadcastChannel("chat", url),
            () => createBroadcastChannel("chat", url),
          ],
          ([bc0, bc1, bc2]) => {
            assertInstanceOf(bc0, WebSocketBroadcastChannel);
            assertInstanceOf(bc1, WebSocketBroadcastChannel);
            assertInstanceOf(bc2, WebSocketBroadcastChannel);
            assertNotStrictEquals(bc0, bc1);
            assertNotStrictEquals(bc0, bc2);
          },
        );
      });
      it("should send one message from each, to the others", async () => {
        await using(
          [
            () => createBroadcastChannel("chat", url),
            () => createBroadcastChannel("chat", url),
            () => createBroadcastChannel("chat", url),
          ],
          async ([bc0, bc1, bc2]) => {
            const doneDeferred = deferred<void>();
            const expectedCount = 6;
            let receivedCount = 0;
            const receivedMessages: string[][] = [[], [], []];
            const collectMessages =
              (index: number): (e: MessageEvent<string>) => void => (e) => {
                receivedMessages[index].push(e.data);
                receivedCount++;
                if (receivedCount === expectedCount) {
                  doneDeferred.resolve();
                }
              };

            bc0.onmessage = collectMessages(0);
            bc1.onmessage = collectMessages(1);
            bc2.onmessage = collectMessages(2);

            bc0.postMessage("test0");
            bc1.postMessage("test1");
            bc2.postMessage("test2");
            await rejectOnTimeout(doneDeferred);
            assertEquals(receivedMessages, [
              ["test1", "test2"],
              ["test0", "test2"],
              ["test0", "test1"],
            ]);
          },
        );
      });
    });
  });
  describe("2 instances w/ channel name 'chat2' and 3 instances w/ channel name 'chat3'", () => {
    it("should send one message from each, to the others", async () => {});
  });
});
