import fs from 'fs';

export type DetectedImage = { mime: 'image/jpeg' | 'image/png' | 'image/webp'; ext: '.jpg' | '.png' | '.webp' };

// Detecta el tipo REAL de imagen por sus primeros bytes (el mimetype y la extensión
// que declara el cliente no son confiables).
export function detectImageType(header: Buffer): DetectedImage | null {
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return { mime: 'image/jpeg', ext: '.jpg' };
  }
  if (
    header.length >= 8 &&
    header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { mime: 'image/png', ext: '.png' };
  }
  if (
    header.length >= 12 &&
    header.subarray(0, 4).toString('ascii') === 'RIFF' &&
    header.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mime: 'image/webp', ext: '.webp' };
  }
  return null;
}

export function detectImageFileType(filePath: string): DetectedImage | null {
  const fd = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(12);
    fs.readSync(fd, header, 0, 12, 0);
    return detectImageType(header);
  } finally {
    fs.closeSync(fd);
  }
}
