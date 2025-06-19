import { Denotron } from "../mod.ts";

const html = `
  <html>
  <body>
    <script>document.body.innerHTML = window.navigator.userAgent; </script>
  </body>
  </html>
`;

const webview = new Denotron();

webview.navigate(`data:text/html,${encodeURIComponent(html)}`);
webview.run();
