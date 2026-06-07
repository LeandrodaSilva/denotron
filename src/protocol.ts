/**
 * Pure, FFI-free building blocks for the Denotron automation IPC protocol.
 *
 * This module is intentionally free of any `Deno.dlopen`/FFI usage so it can be
 * unit tested without opening a real native window. The {@link Denotron} class
 * builds on top of these primitives, while the injected JavaScript runtime
 * (see `./injected.ts`) consumes {@link Command} objects on the page side.
 */

/** Default per-command timeout in milliseconds. */
export const DEFAULT_TIMEOUT = 30_000;

/** The set of automation commands understood by the injected runtime. */
export type CommandName =
  | "click"
  | "type"
  | "press"
  | "select"
  | "check"
  | "scroll"
  | "see"
  | "getText"
  | "getAttribute"
  | "getValue"
  | "exists"
  | "count"
  | "waitFor"
  | "evalInPage";

/**
 * A single automation instruction sent from Deno-land to the page runtime.
 *
 * Commands are correlated back to their pending {@link Promise} on the Deno
 * side through the {@link Command.id} field.
 */
export interface Command {
  /** Monotonic identifier used to correlate the result. */
  id: number;
  /** The command to execute. */
  command: CommandName;
  /** Positional arguments for the command. */
  args: unknown[];
  /** How long the page runtime should wait before failing the command. */
  timeout: number;
}

/** Status code returned by the page runtime for a resolved command. */
export const Status = {
  /** The command succeeded; payload is the JSON result. */
  OK: 0,
  /** The command failed; payload is the error message. */
  ERROR: 1,
} as const;
export type Status = typeof Status[keyof typeof Status];

/** Base class for all Denotron automation errors. */
export class DenotronError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DenotronError";
  }
}

/** Thrown when a command exceeds its allotted {@link Command.timeout}. */
export class DenotronTimeoutError extends DenotronError {
  constructor(message: string) {
    super(message);
    this.name = "DenotronTimeoutError";
  }
}

/** Thrown when a selector does not resolve to an element in time. */
export class DenotronElementNotFoundError extends DenotronError {
  constructor(message: string) {
    super(message);
    this.name = "DenotronElementNotFoundError";
  }
}

/**
 * Creates a stateful, monotonic command factory.
 *
 * Kept pure (no FFI) so the id sequencing and command shape can be unit tested
 * in isolation.
 *
 * @example
 * ```ts
 * import { createCommandFactory } from "./protocol.ts";
 * import { assertEquals } from "@std/assert";
 *
 * const next = createCommandFactory();
 * assertEquals(next("click", ["#a"]).id, 1);
 * assertEquals(next("see", ["#b"]).id, 2);
 * ```
 *
 * @returns a function that stamps successive {@link Command} objects.
 */
export function createCommandFactory(): (
  command: CommandName,
  args?: unknown[],
  timeout?: number,
) => Command {
  let nextId = 1;
  return (command, args = [], timeout = DEFAULT_TIMEOUT) => ({
    id: nextId++,
    command,
    args,
    timeout,
  });
}

/** Shape of the error payload reported by the page runtime on failure. */
interface ErrorPayload {
  name?: string;
  message?: string;
}

/**
 * Reconstructs a value or a typed error from a result reported by the page
 * runtime via the bound `__denotronResolve` callback.
 *
 * The payload is already a decoded JavaScript value because {@link Denotron}'s
 * `bind` wrapper runs `JSON.parse` on the request before invoking the callback.
 *
 * @param status {@link Status.OK} for a value, {@link Status.ERROR} for failure.
 * @param payload The decoded result value, or `{name,message}` on failure.
 * @returns the decoded value on success.
 * @throws a {@link DenotronError} subclass on failure.
 */
export function decodeResult(status: number, payload: unknown): unknown {
  if (status === Status.OK) {
    return payload ?? null;
  }

  const isObject = typeof payload === "object" && payload !== null;
  const error = (payload ?? {}) as ErrorPayload;
  const name = isObject ? error.name : undefined;
  const rawMessage = isObject
    ? error.message
    : (payload == null ? undefined : String(payload));
  const message = rawMessage ?? "Unknown automation error";

  switch (name) {
    case "DenotronTimeoutError":
      return new DenotronTimeoutError(message);
    case "DenotronElementNotFoundError":
      return new DenotronElementNotFoundError(message);
    default:
      return new DenotronError(message);
  }
}
