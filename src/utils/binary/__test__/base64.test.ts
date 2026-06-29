import { describe, it, expect } from 'bun:test';
import { base64ToUint8Array, uint8ArrayToBase64 } from '../base64';

describe('base64 utils', () => {
  it('roundtrips a UTF-8 string via TextEncoder/TextDecoder', () => {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const text = 'Hello, Bun! こんにちは';
    const bytes = encoder.encode(text);
    const b64 = uint8ArrayToBase64(bytes);
    const out = base64ToUint8Array(b64);
    expect(new Uint8Array(out)).toEqual(bytes);
    expect(decoder.decode(out)).toBe(text);
  });

  it('accepts data URI prefixes', () => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode('hi');
    const b64 = uint8ArrayToBase64(bytes);
    const dataUri = `data:application/octet-stream;base64,${b64}`;
    const out = base64ToUint8Array(dataUri);
    expect(out).toEqual(bytes);
  });

  it("matches known base64 for 'hello'", () => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode('hello');
    const b64 = uint8ArrayToBase64(bytes);
    expect(b64).toBe('aGVsbG8=');
    const out = base64ToUint8Array('aGVsbG8=');
    expect(out).toEqual(bytes);
  });
});
