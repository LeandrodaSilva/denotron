import { dirname, join } from "https://deno.land/std@0.157.0/path/mod.ts";
import { Denotron } from "../../mod.ts";

const worker = new Worker(
  join(dirname(import.meta.url), "worker.tsx"),
  { type: "module" },
);

const denotron = new Denotron();
denotron.navigate("http://localhost:8000/");

console.log("[runner] worker started");
denotron.run();
worker.terminate();
