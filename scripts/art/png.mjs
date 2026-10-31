// Tiny PNG encoder/decoder for 8-bit RGBA images (Node only, no dependencies: node:zlib).
// Used by the Rig 2.0 golden tests (petdex/test/rig2.test.js) and the contact-sheet script (scripts/art/rig2-sheet.mjs).
import { deflateSync, inflateSync } from "node:zlib";

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** Encode { w, h, data } (RGBA, row-major) as a PNG buffer. Deterministic: same pixels give the same bytes. */
export function encodePng({ w, h, data }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    Buffer.from(data.buffer, data.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  return Buffer.concat([SIG, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Decode an 8-bit PNG (gray, RGB, palette, gray+alpha, RGBA; not interlaced) to { w, h, data: Uint8ClampedArray RGBA }. */
export function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error("not a PNG");
  let pos = 8;
  let w = 0;
  let h = 0;
  let type = 0;
  let depth = 0;
  let interlace = 0;
  let plte = null;
  let trns = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const t = buf.toString("ascii", pos + 4, pos + 8);
    const d = buf.subarray(pos + 8, pos + 8 + len);
    if (t === "IHDR") {
      w = d.readUInt32BE(0);
      h = d.readUInt32BE(4);
      depth = d[8];
      type = d[9];
      interlace = d[12];
    } else if (t === "PLTE") plte = d;
    else if (t === "tRNS") trns = d;
    else if (t === "IDAT") idat.push(d);
    else if (t === "IEND") break;
    pos += 12 + len;
  }
  if (depth !== 8 || interlace) throw new Error(`unsupported PNG (depth ${depth}, interlace ${interlace})`);
  const bpp = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  const stride = w * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
      const p = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paeth(a, b, c);
      px[y * stride + x] = (v + p) & 255;
    }
  }
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const s = i * bpp;
    let r;
    let g;
    let b;
    let a = 255;
    if (type === 6) [r, g, b, a] = [px[s], px[s + 1], px[s + 2], px[s + 3]];
    else if (type === 2) [r, g, b] = [px[s], px[s + 1], px[s + 2]];
    else if (type === 0) r = g = b = px[s];
    else if (type === 4) [r, g, b, a] = [px[s], px[s], px[s], px[s + 1]];
    else {
      const k = px[s];
      [r, g, b] = [plte[k * 3], plte[k * 3 + 1], plte[k * 3 + 2]];
      a = trns && k < trns.length ? trns[k] : 255;
    }
    data.set([r, g, b, a], i * 4);
  }
  return { w, h, data };
}
