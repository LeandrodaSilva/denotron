import { Denotron } from "../mod.ts";

const webview = new Denotron();
webview.navigate("https://deno.land/");
webview.run();
