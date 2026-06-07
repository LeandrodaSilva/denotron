# Contributing to Denotron

Thanks for your interest in improving Denotron! This guide covers the local
setup and the checks that run in CI.

## Prerequisites

- [Deno](https://deno.com) (stable).
- A C/C++ toolchain to build the native library: `cmake`, `ninja`, `clang`.
- **Linux**: WebKitGTK development headers.

  ```bash
  sudo apt-get install libwebkit2gtk-4.1-dev cmake ninja-build clang xvfb
  ```

## Getting the source

The native [`webview`](https://github.com/webview/webview) library is a git
submodule, so clone recursively (or initialise it after cloning):

```bash
git submodule update --init --recursive
```

## Building the native library

```bash
deno task build
```

`build/libwebview.<arch>.so|dylib|dll` is produced and consumed at runtime via
`PLUGIN_URL=./build/`. The WebKitGTK API version defaults to `6.0`; override it
on distros that only ship an older package:

```bash
WEBVIEW_WEBKITGTK_API=4.1 deno task build
```

## Project layout

| Path              | Purpose                                                        |
| ----------------- | -------------------------------------------------------------- |
| `mod.ts`          | Public entry point / re-exports.                               |
| `src/denotron.ts` | The `Denotron` class (windowing, bindings, automation API).    |
| `src/protocol.ts` | Pure, FFI-free IPC primitives (commands, errors). Unit tested. |
| `src/injected.ts` | The page-side automation runtime, generated as a string.       |
| `src/ffi.ts`      | Native library loading and FFI symbol declarations.            |
| `tests/`          | Unit and end-to-end tests.                                     |
| `examples/`       | Runnable usage examples.                                       |

When adding code, keep pure logic (testable without a window) in
`src/protocol.ts` and keep FFI-touching code thin.

## Tests and checks

CI runs the following; please make sure they pass locally before opening a PR:

```bash
deno check mod.ts            # type check
deno fmt --check             # formatting
deno lint                    # linting
deno task test               # unit tests (no window required)

deno task build              # required for the suites below
deno task test:doc           # runnable documentation examples
xvfb-run -a deno task test:e2e   # real-window automation tests
```

Unit tests must not open a native window. End-to-end tests live under
`tests/e2e/`, are gated behind `DENOTRON_E2E=1`, and require a display
(`xvfb-run` on headless machines) plus a built native library.

## Adding an automation command

A command touches three places:

1. `src/protocol.ts` — add the name to the `CommandName` union.
2. `src/injected.ts` — add a handler to the `handlers` map in `buildInjected`.
3. `src/denotron.ts` — add a typed method that calls `#enqueue(...)`.

Cover the page-side behaviour with an assertion in
`tests/e2e/automation_test.ts`.

## Commit and PR conventions

- Keep changes focused and formatted (`deno fmt`).
- Describe user-facing/breaking changes in `CHANGELOG.md`.
