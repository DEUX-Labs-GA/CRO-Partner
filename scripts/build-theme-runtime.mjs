import { build } from "esbuild";

await build({
  entryPoints: [
    "extensions/cro-partner-pdp-experiments/assets/cro-partner-runtime.js",
  ],
  outfile:
    "extensions/cro-partner-pdp-experiments/assets/cro-partner-runtime.min.js",
  minify: true,
  bundle: false,
  platform: "browser",
  target: ["es2020"],
});

console.log("Built minified CRO Partner theme runtime.");
