# denotron

> ⚠️ This project is still in development. Expect breaking changes.

---

## Documentation

You can find the official documentation
[here](https://jsr.io/@webview/webview/doc).

## Development

### Prerequisites

#### Linux

- [webkit2gtk](https://webkitgtk.org/) (to install using apt:
  `sudo apt-get install libwebkit2gtk-4.0-dev`)

### Building

Make sure to init the webview submodule with:

```bash
$ git submodule update --init --recursive
```

Building on Windows requires admin privileges.

```bash
$ deno task build
```

### Running

To run webview_deno without automatically downloading the binaries from
[releases](https://github.com/webview/webview_deno/releases) you will need to
use the environment variable `PLUGIN_URL` and set it to the path where the built
binaries are located. This is usually `file://./target/release`.

```bash
$ deno task build
$ PLUGIN_URL=./build/
$ deno run --unstable -A examples/local.ts
```

or

```bash
$ deno task run examples/local.ts
```

or if you have the webview library already built and didn't make any changes to
it, you can skip the building step with:

```bash
$ deno task run:fast examples/local.ts
```

## Environment variables

- `PLUGIN_URL` - Set a custom library URL. Defaults to the latest release assets
  on Github. Setting this also disables cache for `plug`.

## Dependencies

- [plug](https://jsr.io/@denosaurs/plug)
- [webview](https://github.com/webview/webview)

## Other

### Licence

Copyright 2025, the denotron team. All rights reserved. MIT license.
