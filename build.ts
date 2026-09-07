import tailwind from "bun-plugin-tailwind";
import { copyFile, rm } from "node:fs/promises";
import path from "node:path";
import { paseoRelayExportWorkaround } from "./src/lib/paseo/relay-export-workaround";

const outdir = path.join(process.cwd(), "dist");
await rm(outdir, { recursive: true, force: true });

const entrypoints = [...new Bun.Glob("src/**/*.html").scanSync()];

const result = await Bun.build({
  entrypoints,
  outdir,
  plugins: [tailwind, paseoRelayExportWorkaround],
  minify: true,
  target: "browser",
  sourcemap: "linked",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});

for (const asset of [
  "manifest.json",
  "logo.svg",
  "favicon.ico",
  "favicon-16.png",
  "favicon-32.png",
  "favicon-48.png",
  "apple-touch-icon.png",
  "icon-192.png",
  "icon-512.png",
]) {
  await copyFile(
    path.resolve(process.cwd(), "src", asset),
    path.join(outdir, asset),
  );
}

for (const output of result.outputs) {
  console.log(` ${path.relative(process.cwd(), output.path)}  ${(output.size / 1024).toFixed(1)} KB`);
}
