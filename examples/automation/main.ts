import { Denotron, SizeHint } from "../../mod.ts";

const denotron = new Denotron(false, {
  width: 1024,
  height: 768,
  hint: SizeHint.FIXED,
});

denotron.navigate("https://deno.com/");

denotron.see("#search-str");

denotron.fill("#search-str", "denotron");

denotron.run();
