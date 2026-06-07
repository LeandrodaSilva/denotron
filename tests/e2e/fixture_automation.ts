/**
 * Automation fixture driven by the e2e test as a subprocess.
 *
 * It runs a full automation scenario against a real webview and prints a single
 * `RESULT=<json>` line to stdout. It lives in its own process because tearing a
 * native WebKit/GTK webview down inside the `deno test` runner aborts the
 * process on exit (SIGABRT); a plain `deno run` exits cleanly.
 */
import { Denotron, DenotronElementNotFoundError } from "../../mod.ts";

const PAGE =
  `<!doctype html><html><head><title>Denotron E2E</title></head><body>
<h1 id="title">Hello Denotron</h1>
<input id="name" value="" />
<select id="color"><option value="r">Red</option><option value="g">Green</option></select>
<input type="checkbox" id="agree" />
<button id="btn" onclick="document.getElementById('title').textContent='Clicked!'">Go</button>
<p class="item">a</p><p class="item">b</p>
<div id="late"></div>
<script>
  setTimeout(function () {
    document.getElementById('late').innerHTML = '<span id="appeared">now</span>';
  }, 300);
</script>
</body></html>`;

const wv = new Denotron(false);
wv.navigate("data:text/html," + encodeURIComponent(PAGE));

// Flat, ordered queue: executes sequentially in the page before run returns.
const title = wv.see("#title");
const hasName = wv.exists("#name");
const hasNope = wv.exists("#nope");
const items = wv.count(".item");
wv.fill("#name", "denotron");
const value = wv.getValue("#name");
wv.check("#agree");
const checked = wv.evalInPage<boolean>(
  "document.getElementById('agree').checked",
);
wv.select("#color", "g");
const selected = wv.getValue("#color");
wv.click("#btn");
const afterClick = wv.getText("#title");
const attr = wv.getAttribute("#name", "id");
const evald = wv.evalInPage<number>("1 + 2 + 3");
wv.waitFor("#appeared");
const waited = wv.getText("#appeared");
const timedOut = wv.see("#missing", { timeout: 500 }).then(
  () => "NONE",
  (e) => (e instanceof DenotronElementNotFoundError ? e.name : "WRONG"),
);

wv.run({ closeWhenIdle: true });

const result = {
  title: await title,
  hasName: await hasName,
  hasNope: await hasNope,
  items: await items,
  value: await value,
  checked: await checked,
  selected: await selected,
  afterClick: await afterClick,
  attr: await attr,
  evald: await evald,
  waited: await waited,
  timedOut: await timedOut,
};

console.log("RESULT=" + JSON.stringify(result));
