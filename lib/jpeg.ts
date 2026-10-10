// Server-side check for announcement pictures. The phone already shrinks
// each picture into a fresh JPEG (which carries no location), but the server
// never trusts that: it re-walks the whole file and keeps only what draws the
// image. APP1–APP15 (EXIF with GPS, XMP, maker notes…) and comments are
// dropped wherever they sit; APP0 (JFIF) stays. Anything that isn't a
// well-formed JPEG is refused.

const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

export type CleanJpeg = { bytes: Buffer; width: number; height: number };

export function cleanJpeg(input: Buffer): CleanJpeg | null {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) return null;
  const kept: Buffer[] = [input.subarray(0, 2)];
  let width = 0;
  let height = 0;
  let scanned = false;
  let i = 2;
  while (i < input.length) {
    if (input[i] !== 0xff) return null;
    while (i < input.length && input[i] === 0xff) i++; // fill bytes
    if (i >= input.length) return null;
    const marker = input[i++];
    if (marker === 0xd9) {
      // End of image.
      if (!scanned || !width || !height) return null;
      kept.push(Buffer.from([0xff, 0xd9]));
      return { bytes: Buffer.concat(kept), width, height };
    }
    if (marker === 0x00 || marker === 0xd8) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      kept.push(Buffer.from([0xff, marker]));
      continue;
    }
    if (i + 2 > input.length) return null;
    const length = input.readUInt16BE(i);
    if (length < 2 || i + length > input.length) return null;
    const end = i + length;
    if (SOF.has(marker)) {
      if (length < 7) return null;
      height = input.readUInt16BE(i + 3);
      width = input.readUInt16BE(i + 5);
    }
    const metadata = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!metadata) kept.push(Buffer.from([0xff, marker]), input.subarray(i, end));
    i = end;
    if (marker === 0xda) {
      // Start of scan: image data runs to the next real marker (0xFF then
      // anything but 0x00 stuffing or a restart marker).
      scanned = true;
      const from = i;
      while (i < input.length) {
        if (input[i] === 0xff && i + 1 < input.length) {
          const next = input[i + 1];
          if (next !== 0x00 && !(next >= 0xd0 && next <= 0xd7) && next !== 0xff) break;
        }
        i++;
      }
      kept.push(input.subarray(from, i));
    }
  }
  return null;
}
