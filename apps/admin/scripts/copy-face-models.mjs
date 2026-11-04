import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageModelDirectory = resolve(
  appRoot,
  "node_modules/@vladmandic/face-api/model",
);
const publicModelDirectory = resolve(appRoot, "public/models");

const modelFiles = [
  "tiny_face_detector_model-weights_manifest.json",
  "tiny_face_detector_model.bin",
];

await mkdir(publicModelDirectory, { recursive: true });

for (const filename of modelFiles) {
  const source = resolve(packageModelDirectory, filename);
  const destination = resolve(publicModelDirectory, filename);

  try {
    await copyFile(source, destination);
  } catch (error) {
    throw new Error(
      `Could not copy browser face model "${filename}" from "${packageModelDirectory}". ` +
        "Reinstall @vladmandic/face-api and rerun the Admin dev/build command.",
      { cause: error },
    );
  }
}

console.log("Copied Tiny Face Detector browser models into apps/admin/public/models.");
