/**
 * Page-side automation runtime injected into every webview document via
 * `webview_init` (see {@link Denotron}).
 *
 * The runtime runs entirely inside the webview's own JavaScript event loop,
 * which keeps spinning while the native `webview_run` loop blocks the Deno
 * thread. This is why all sequencing, waiting and timeouts live here rather
 * than in Deno-land: Deno microtasks do not drain during the blocking run, but
 * the page's do.
 *
 * Protocol:
 * - Deno calls `window.__denotronExec(commands)` (via `eval`) to enqueue work.
 * - The runtime executes commands sequentially, awaiting each one.
 * - Each result is reported back through the bound `window.__denotronResolve`
 *   function as `(id, status, payload)` where status is 0 (ok) or 1 (error).
 * - On document load the runtime calls the bound `window.denotronReady()` so
 *   Deno can flush any commands queued before the page existed.
 */

/** Options controlling the generated injected runtime. */
export interface InjectedOptions {
  /** When true, renders a small debug overlay tracking the mouse position. */
  overlay?: boolean;
}

/**
 * Builds the injected JavaScript runtime as a string suitable for
 * `webview_init`.
 *
 * @param options See {@link InjectedOptions}.
 * @returns the runtime source.
 */
export function buildInjected(options: InjectedOptions = {}): string {
  const overlay = options.overlay ? OVERLAY_SOURCE : "";
  return `(function () {
  if (window.__denotronInstalled) return;
  window.__denotronInstalled = true;

  var queue = [];
  var running = false;

  function report(id, status, value) {
    try {
      window.__denotronResolve(id, status, status === 0 ? (value === undefined ? null : value) : value);
    } catch (_) { /* deno side gone */ }
  }

  function makeError(e, name) {
    return {
      name: name || (e && e.name) || "DenotronError",
      message: (e && e.message) ? e.message : String(e),
    };
  }

  function isVisible(el) {
    return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  }

  // Waits for a selector to reach the desired state using MutationObserver,
  // rejecting with a timeout error instead of busy-waiting.
  function waitForSelector(selector, timeout, state) {
    state = state || "visible";
    return new Promise(function (resolve, reject) {
      function check() {
        var el = document.querySelector(selector);
        if (state === "attached") return el || null;
        if (state === "hidden") return (!el || !isVisible(el)) ? (el || true) : null;
        return (el && isVisible(el)) ? el : null;
      }
      var found = check();
      if (found) return resolve(found === true ? null : found);

      var done = false;
      function finish(fn, arg) {
        if (done) return;
        done = true;
        obs.disconnect();
        clearTimeout(timer);
        fn(arg);
      }
      var obs = new MutationObserver(function () {
        var f = check();
        if (f) finish(resolve, f === true ? null : f);
      });
      obs.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
      });
      var timer = setTimeout(function () {
        finish(reject, {
          __denotron: true,
          name: state === "hidden" ? "DenotronTimeoutError" : "DenotronElementNotFoundError",
          message: "Timed out after " + timeout + "ms waiting for selector \\"" + selector + "\\" (state: " + state + ")",
        });
      }, timeout);
    });
  }

  // Resolves to an element or throws a typed not-found error.
  function need(selector, timeout) {
    return waitForSelector(selector, timeout, "visible");
  }

  function delay(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  var handlers = {
    click: function (cmd) {
      return need(cmd.args[0], cmd.timeout).then(function (el) {
        el.focus();
        el.click();
        return null;
      });
    },
    type: function (cmd) {
      var selector = cmd.args[0];
      var text = String(cmd.args[1] == null ? "" : cmd.args[1]);
      var opts = cmd.args[2] || {};
      return need(selector, cmd.timeout).then(function (el) {
        el.focus();
        if (opts.clear) {
          if ("value" in el) el.value = "";
          else el.textContent = "";
        }
        var chars = text.split("");
        var i = 0;
        function next() {
          if (i >= chars.length) {
            el.dispatchEvent(new Event("change", { bubbles: true }));
            return null;
          }
          var ch = chars[i++];
          if ("setRangeText" in el && typeof el.selectionStart === "number") {
            var start = el.selectionStart;
            el.setRangeText(ch, start, start, "end");
          } else if ("value" in el) {
            el.value += ch;
          } else {
            el.textContent += ch;
          }
          el.dispatchEvent(new InputEvent("input", { bubbles: true, data: ch }));
          return opts.delay ? delay(opts.delay).then(next) : next();
        }
        return Promise.resolve().then(next);
      });
    },
    press: function (cmd) {
      return need(cmd.args[0], cmd.timeout).then(function (el) {
        var key = cmd.args[1];
        el.focus();
        ["keydown", "keypress", "keyup"].forEach(function (type) {
          el.dispatchEvent(new KeyboardEvent(type, { key: key, bubbles: true }));
        });
        return null;
      });
    },
    select: function (cmd) {
      return need(cmd.args[0], cmd.timeout).then(function (el) {
        var values = [].concat(cmd.args[1]);
        for (var i = 0; i < el.options.length; i++) {
          el.options[i].selected = values.indexOf(el.options[i].value) !== -1;
        }
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return null;
      });
    },
    check: function (cmd) {
      return need(cmd.args[0], cmd.timeout).then(function (el) {
        var checked = cmd.args[1] === undefined ? true : !!cmd.args[1];
        if (el.checked !== checked) el.click();
        return null;
      });
    },
    scroll: function (cmd) {
      return need(cmd.args[0], cmd.timeout).then(function (el) {
        el.scrollIntoView(cmd.args[1] || { behavior: "auto", block: "center" });
        return null;
      });
    },
    see: function (cmd) {
      return need(cmd.args[0], cmd.timeout).then(function (el) {
        return el.textContent;
      });
    },
    getText: function (cmd) {
      return need(cmd.args[0], cmd.timeout).then(function (el) {
        return el.textContent;
      });
    },
    getValue: function (cmd) {
      return need(cmd.args[0], cmd.timeout).then(function (el) {
        return "value" in el ? el.value : el.textContent;
      });
    },
    getAttribute: function (cmd) {
      return need(cmd.args[0], cmd.timeout).then(function (el) {
        return el.getAttribute(cmd.args[1]);
      });
    },
    exists: function (cmd) {
      return Promise.resolve(!!document.querySelector(cmd.args[0]));
    },
    count: function (cmd) {
      return Promise.resolve(document.querySelectorAll(cmd.args[0]).length);
    },
    waitFor: function (cmd) {
      var opts = cmd.args[1] || {};
      return waitForSelector(cmd.args[0], cmd.timeout, opts.state || "visible").then(function () {
        return null;
      });
    },
    evalInPage: function (cmd) {
      return Promise.resolve().then(function () {
        // deno-lint-ignore no-eval
        return eval(cmd.args[0]);
      });
    },
  };

  function execute(cmd) {
    var handler = handlers[cmd.command];
    if (!handler) {
      report(cmd.id, 1, makeError(new Error("Unknown command: " + cmd.command)));
      return Promise.resolve();
    }
    return Promise.resolve()
      .then(function () { return handler(cmd); })
      .then(function (value) { report(cmd.id, 0, value); })
      .catch(function (e) {
        var payload = (e && e.__denotron) ? { name: e.name, message: e.message } : makeError(e);
        report(cmd.id, 1, payload);
      });
  }

  function drain() {
    if (running) return;
    running = true;
    (function loop() {
      if (queue.length === 0) { running = false; return; }
      var cmd = queue.shift();
      execute(cmd).then(loop);
    })();
  }

  window.__denotronExec = function (commands) {
    for (var i = 0; i < commands.length; i++) queue.push(commands[i]);
    drain();
  };

  function signalReady() {
    try { window.denotronReady(); } catch (_) { /* deno side gone */ }
  }
  if (document.readyState === "complete") signalReady();
  else window.addEventListener("load", signalReady);
${overlay}
})();`;
}

/** Debug overlay source, appended only when {@link InjectedOptions.overlay} is set. */
const OVERLAY_SOURCE = `
  window.addEventListener("load", function () {
    var widget = document.createElement("div");
    widget.style.cssText = "position:fixed;bottom:10px;right:10px;background:rgba(0,0,0,0.5);color:#fff;padding:10px;border-radius:5px;z-index:2147483647;font:12px monospace";
    widget.textContent = "Denotron";
    document.body.appendChild(widget);
    document.addEventListener("mousemove", function (e) {
      widget.textContent = "Mouse: " + e.clientX + ", " + e.clientY;
    });
  });`;

/** Default injected runtime (no debug overlay). */
export const injected: string = buildInjected();

export default injected;
