import {
  beforeAll,
  describe,
  it,
} from "https://deno.land/std@0.192.0/testing/bdd.ts";
import {
  assertEquals,
  assertStrictEquals,
} from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { createBroadcastChannel } from "../src/create-broadcast-channel.ts";
import { getAvailablePort } from "./get-available-port.ts";
import { defaultWebSocketUrl } from "../src/default-websocket-url.ts";
import { rejectOnTimeout } from "./fn.ts";
import { deferred } from "https://deno.land/std@0.192.0/async/deferred.ts";

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
  describe("three instances in same process", () => {
    it("should create them", async () => {
      const bc1 = await createBroadcastChannel("chat", url);
      try {
        const bc2 = await createBroadcastChannel("chat", url);
        try {
          const bc3 = await createBroadcastChannel("chat", url);
          bc3.close();
        } finally {
          bc2.close();
        }
      } finally {
        bc1.close();
      }
    });
    it("should send one message from each, to the others", async () => {
      const bc0 = await createBroadcastChannel("chat", url);
      try {
        const bc1 = await createBroadcastChannel("chat", url);
        try {
          const bc2 = await createBroadcastChannel("chat", url);
          try {
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
          } finally {
            bc2.close();
          }
        } finally {
          bc1.close();
        }
      } finally {
        bc0.close();
      }
    });
  });
});
