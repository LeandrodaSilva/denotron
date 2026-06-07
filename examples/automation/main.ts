import { Denotron, SizeHint } from "../../mod.ts";

const denotron = new Denotron(false, {
  width: 1024,
  height: 768,
  hint: SizeHint.FIXED,
});

denotron.navigate("https://deno.com/");

// Automation commands are queued in order and executed sequentially inside the
// page while `run()` drives the native loop. Because `run()` blocks, await the
// returned Promises *after* it returns (see the README "Automation" section).
denotron.waitFor("#search-str");
denotron.fill("#search-str", "denotron");
const value = denotron.getValue("#search-str");

// `closeWhenIdle` terminates the loop once every queued command has resolved.
denotron.run({ closeWhenIdle: true });

console.log("Typed into the search box:", await value);
