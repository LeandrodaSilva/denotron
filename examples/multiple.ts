import { Denotron } from "../mod.ts";

const webview1 = new Denotron();
webview1.navigate("https://deno.land/");

const webview2 = new Denotron();
webview2.navigate("https://google.com/");

// NOTE: Due to design limitations, you can only have one webview
//       instance **at a time**
const p1 = webview1.run();
const p2 = webview2.run();

await Promise.all([p1, p2]);
