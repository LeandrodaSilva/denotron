import { assertEquals, assertInstanceOf } from "@std/assert";
import {
  createCommandFactory,
  decodeResult,
  DEFAULT_TIMEOUT,
  DenotronElementNotFoundError,
  DenotronError,
  DenotronTimeoutError,
  Status,
} from "../src/protocol.ts";

Deno.test("createCommandFactory stamps monotonic ids", () => {
  const next = createCommandFactory();
  const a = next("click", ["#a"]);
  const b = next("see", ["#b"], 1000);
  assertEquals(a.id, 1);
  assertEquals(b.id, 2);
  assertEquals(a.command, "click");
  assertEquals(a.args, ["#a"]);
  assertEquals(a.timeout, DEFAULT_TIMEOUT);
  assertEquals(b.timeout, 1000);
});

Deno.test("createCommandFactory instances are independent", () => {
  const a = createCommandFactory();
  const b = createCommandFactory();
  assertEquals(a("exists").id, 1);
  assertEquals(b("exists").id, 1);
  assertEquals(a("exists").id, 2);
});

Deno.test("decodeResult returns the value on success", () => {
  assertEquals(decodeResult(Status.OK, "hello"), "hello");
  assertEquals(decodeResult(Status.OK, 42), 42);
  assertEquals(decodeResult(Status.OK, true), true);
  assertEquals(decodeResult(Status.OK, null), null);
  assertEquals(decodeResult(Status.OK, undefined), null);
});

Deno.test("decodeResult maps known error names to typed errors", () => {
  const timeout = decodeResult(Status.ERROR, {
    name: "DenotronTimeoutError",
    message: "too slow",
  });
  assertInstanceOf(timeout, DenotronTimeoutError);
  assertEquals((timeout as Error).message, "too slow");

  const notFound = decodeResult(Status.ERROR, {
    name: "DenotronElementNotFoundError",
    message: "missing #x",
  });
  assertInstanceOf(notFound, DenotronElementNotFoundError);
});

Deno.test("decodeResult falls back to DenotronError", () => {
  const generic = decodeResult(Status.ERROR, {
    name: "SomethingElse",
    message: "boom",
  });
  assertInstanceOf(generic, DenotronError);
  assertEquals((generic as Error).message, "boom");

  const fromString = decodeResult(Status.ERROR, "raw message");
  assertInstanceOf(fromString, DenotronError);
  assertEquals((fromString as Error).message, "raw message");

  const fromNullish = decodeResult(Status.ERROR, null);
  assertInstanceOf(fromNullish, DenotronError);
  assertEquals((fromNullish as Error).message, "Unknown automation error");
});
