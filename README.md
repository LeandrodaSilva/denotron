# denotron

> A tiny, cross-platform [Deno](https://deno.com) library for building web-based
> desktop GUIs **and automating them** — like a Playwright that drives a real
> native [webview](https://github.com/webview/webview) window.

```ts
import { Denotron } from "@leproj/denotron";

const wv = new Denotron();
wv.navigate("https://deno.com/");

// Queue automation steps, then read results after the loop ends.
wv.waitFor("#search-str");
wv.fill("#search-str", "denotron");
const value = wv.getValue("#search-str");

wv.run({ closeWhenIdle: true });
console.log(await value); // "denotron"
```

## Installation

```bash
deno add jsr:@leproj/denotron
```

Denotron uses Deno's FFI, so scripts must run with `--unstable-ffi -A`.

## Automation

Denotron exposes a high-level, Promise-based automation API on top of the native
webview. See [`docs/automation.md`](./docs/automation.md) for the full guide,
including the execution model and how to handle results.

| Method                         | Description                                                        |
| ------------------------------ | ------------------------------------------------------------------ |
| `click(selector, opts?)`       | Wait for and click an element                                      |
| `type(selector, text, opts?)`  | Type text, dispatching realistic input events (`{ clear, delay }`) |
| `fill(selector, text)`         | Clear then type (alias of `type(…, { clear: true })`)              |
| `press(selector, key)`         | Dispatch a keyboard event                                          |
| `select(selector, value)`      | Select one or more `<option>` values                               |
| `check(selector, checked?)`    | Toggle a checkbox/radio                                            |
| `scroll(selector, opts?)`      | Scroll an element into view                                        |
| `see(selector, opts?)`         | Wait for an element and resolve its text                           |
| `getText(selector)`            | Resolve an element's text content                                  |
| `getValue(selector)`           | Resolve a form control's value                                     |
| `getAttribute(selector, name)` | Resolve an attribute (or `null`)                                   |
| `exists(selector)`             | Resolve whether any element matches                                |
| `count(selector)`              | Resolve the number of matches                                      |
| `waitFor(selector, opts?)`     | Wait for `visible` / `attached` / `hidden` state                   |
| `evalInPage(code, opts?)`      | Evaluate code in the page and resolve its result                   |

### Execution model (important)

`run()` **blocks** the Deno thread until the window closes. Automation commands
are **queued in order** and executed sequentially inside the page while the loop
runs; their Promises settle during `run()`, so you `await` them **after** it
returns. Use `run({ closeWhenIdle: true })` to auto-close once every queued
command has resolved.

Because the native loop blocks Deno's event loop, you cannot branch on a
command's result _mid-run_ (e.g. `if (await exists(...)) click(...)`). Express
flows as a flat, ordered queue; ordering is guaranteed. Errors (timeouts,
missing elements) surface as typed `DenotronError` rejections.

## Development

### Prerequisites (Linux)

- [webkit2gtk](https://webkitgtk.org/):
  `sudo apt-get install libwebkit2gtk-4.1-dev cmake ninja-build clang`

### Building

```bash
git submodule update --init --recursive
deno task build
```

The WebKitGTK API version defaults to `6.0`; override it for older distros:

```bash
WEBVIEW_WEBKITGTK_API=4.1 deno task build
```

Building on Windows requires admin privileges.

### Running examples

```bash
deno task run examples/automation/main.ts      # builds, then runs
deno task run:fast examples/automation/main.ts # skips the build step
```

### Testing

```bash
deno task test       # fast unit tests (no window)
deno task build      # required for the suites below
deno task test:doc   # runnable documentation examples
xvfb-run -a deno task test:e2e   # real-window automation tests
```

## Environment variables

- `PLUGIN_URL` — custom native library location. Defaults to the latest GitHub
  release assets. Setting this also disables `plug`'s cache.
- `WEBVIEW_WEBKITGTK_API` — WebKitGTK API version used by `deno task build`
  (default `6.0`).

## Dependencies

- [plug](https://jsr.io/@denosaurs/plug)
- [webview](https://github.com/webview/webview)

## License

Copyright 2025, the denotron team. All rights reserved. MIT license.
