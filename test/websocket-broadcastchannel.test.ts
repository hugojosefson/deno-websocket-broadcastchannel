import {
  beforeAll,
  describe,
  it,
} from "https://deno.land/std@0.192.0/testing/bdd.ts";
import { assertStrictEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { createBroadcastChannel } from "../src/create-broadcast-channel.ts";
import { getAvailablePort } from "./get-available-port.ts";
import { defaultWebSocketUrl } from "../src/default-websocket-url.ts";

const TEST_TIMEOUT = 2000;

let url: URL;
beforeAll(() => {
  url = defaultWebSocketUrl(getAvailablePort());
});

describe("websocket-broadcastchannel", () => {
  it("should create two instances in same process", async () => {
    Deno.env.set("DEBUG", "*");
    const bc1 = await createBroadcastChannel("chat", url);
    try {
      const bc2 = await createBroadcastChannel("chat", url);
      try {
        const p1 = new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("timeout")),
            TEST_TIMEOUT,
          );
          bc1.onmessage = (e) => {
            clearTimeout(timeout);
            resolve(e.data);
          };
        });
        const p2 = new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("timeout")),
            TEST_TIMEOUT,
          );
          bc2.onmessage = (e) => {
            clearTimeout(timeout);
            resolve(e.data);
          };
        });
        bc1.postMessage("test1");
        bc2.postMessage("test2");
        const [r1, r2] = await Promise.all([p1, p2]);
        assertStrictEquals(r1, "test2");
        assertStrictEquals(r2, "test1");
      } finally {
        bc2.close();
      }
    } finally {
      bc1.close();
    }
  });
});
