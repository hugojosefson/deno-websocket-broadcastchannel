import {
  assertNotStrictEquals,
  assertStrictEquals,
} from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { IdUrl } from "../src/id-url.ts";

Deno.test("IdUrl", () => {
  const url1 = IdUrl.of("http://localhost:51799");
  const url2 = IdUrl.of("http://localhost:51799/");
  const url3 = IdUrl.of("http://localhost:51798");
  const url4 = IdUrl.of(url1);
  const url5 = IdUrl.of(new URL(url1.toString()));
  const url6 = IdUrl.of(new URL("http://localhost:51799"));
  assertStrictEquals(url1, url2);
  assertStrictEquals(url1, url4);
  assertStrictEquals(url1, url5);
  assertStrictEquals(url1, url6);
  assertNotStrictEquals(url1, url3);
  assertStrictEquals(url1.href, "http://localhost:51799/");
});
