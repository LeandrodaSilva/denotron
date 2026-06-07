/**
 * End-to-end automation tests that open a real native webview.
 *
 * These are gated behind the `DENOTRON_E2E=1` environment variable because they
 * require a display (use `xvfb-run` on headless CI) and a locally built native
 * library (`deno task build`, with `PLUGIN_URL=./build/`).
 */
import { assertEquals, assertInstanceOf } from "@std/assert";
import { Denotron, DenotronElementNotFoundError } from "../../mod.ts";

const enabled = Deno.env.get("DENOTRON_E2E") === "1";

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

Deno.test({
  name: "automation: ordered queue resolves values, waits, and times out",
  ignore: !enabled,
  // The native callbacks keep ops/resources open until run() returns.
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
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
      () => null,
      (e) => e,
    );

    wv.run({ closeWhenIdle: true });

    assertEquals(await title, "Hello Denotron");
    assertEquals(await hasName, true);
    assertEquals(await hasNope, false);
    assertEquals(await items, 2);
    assertEquals(await value, "denotron");
    assertEquals(await checked, true);
    assertEquals(await selected, "g");
    assertEquals(await afterClick, "Clicked!");
    assertEquals(await attr, "name");
    assertEquals(await evald, 6);
    assertEquals(await waited, "now");
    assertInstanceOf(await timedOut, DenotronElementNotFoundError);
  },
});
