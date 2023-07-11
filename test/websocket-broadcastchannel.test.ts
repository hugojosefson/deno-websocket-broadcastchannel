import {
  beforeAll,
  describe,
  it,
} from "https://deno.land/std@0.193.0/testing/bdd.ts";
import {
  assertEquals,
  assertInstanceOf,
  assertStrictEquals,
} from "https://deno.land/std@0.193.0/testing/asserts.ts";
import { getAvailablePort } from "./get-available-port.ts";
import { defaultWebSocketUrl } from "../src/default-websocket-url.ts";
import { assertDifferentInstances, rejectOnTimeout } from "./fn.ts";
import { deferred } from "https://deno.land/std@0.193.0/async/deferred.ts";
import { using } from "../src/using.ts";
import { Manager, WebSocketBroadcastChannel } from "../mod.ts";

import { run } from "https://deno.land/x/run_simple@2.1.0/mod.ts";
import { s, ss } from "../src/fn.ts";
import { CommandFailureError } from "https://deno.land/x/run_simple@2.1.0/src/run.ts";

let url: URL;
let manager: Manager;
beforeAll(() => {
  url = defaultWebSocketUrl(getAvailablePort());
  manager = new Manager();
});

describe("websocket-broadcastchannel", () => {
  describe("in same process", () => {
    describe("2 instances, same channel name", () => {
      it("should create them", async () => {
        await using(
          [
            () => manager.createBroadcastChannel("chat", url),
            () => manager.createBroadcastChannel("chat", url),
          ],
          (channels) => {
            assertEquals(channels.length, 2);
            for (const channel of channels) {
              assertInstanceOf(channel, WebSocketBroadcastChannel);
            }
            assertDifferentInstances(channels);
          },
        );
      });
      it("should send one message from each, to the other", async () => {
        await using(
          [
            () => manager.createBroadcastChannel("chat", url),
            () => manager.createBroadcastChannel("chat", url),
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
    describe("3 instances, same channel name", () => {
      it("should create them", async () => {
        await using(
          [
            () => manager.createBroadcastChannel("chat", url),
            () => manager.createBroadcastChannel("chat", url),
            () => manager.createBroadcastChannel("chat", url),
          ],
          (channels) => {
            assertEquals(channels.length, 3);
            for (const channel of channels) {
              assertInstanceOf(channel, WebSocketBroadcastChannel);
            }
            assertDifferentInstances(channels);
          },
        );
      });
      it("should send one message from each, to the others", async () => {
        await using(
          [
            () => manager.createBroadcastChannel("chat", url),
            () => manager.createBroadcastChannel("chat", url),
            () => manager.createBroadcastChannel("chat", url),
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

            bc0.postMessage("from bc0");
            bc1.postMessage("from bc1");
            bc2.postMessage("from bc2");
            await rejectOnTimeout(doneDeferred);
            assertEquals(receivedMessages, [
              ["from bc1", "from bc2"],
              ["from bc0", "from bc2"],
              ["from bc0", "from bc1"],
            ]);
          },
        );
      });
    });

    describe("2 instances w/ channel name 'chat2' and 3 instances w/ channel name 'chat3'", () => {
      it("should send one message from each, to the others of the same name", async () => {
        await using(
          [
            () => manager.createBroadcastChannel("chat2", url),
            () => manager.createBroadcastChannel("chat2", url),
            () => manager.createBroadcastChannel("chat3", url),
            () => manager.createBroadcastChannel("chat3", url),
            () => manager.createBroadcastChannel("chat3", url),
          ],
          async ([chat2a, chat2b, chat3a, chat3b, chat3c]) => {
            const chat2DoneDeferred = deferred<void>();
            const chat3DoneDeferred = deferred<void>();
            const chat2ExpectedCount = 2;
            const chat3ExpectedCount = 6;
            let chat2ReceivedCount = 0;
            let chat3ReceivedCount = 0;
            const chat2ReceivedMessages: string[][] = [[], []];
            const chat3ReceivedMessages: string[][] = [[], [], []];
            const collectChat2Messages =
              (index: number): (e: MessageEvent<string>) => void => (e) => {
                chat2ReceivedMessages[index].push(e.data);
                chat2ReceivedCount++;
                if (chat2ReceivedCount === chat2ExpectedCount) {
                  chat2DoneDeferred.resolve();
                }
              };
            const collectChat3Messages =
              (index: number): (e: MessageEvent<string>) => void => (e) => {
                chat3ReceivedMessages[index].push(e.data);
                chat3ReceivedCount++;
                if (chat3ReceivedCount === chat3ExpectedCount) {
                  chat3DoneDeferred.resolve();
                }
              };

            chat2a.onmessage = collectChat2Messages(0);
            chat2b.onmessage = collectChat2Messages(1);

            chat3a.onmessage = collectChat3Messages(0);
            chat3b.onmessage = collectChat3Messages(1);
            chat3c.onmessage = collectChat3Messages(2);

            chat2a.postMessage("from chat2a");
            chat2b.postMessage("from chat2b");

            chat3a.postMessage("from chat3a");
            chat3b.postMessage("from chat3b");
            chat3c.postMessage("from chat3c");

            await rejectOnTimeout([chat2DoneDeferred, chat3DoneDeferred]);
            assertEquals(chat2ReceivedMessages, [
              ["from chat2b"],
              ["from chat2a"],
            ]);
            assertEquals(chat3ReceivedMessages, [
              ["from chat3b", "from chat3c"],
              ["from chat3a", "from chat3c"],
              ["from chat3a", "from chat3b"],
            ]);
          },
        );
      });
    });
  });
  describe("in different processes", () => {
    it("2 processes, 1 instance each, same channel name", async () => {
      try {
        const promises: [Promise<string>, Promise<string>] = [
          run([
            new URL("./one-channel.ts", import.meta.url).pathname,
            "chat",
            1,
          ], { stdin: "hello from 0" }),
          run([
            new URL("./one-channel.ts", import.meta.url).pathname,
            "chat",
            1,
          ], { stdin: "hello from 1" }),
        ];
        const [result0, result1]: [string, string] = await Promise.all(promises)
          .catch((e) => {
            console.error(e);
            throw e;
          });
        assertEquals(s(result0), s("hello from 1"));
        assertEquals(s(result1), s("hello from 0"));
      } catch (e) {
        if (e instanceof CommandFailureError) {
          console.error(ss(e));
        } else {
          console.error(e);
        }
        throw e;
      }
    });
    it("3 processes, 1 instance each, same channel name", async () => {
      try {
        const promises: [Promise<string>, Promise<string>, Promise<string>] = [
          run([
            new URL("./one-channel.ts", import.meta.url).pathname,
            "chat",
            2,
          ], { stdin: "hello from 0" }),
          run([
            new URL("./one-channel.ts", import.meta.url).pathname,
            "chat",
            2,
          ], { stdin: "hello from 1" }),
          run([
            new URL("./one-channel.ts", import.meta.url).pathname,
            "chat",
            2,
          ], { stdin: "hello from 2" }),
        ];
        const [result0, result1, result2]: [string, string, string] =
          (await Promise.all(promises).catch((e) => {
            console.error(e);
            throw e;
          })).map((result) => result.split("\n").sort().join("\n")) as [
            string,
            string,
            string,
          ];
        assertEquals(s(result0), s("hello from 1\nhello from 2"));
        assertEquals(s(result1), s("hello from 0\nhello from 2"));
        assertEquals(s(result2), s("hello from 0\nhello from 1"));
      } catch (e) {
        if (e instanceof CommandFailureError) {
          console.error(ss(e));
        } else {
          console.error(e);
        }
        throw e;
      }
    });
  });
});
