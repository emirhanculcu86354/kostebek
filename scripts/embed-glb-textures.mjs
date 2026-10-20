// Embed external texture files (e.g. Kenney's shared "Textures/colormap.png") into a GLB so every
// model in public/assets/models/ is self-contained and kits with same-named textures don't clash.
// Usage: node scripts/embed-glb-textures.mjs <input.glb> <output.glb>
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('Usage: node scripts/embed-glb-textures.mjs <input.glb> <output.glb>');
  process.exit(1);
}

const glb = readFileSync(input);
if (glb.readUInt32LE(0) !== 0x46546c67) throw new Error(`${input} is not a GLB file`);
const jsonLen = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'));
let bin = Buffer.alloc(0);
const binStart = 20 + jsonLen;
if (binStart < glb.length) {
  const binLen = glb.readUInt32LE(binStart);
  bin = glb.subarray(binStart + 8, binStart + 8 + binLen);
}

const pad4 = (b, fill) => (b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - (b.length % 4), fill)]) : b);
const chunks = [pad4(bin, 0)];
let offset = chunks[0].length;
json.bufferViews ??= [];

for (const image of json.images ?? []) {
  if (!image.uri || image.uri.startsWith('data:')) continue;
  const data = readFileSync(resolve(dirname(input), decodeURIComponent(image.uri)));
  json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.length });
  image.bufferView = json.bufferViews.length - 1;
  image.mimeType = image.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  delete image.uri;
  const padded = pad4(data, 0);
  chunks.push(padded);
  offset += padded.length;
}

const newBin = Buffer.concat(chunks);
json.buffers = [{ byteLength: newBin.length }];
const jsonBuf = pad4(Buffer.from(JSON.stringify(json), 'utf8'), 0x20);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + newBin.length, 8);
const chunkHeader = (len, type) => {
  const h = Buffer.alloc(8);
  h.writeUInt32LE(len, 0);
  h.writeUInt32LE(type, 4);
  return h;
};
writeFileSync(
  output,
  Buffer.concat([header, chunkHeader(jsonBuf.length, 0x4e4f534a), jsonBuf, chunkHeader(newBin.length, 0x004e4942), newBin]),
);
console.log(`${output}: ${json.images?.length ?? 0} image(s) embedded`);
