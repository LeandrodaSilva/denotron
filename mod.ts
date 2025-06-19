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
export { preload, unload } from "./src/ffi.ts";
