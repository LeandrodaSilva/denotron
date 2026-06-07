/**
 * End-to-end automation test that opens a real native webview.
 *
 * Gated behind `DENOTRON_E2E=1` because it requires a display (use `xvfb-run`
 * on headless CI) and a locally built native library (`deno task build`).
 *
 * The actual automation runs in a `deno run` subprocess (see
 * `fixture_automation.ts`): driving a native WebKit/GTK webview to completion
 * inside the `deno test` runner aborts the process on teardown, whereas a plain
 * `deno run` exits cleanly. The test asserts on the fixture's printed results.
 */
import { assertEquals } from "@std/assert";

const enabled = Deno.env.get("DENOTRON_E2E") === "1";

Deno.test({
  name: "automation: ordered queue resolves values, waits, and times out",
  ignore: !enabled,
  async fn() {
    const fixture =
      new URL("./fixture_automation.ts", import.meta.url).pathname;
    const command = new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", "--unstable-ffi", fixture],
      stdout: "piped",
      stderr: "piped",
    });
    const { code, stdout, stderr } = await command.output();
    const out = new TextDecoder().decode(stdout);
    const err = new TextDecoder().decode(stderr);

    if (code !== 0) {
      throw new Error(
        `fixture exited with ${code}\nstdout:\n${out}\nstderr:\n${err}`,
      );
    }

    const line = out.split("\n").find((l) => l.startsWith("RESULT="));
    if (!line) throw new Error(`no RESULT line in fixture output:\n${out}`);
    const result = JSON.parse(line.slice("RESULT=".length));

    assertEquals(result, {
      title: "Hello Denotron",
      hasName: true,
      hasNope: false,
      items: 2,
      value: "denotron",
      checked: true,
      selected: "g",
      afterClick: "Clicked!",
      attr: "name",
      evald: 6,
      waited: "now",
      timedOut: "DenotronElementNotFoundError",
    });
  },
});
