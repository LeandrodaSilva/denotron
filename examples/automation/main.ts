import { SizeHint, Webview } from "../../mod.ts";

const webview = new Webview(false, {
  width: 1024,
  height: 768,
  hint: SizeHint.FIXED,
});

webview.navigate("https://dev.matriculadigital.seb.com.br");

webview.see("#cpf");

webview.fill("#cpf", "40265693810");

webview.see("#senha");

webview.fill("#senha", "123");

webview.see("#btnLogin");

webview.click("#btnLogin");

webview.run();
