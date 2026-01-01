import { build } from "bun";

console.log("Building frontend...");

const result = await build({
  entrypoints: ["./src/frontend.tsx"],
  outdir: "./public",
  target: "browser",
});

if (!result.success) {
  console.error("Build failed:", result);
  process.exit(1);
}

console.log("Frontend build complete!");
