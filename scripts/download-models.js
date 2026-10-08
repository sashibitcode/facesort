import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetDir = path.resolve(__dirname, '../public/models');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const files = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model.bin',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model.bin',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model.bin'
];

const baseUrl = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model/';

async function download() {
  console.log(`Downloading face-api models to ${targetDir}...`);
  for (const file of files) {
    const dest = path.join(targetDir, file);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 100) {
      console.log(`✓ ${file} already exists (${(fs.statSync(dest).size / (1024 * 1024)).toFixed(2)} MB)`);
      continue;
    }
    console.log(`Downloading ${file}...`);
    const res = await fetch(baseUrl + file);
    if (!res.ok) {
      throw new Error(`Failed to download ${file}: ${res.statusText}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buffer);
    console.log(`✓ ${file} saved (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`);
  }
  console.log('All models downloaded successfully!');
}

download().catch(err => {
  console.error('Error downloading models:', err);
  process.exit(1);
});
