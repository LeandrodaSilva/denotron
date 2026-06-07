# Changelog

All notable changes to this project are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0]

A ground-up reworking of the automation layer, turning the previous
fire-and-forget commands into a robust, Promise-based API.

### ⚠️ Breaking changes

- **Automation methods now return Promises.** `click`, `fill` and `see` (and all
  the new commands) return a `Promise` that resolves with the command's result
  instead of returning `void`. Because `run()` blocks, `await` these Promises
  after `run()` returns. See `docs/automation.md`.
- `fill` now clears the field before typing (it is an alias of
  `type(selector, text, { clear: true })`).

### Added

- New automation commands: `type`, `press`, `select`, `check`, `scroll`,
  `getText`, `getValue`, `getAttribute`, `exists`, `count`, `waitFor`, and
  `evalInPage` (evaluation **with** a returned value).
- Typed errors: `DenotronError`, `DenotronTimeoutError`,
  `DenotronElementNotFoundError`.
- `run({ closeWhenIdle })` to terminate the native loop once every queued
  command has resolved, plus a public `terminate()` method.
- Per-command `timeout` options, enforced page-side.
- A debug overlay (mouse position) when constructing with `new Denotron(true)`.
- Pure IPC protocol module (`src/protocol.ts`) and a unit + end-to-end test
  suite; documentation tests are runnable again.
- `WEBVIEW_WEBKITGTK_API` build override and a reactivated CI pipeline (check,
  fmt, lint, unit, doc and headless e2e tests).
- `docs/automation.md` guide, `CONTRIBUTING.md`, and this changelog.

### Fixed

- The page-side `see`/wait logic referenced undefined `resolve`/`reject` and
  busy-waited, freezing the UI thread. It now uses `MutationObserver` with real
  timeouts.
- `destroy()` iterated `Object.keys()` over a `Map`, so bound callbacks were
  never released. It now unbinds every callback and rejects pending commands.

## [1.0.0]

- Initial Denotron release (webview wrapper with early automation helpers).
