# Automation guide

Denotron drives a **real** native webview window. Its automation API looks like
a browser automation tool (Playwright/Puppeteer), but the execution model is
shaped by how the native webview loop interacts with Deno. Understanding that
model is the key to using the API correctly.

## The execution model

`Denotron.run()` calls the native `webview_run`, which **blocks the Deno
thread** until the window is closed (or terminated). Two consequences follow:

1. **Deno's event loop is frozen during `run()`.** Promises you create in
   Deno-land do not advance, and `setTimeout` does not fire, while `run()` is on
   the stack. Bound FFI callbacks _do_ fire — that is how results get back to
   Deno — but the microtasks they schedule (i.e. `.then`/`await` continuations
   in Deno) do **not** drain until `run()` returns.

2. **The page's own event loop keeps running.** The webview document has its own
   JavaScript event loop on the UI thread. `setTimeout`, `MutationObserver` and
   `async/await` all work normally _inside the page_.

Denotron therefore runs the automation **sequence inside the page**. When you
call `wv.click(...)`, `wv.see(...)`, etc., Denotron:

1. Builds a command `{ id, command, args, timeout }` and returns a Promise.
2. Queues it (commands issued before the page is ready) or sends it immediately.
3. The injected page runtime executes queued commands **in order**, awaiting
   each one (waiting for elements via `MutationObserver`, typing with delays,
   …).
4. Each result is reported back to Deno through a bound callback, which resolves
   the matching Promise.

## How to use it

Queue your steps **in order**, call `run()`, then `await` the results:

```ts ignore
import { Denotron } from "@leproj/denotron";

const wv = new Denotron();
wv.navigate("https://example.com/login");

wv.waitFor("#username");
wv.fill("#username", "alice");
wv.fill("#password", "hunter2");
wv.click("button[type=submit]");
wv.waitFor(".dashboard");
const greeting = wv.getText(".dashboard h1");

// Close the window automatically once the queue drains.
wv.run({ closeWhenIdle: true });

console.log(await greeting);
```

Ordering between queued commands is guaranteed: `fill` runs before the `click`
that follows it, even though you did not `await` in between.

## What does _not_ work

Because Deno microtasks do not drain during `run()`, you **cannot branch on a
command result mid-run**:

```ts ignore
// ❌ Does NOT work: the `.then` continuation cannot run during run().
wv.exists("#cookie-banner").then((present) => {
  if (present) wv.click("#accept"); // never queued in time
});
wv.run();
```

Instead, express conditional logic in the page with `evalInPage`, which runs a
single page-side expression and returns its result:

```ts ignore
// ✅ Works: the decision happens inside the page.
wv.evalInPage(`
  (() => {
    const b = document.querySelector("#cookie-banner");
    if (b) document.querySelector("#accept").click();
    return !!b;
  })()
`);
```

## Timeouts and errors

Every waiting command accepts a `timeout` (milliseconds, default
`DEFAULT_TIMEOUT = 30000`). Timeouts are enforced **in the page** and surface as
typed rejections:

```ts ignore
import { DenotronElementNotFoundError } from "@leproj/denotron";

const text = wv.see("#maybe-missing", { timeout: 1000 });
wv.run({ closeWhenIdle: true });

try {
  console.log(await text);
} catch (e) {
  if (e instanceof DenotronElementNotFoundError) {
    console.log("element never appeared");
  }
}
```

The error hierarchy is:

- `DenotronError` — base class.
- `DenotronTimeoutError` — a state wait (e.g.
  `waitFor(..., { state: "hidden" })`) timed out.
- `DenotronElementNotFoundError` — a selector did not resolve to a visible
  element in time.

If the window is destroyed before a command resolves, its Promise rejects with a
`DenotronError`.

## Debug overlay

Construct the webview with `new Denotron(true)` (debug mode) to enable developer
tools and a small overlay that tracks the mouse position — handy while writing
selectors.
