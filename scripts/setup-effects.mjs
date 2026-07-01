/**
 * Populate public/mediapipe/ with the assets the background-effects processor needs, so
 * they're served from the operator's own origin instead of a third-party CDN (Hearth
 * privacy guardrail: no phone-home / no third-party calls at runtime).
 *
 * Run once after `npm install` (and as part of building a self-host bundle):
 *   npm run setup:effects
 *
 * This does a one-time fetch of the segmentation model at SETUP time; nothing is fetched
 * from a third party while meetings run. For air-gapped builds, pre-place the .tflite.
 */
import {
  mkdirSync,
  copyFileSync,
  existsSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wasmSrc = join(root, "node_modules/@mediapipe/tasks-vision/wasm");
const wasmDest = join(root, "public/mediapipe/tasks-vision");
const modelDest = join(root, "public/mediapipe/selfie_segmenter.tflite");
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";

if (!existsSync(wasmSrc)) {
  console.error("MediaPipe wasm not found — run `npm install` first.");
  process.exit(1);
}

mkdirSync(wasmDest, { recursive: true });
let copied = 0;
for (const f of readdirSync(wasmSrc)) {
  copyFileSync(join(wasmSrc, f), join(wasmDest, f));
  copied++;
}
console.log(`Copied ${copied} MediaPipe wasm file(s) -> public/mediapipe/tasks-vision`);

if (existsSync(modelDest)) {
  console.log("Segmentation model already present — skipping download.");
} else {
  process.stdout.write("Downloading selfie-segmenter model ... ");
  const res = await fetch(MODEL_URL);
  if (!res.ok) {
    console.error(`\nModel download failed: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  writeFileSync(modelDest, Buffer.from(await res.arrayBuffer()));
  console.log("done -> public/mediapipe/selfie_segmenter.tflite");
}
