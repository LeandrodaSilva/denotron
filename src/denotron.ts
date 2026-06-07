import { encodeCString, instances, lib } from "./ffi.ts";
import { buildInjected } from "./injected.ts";
import {
  type Command,
  type CommandName,
  createCommandFactory,
  decodeResult,
  DEFAULT_TIMEOUT,
  DenotronError,
} from "./protocol.ts";

/** A pending automation command awaiting its result from the page runtime. */
interface Pending {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

/** Options controlling how {@link Denotron.scroll} brings an element into view. */
export interface ScrollOptions {
  /** Scrolling animation behavior. */
  behavior?: "auto" | "smooth" | "instant";
  /** Vertical alignment of the element within the scroll viewport. */
  block?: "start" | "center" | "end" | "nearest";
  /** Horizontal alignment of the element within the scroll viewport. */
  inline?: "start" | "center" | "end" | "nearest";
}

/** Options for {@link Denotron.run}. */
export interface RunOptions {
  /**
   * When true, the native loop terminates automatically once every queued
   * automation command has resolved. Useful for headless-style scripts that
   * should not keep the window open after the work is done.
   */
  closeWhenIdle?: boolean;
}

/** Window size hints */
export type SizeHint = typeof SizeHint[keyof typeof SizeHint];

/** Window size hints */
export const SizeHint = {
  /** Width and height are default size */
  NONE: 0,
  /** Width and height are minimum bounds */
  MIN: 1,
  /** Width and height are maximum bounds */
  MAX: 2,
  /** Window size can not be changed by a user */
  FIXED: 3,
} as const;

/** Window size */
export interface Size {
  /** The width of the window */
  width: number;
  /** The height of the window */
  height: number;
  /** The window size hint */
  hint: SizeHint;
}

/**
 * An instance of a webview window.
 *
 * ## Examples
 *
 * ### Local
 *
 * ```ts ignore
 * import { Denotron } from "../mod.ts";
 *
 * const html = `
 *   <html>
 *   <body>
 *     <h1>Hello from deno v${Deno.version.deno}</h1>
 *   </body>
 *   </html>
 * `;
 *
 * const webview = new Denotron();
 *
 * webview.navigate(`data:text/html,${encodeURIComponent(html)}`);
 * webview.run();
 * ```
 *
 * ### Remote
 *
 * ```ts ignore
 * import { Denotron } from "../mod.ts";
 *
 * const webview = new Denotron();
 * webview.navigate("https://deno.land/");
 * webview.run();
 * ```
 */
export class Denotron {
  #handle: Deno.PointerValue = null;
  #callbacks: Map<
    string,
    Deno.UnsafeCallback<{
      parameters: readonly "pointer"[];
      result: "void";
    }>
  > = new Map();
  /** Commands queued before the page signalled it was ready. */
  #queue: Command[] = [];
  /** In-flight commands awaiting a result, keyed by command id. */
  #pending: Map<number, Pending> = new Map();
  /** Monotonic command factory shared by all automation methods. */
  #nextCommand = createCommandFactory();
  /** Whether the current document has signalled readiness. */
  #ready = false;
  /** Whether to terminate the native loop once {@link #pending} drains. */
  #closeWhenIdle = false;
  /** The injected runtime source for this instance. */
  #injected: string;

  /** **UNSAFE**: Highly unsafe API, beware!
   *
   * An unsafe pointer to the webview
   */
  get unsafeHandle(): Deno.PointerValue {
    return this.#handle;
  }

