/**
 * Denotron is a tiny cross-platform library to make web-based  automation GUIs for desktop
 * applications.
 *
 * @example
 * ```
 * import { Denotron } from "@leproj/denotron";
 *
 * const denotron = new Denotron();
 *
 * denotron.navigate(`data:text/html,${encodeURIComponent(html)}`);
 * denotron.run();
 * ```
 *
 * @module
 */

export * from "./src/denotron.ts";
export { encodeCString, preload, unload } from "./src/ffi.ts";
export {
  type Command,
  type CommandName,
  DEFAULT_TIMEOUT,
  DenotronElementNotFoundError,
  DenotronError,
  DenotronTimeoutError,
} from "./src/protocol.ts";
export { buildInjected, type InjectedOptions } from "./src/injected.ts";
