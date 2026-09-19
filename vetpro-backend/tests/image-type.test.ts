import { describe, it, expect } from 'vitest';
import { detectImageType } from '../src/utils/image-type.js';

describe('detectImageType', () => {
  it('reconoce JPEG, PNG y WEBP por su contenido', () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))?.ext).toBe('.jpg');
    expect(detectImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))?.ext).toBe('.png');
    expect(detectImageType(Buffer.from('RIFF\x00\x00\x00\x00WEBP', 'binary'))?.ext).toBe('.webp');
  });

  it('rechaza HTML o texto aunque el cliente lo declare como imagen', () => {
    expect(detectImageType(Buffer.from('<html><script>alert(1)</script>'))).toBeNull();
    expect(detectImageType(Buffer.from('GIF89a......'))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});