  /** **UNSAFE**: Highly unsafe API, beware!
   *
   * An unsafe pointer to the webviews platform specific native window handle.
   * When using GTK backend the pointer is `GtkWindow` pointer, when using Cocoa
   * backend the pointer is `NSWindow` pointer, when using Win32 backend the
   * pointer is `HWND` pointer.
   */
  get unsafeWindowHandle(): Deno.PointerValue {
    return lib.symbols.webview_get_window(this.#handle);
  }

  /**
   * Sets the native window size
   *
   * ## Example
   *
   * ```ts ignore
   * import { Denotron, SizeHint } from "../mod.ts";
   *
   * const webview = new Denotron();
   * webview.navigate("https://deno.land/");
   *
   * // Change from the default size to a small fixed window
   * webview.size = {
   *   width: 200,
   *   height: 200,
   *   hint: SizeHint.FIXED
   * };
   *
   * webview.run();
   * ```
   */
  set size(
    { width, height, hint }: Size,
  ) {
    lib.symbols.webview_set_size(this.#handle, width, height, hint);
  }

  /**
   * Sets the native window title
   *
   * ## Example
   *
   * ```ts ignore
   * import { Denotron } from "../mod.ts";
   *
   * const webview = new Denotron();
   * webview.navigate("https://deno.land/");
   *
   * // Set the window title to "Hello world!"
   * webview.title = "Hello world!";
   *
   * webview.run();
   * ```
   */
  set title(title: string) {
    lib.symbols.webview_set_title(this.#handle, encodeCString(title));
  }

  /** **UNSAFE**: Highly unsafe API, beware!
   *
   * Creates a new webview instance from a webview handle.
   *
   * @param handle A previously created webview instances handle
   */
  constructor(handle: Deno.PointerValue);
  /**
   * Creates a new webview instance.
   *
   * ## Example
   *
   * ```ts ignore
   * import { Denotron, SizeHint } from "../mod.ts";
   *
   * // Create a new webview and change from the default size to a small fixed window
   * const webview = new Denotron(true, {
   *   width: 200,
   *   height: 200,
   *   hint: SizeHint.FIXED
   * });
   *
   * webview.navigate("https://deno.land/");
   * webview.run();
   * ```
   *
   * @param debug Defaults to false, when true developer tools are enabled
   * for supported platforms
   * @param size The window size, default to 1024x768 with no size hint. Set
   * this to undefined if you do not want to automatically resize the window.
   * This may cause issues for MacOS where the window is invisible until
   * resized.
   * @param window **UNSAFE**: Highly unsafe API, beware! An unsafe pointer to
   * the platforms specific native window handle. If null or undefined a new
   * window is created. If it's non-null - then child WebView is embedded into
   * the given parent window. Otherwise a new window is created. Depending on
   * the platform, a `GtkWindow`, `NSWindow` or `HWND` pointer can be passed
   * here.
   */
  constructor(
    debug?: boolean,
    size?: Size,
    window?: Deno.PointerValue | null,
  );
  constructor(
    debugOrHandle: boolean | Deno.PointerValue = false,
    size: Size | undefined = { width: 1024, height: 768, hint: SizeHint.NONE },
    window: Deno.PointerValue | null = null,
  ) {
    this.#handle =
      typeof debugOrHandle === "bigint" || typeof debugOrHandle === "number"
        ? debugOrHandle
        : lib.symbols.webview_create(
          Number(debugOrHandle),
          window,
        );

    if (size !== undefined) {
      this.size = size;
    }

    // Push this instance to the global instances list to automatically destroy
    instances.push(this);

    const debug = debugOrHandle === true;
    this.#injected = buildInjected({ overlay: debug });
    lib.symbols.webview_init(this.#handle, encodeCString(this.#injected));

    // Logging bridge from the page runtime to the Deno console.
    this.bind("denotronLog", (...args: never) => console.log(...args as []));

    // The page calls this once it is ready; flush any queued commands.
    this.bind("denotronReady", () => {
      this.#ready = true;
      if (this.#queue.length > 0) {
        const commands = this.#queue;
        this.#queue = [];
        this.#send(commands);
      }
    });

    // Result channel: the page runtime resolves commands by id through this.
    this.bind(
      "__denotronResolve",
      (id: number, status: number, payload: unknown) => {
        const pending = this.#pending.get(id);
        if (!pending) return;
        this.#pending.delete(id);
        const decoded = decodeResult(status, payload);
        if (decoded instanceof Error) pending.reject(decoded);
        else pending.resolve(decoded);
        this.#maybeClose();
      },
    );
  }

  /**
   * Destroys the webview and closes the window along with freeing all internal
   * resources.
   */
  destroy() {
    // Reject any commands that never received a result so awaiters do not hang.
    for (const pending of this.#pending.values()) {
      pending.reject(
        new DenotronError("Webview destroyed before command resolved"),
      );
    }
    this.#pending.clear();
    this.#queue = [];

    for (const name of this.#callbacks.keys()) {
      this.unbind(name);
    }
    lib.symbols.webview_terminate(this.#handle);
    lib.symbols.webview_destroy(this.#handle);
    this.#handle = null;
  }

  /**
   * Navigates webview to the given URL. URL may be a data URI, i.e.
   * `"data:text/html,<html>...</html>"`. It is often ok not to url-encodeCString it
   * properly, webview will re-encodeCString it for you.
   */
  navigate(url: URL | string) {
    lib.symbols.webview_navigate(
      this.#handle,
      encodeCString(url instanceof URL ? url.toString() : url),
    );
  }

  /**
   * Runs the main event loop until it's terminated. After this function exits
   * the webview is automatically destroyed.
   *
   * This call **blocks** the Deno thread until the window closes (or, with
   * {@link RunOptions.closeWhenIdle}, until every queued automation command has
   * resolved). Because the loop blocks, automation command Promises returned by
   * {@link Denotron.see}, {@link Denotron.getText} and friends settle while
   * `run` is executing; `await` them after `run` returns.
   *
   * ## Example
   *
   * ```ts ignore
   * import { Denotron } from "../mod.ts";
   *
   * const webview = new Denotron();
   * webview.navigate("https://deno.land/");
   * const heading = webview.getText("h1");
   * webview.run({ closeWhenIdle: true });
   * console.log(await heading);
   * ```
   */
  run(options: RunOptions = {}): void {
    this.#closeWhenIdle = options.closeWhenIdle ?? false;
    lib.symbols.webview_run(this.#handle);
    this.destroy();
  }

  /**
   * Terminates the native event loop, causing a blocked {@link Denotron.run}
   * call to return.
   */
  terminate(): void {
    lib.symbols.webview_terminate(this.#handle);
  }

  /**
   * Binds a callback so that it will appear in the webview with the given name
   * as a global async JavaScript function. Callback receives a seq and req value.
   * The seq parameter is an identifier for using {@link Denotron.return} to
   * return a value while the req parameter is a string of an JSON array representing
   * the arguments passed from the JavaScript function call.
   *
   * @param name The name of the bound function
   * @param callback A callback which takes two strings as parameters: `seq`
   * and `req` and the passed {@link arg} pointer
   * @param arg A pointer which is going to be passed to the callback once called
   */
  bindRaw(
    name: string,
    callback: (
      seq: string,
      req: string,
      arg: Deno.PointerValue | null,
    ) => void,
    arg: Deno.PointerValue | null = null,
  ) {
    const callbackResource = new Deno.UnsafeCallback(
      {
        parameters: ["pointer", "pointer", "pointer"],
        result: "void",
      },
      (
        seqPtr: Deno.PointerValue,
        reqPtr: Deno.PointerValue,
        arg: Deno.PointerValue | null,
      ) => {
        const seq = seqPtr
          ? new Deno.UnsafePointerView(seqPtr).getCString()
          : "";
        const req = reqPtr
          ? new Deno.UnsafePointerView(reqPtr).getCString()
          : "";
        callback(seq, req, arg);
      },
    );
    this.#callbacks.set(name, callbackResource);
    lib.symbols.webview_bind(
      this.#handle,
      encodeCString(name),
      callbackResource.pointer,
      arg,
    );
  }

  /**
   * Binds a callback so that it will appear in the webview with the given name
   * as a global async JavaScript function. Callback arguments are automatically
   * converted from json to as closely as possible match the arguments in the
   * webview context and the callback automatically converts and returns the
   * return value to the webview.
   *
   * @param name The name of the bound function
   * @param callback A callback which is passed the arguments as called from the
   * webview JavaScript environment and optionally returns a value to the
   * webview JavaScript caller
   *
   * ## Example
   * ```ts ignore
   * import { Denotron } from "../mod.ts";
   *
   * const html = `
   *   <html>
   *   <body>
   *     <h1>Hello from deno v${Deno.version.deno}</h1>
   *     <button onclick="press('I was pressed!', 123, new Date()).then(log);">
   *       Press me!
   *     </button>
   *   </body>
   *   </html>
   * `;
   *
   * const webview = new Denotron();
   *
   * webview.navigate(`data:text/html,${encodeURIComponent(html)}`);
   *
   * let counter = 0;
   * // Create and bind `press` to the webview javascript instance.
   * // This functions in addition to logging its parameters also returns
   * // a value from deno land to webview land.
   * webview.bind("press", (a, b, c) => {
   *   console.log(a, b, c);
   *
   *   return { times: counter++ };
   * });
   *
   * // Bind the `log` function in the webview to the parent instances `console.log`
   * webview.bind("log", (...args) => console.log(...args));
   *
   * webview.run();
   * ```
   */
  bind(
    name: string,
    // deno-lint-ignore no-explicit-any
    callback: (...args: any) => any,
  ) {
    this.bindRaw(name, (seq, req) => {
      const args = JSON.parse(req);
      let result;
      let success: boolean;
      try {
        result = callback(...args);
        success = true;
      } catch (err) {
        result = err;
        success = false;
      }
      if (result instanceof Promise) {
        result.then((result) =>
          this.return(seq, success ? 0 : 1, JSON.stringify(result))
        );
      } else {
        this.return(seq, success ? 0 : 1, JSON.stringify(result));
      }
    });
  }

  /**
   * Unbinds a previously bound function freeing its resource and removing it
   * from the webview JavaScript context.
   *
   * @param name The name of the bound function
   */
  unbind(name: string) {
    lib.symbols.webview_unbind(this.#handle, encodeCString(name));
    this.#callbacks.get(name)?.close();
    this.#callbacks.delete(name);
  }

  /**
   * Returns a value to the webview JavaScript environment.
   *
   * @param seq The request pointer as provided by the {@link Denotron.bindRaw}
   * callback
   * @param status If status is zero the result is expected to be a valid JSON
   * result value otherwise the result is an error JSON object
   * @param result The stringified JSON response
   */
  return(seq: string, status: number, result: string) {
    lib.symbols.webview_return(
      this.#handle,
      encodeCString(seq),
      status,
      encodeCString(result),
    );
  }

  /**
   * Evaluates arbitrary JavaScript code. Evaluation happens asynchronously,
   * also the result of the expression is ignored. Use
   * {@link Denotron.bind bindings} if you want to receive notifications about
   * the results of the evaluation.
   */
  eval(source: string) {
    lib.symbols.webview_eval(this.#handle, encodeCString(source));
  }

  /**
   * Injects JavaScript code at the initialization of the new page. Every time
   * the webview will open a new page - this initialization code will be
   * executed. It is guaranteed that code is executed before window.onload.
   */
  inject(source: string) {
    lib.symbols.webview_init(this.#handle, encodeCString(source));
  }

  // ---------------------------------------------------------------------------
  // Automation API
  //
  // Each method enqueues a command for the page runtime and returns a Promise
  // that resolves with the command's result. Because {@link Denotron.run}
  // blocks, await these Promises *after* `run` returns (see its docs).
  // ---------------------------------------------------------------------------

  /** Clicks the first element matching `selector`, waiting for it to appear. */
  click(selector: string, options: { timeout?: number } = {}): Promise<void> {
    return this.#enqueue("click", [selector], options.timeout) as Promise<void>;
  }

  /**
   * Types `text` into `selector`, dispatching realistic input events.
   *
   * @param options.clear Empty the field before typing.
   * @param options.delay Milliseconds to wait between keystrokes.
   */
  type(
    selector: string,
    text: string,
    options: { clear?: boolean; delay?: number; timeout?: number } = {},
  ): Promise<void> {
    return this.#enqueue(
      "type",
      [selector, text, { clear: options.clear, delay: options.delay }],
      options.timeout,
    ) as Promise<void>;
  }

  /**
   * Fills `selector` with `text`, clearing it first.
   *
   * Kept for backwards compatibility; equivalent to
   * `type(selector, text, { clear: true })`.
   */
  fill(selector: string, text: string): Promise<void> {
    return this.type(selector, text, { clear: true });
  }

  /** Dispatches a keyboard event for `key` on `selector`. */
  press(
    selector: string,
    key: string,
    options: { timeout?: number } = {},
  ): Promise<void> {
    return this.#enqueue("press", [selector, key], options.timeout) as Promise<
      void
    >;
  }

  /** Selects one or more option values in a `<select>` element. */
  select(
    selector: string,
    value: string | string[],
    options: { timeout?: number } = {},
  ): Promise<void> {
    return this.#enqueue(
      "select",
      [selector, value],
      options.timeout,
    ) as Promise<void>;
  }

  /** Sets the checked state of a checkbox or radio input. */
  check(
    selector: string,
    checked = true,
    options: { timeout?: number } = {},
  ): Promise<void> {
    return this.#enqueue(
      "check",
      [selector, checked],
      options.timeout,
    ) as Promise<void>;
  }

  /** Scrolls `selector` into view. */
  scroll(
    selector: string,
    options: ScrollOptions & { timeout?: number } = {},
  ): Promise<void> {
    const { timeout, ...scroll } = options;
    return this.#enqueue("scroll", [selector, scroll], timeout) as Promise<
      void
    >;
  }

  /** Waits for `selector` and resolves with its text content. */
  see(selector: string, options: { timeout?: number } = {}): Promise<string> {
    return this.#enqueue("see", [selector], options.timeout) as Promise<string>;
  }

  /** Resolves with the text content of `selector`. */
  getText(
    selector: string,
    options: { timeout?: number } = {},
  ): Promise<string> {
    return this.#enqueue("getText", [selector], options.timeout) as Promise<
      string
    >;
  }

  /** Resolves with the `value` of a form control matching `selector`. */
  getValue(
    selector: string,
    options: { timeout?: number } = {},
  ): Promise<string> {
    return this.#enqueue("getValue", [selector], options.timeout) as Promise<
      string
    >;
  }

  /** Resolves with an attribute value, or `null` if the attribute is absent. */
  getAttribute(
    selector: string,
    name: string,
    options: { timeout?: number } = {},
  ): Promise<string | null> {
    return this.#enqueue(
      "getAttribute",
      [selector, name],
      options.timeout,
    ) as Promise<string | null>;
  }

  /** Resolves with whether any element currently matches `selector`. */
  exists(selector: string): Promise<boolean> {
    return this.#enqueue("exists", [selector]) as Promise<boolean>;
  }

  /** Resolves with the number of elements matching `selector`. */
  count(selector: string): Promise<number> {
    return this.#enqueue("count", [selector]) as Promise<number>;
  }

  /**
   * Waits for `selector` to reach the given state.
   *
   * @param options.state `"visible"` (default), `"attached"` or `"hidden"`.
   */
  waitFor(
    selector: string,
    options: { state?: "visible" | "attached" | "hidden"; timeout?: number } =
      {},
  ): Promise<void> {
    return this.#enqueue(
      "waitFor",
      [selector, { state: options.state }],
      options.timeout,
    ) as Promise<void>;
  }

  /**
   * Evaluates `code` in the page and resolves with its (JSON-serializable)
   * result. Unlike {@link Denotron.eval}, this returns the value to Deno-land.
   */
  evalInPage<T = unknown>(
    code: string,
    options: { timeout?: number } = {},
  ): Promise<T> {
    return this.#enqueue("evalInPage", [code], options.timeout) as Promise<T>;
  }

  /** Registers a pending command and dispatches or queues it for the page. */
  #enqueue(
    command: CommandName,
    args: unknown[],
    timeout = DEFAULT_TIMEOUT,
  ): Promise<unknown> {
    const cmd = this.#nextCommand(command, args, timeout);
    const promise = new Promise<unknown>((resolve, reject) => {
      this.#pending.set(cmd.id, { resolve, reject });
    });
    if (this.#ready) this.#send([cmd]);
    else this.#queue.push(cmd);
    return promise;
  }

  /** Sends commands to the page runtime for sequential execution. */
  #send(commands: Command[]): void {
    lib.symbols.webview_eval(
      this.#handle,
      encodeCString(`window.__denotronExec(${JSON.stringify(commands)});`),
    );
  }

  /** Terminates the loop when idle, if {@link RunOptions.closeWhenIdle} was set. */
  #maybeClose(): void {
    if (
      this.#closeWhenIdle && this.#ready && this.#pending.size === 0 &&
      this.#queue.length === 0
    ) {
      this.terminate();
    }
  }
}
