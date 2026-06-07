import { assertEquals, assertStringIncludes } from "@std/assert";
import { buildInjected } from "../src/injected.ts";

Deno.test("buildInjected exposes the IPC entry points", () => {
  const src = buildInjected();
  assertStringIncludes(src, "window.__denotronExec");
  assertStringIncludes(src, "window.__denotronResolve");
  assertStringIncludes(src, "window.denotronReady");
});

Deno.test("buildInjected wires every command handler", () => {
  const src = buildInjected();
  for (
    const command of [
      "click",
      "type",
      "press",
      "select",
      "check",
      "scroll",
      "see",
      "getText",
      "getValue",
      "getAttribute",
      "exists",
      "count",
      "waitFor",
      "evalInPage",
    ]
  ) {
    assertStringIncludes(src, `${command}:`);
  }
});

Deno.test("buildInjected uses MutationObserver, not busy-wait", () => {
  const src = buildInjected();
  assertStringIncludes(src, "MutationObserver");
  assertEquals(src.includes("while (true)"), false);
  assertEquals(src.includes("while(true)"), false);
});

Deno.test("buildInjected omits the overlay by default and includes it on request", () => {
  assertEquals(buildInjected().includes("mousemove"), false);
  assertStringIncludes(buildInjected({ overlay: true }), "mousemove");
});
