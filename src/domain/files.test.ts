import { describe, expect, it } from 'vitest';
import { MAX_FILE_NAME_CHARS, downloadContentType, normalizeContentType, normalizeFileName } from './files';

describe('upload file names', () => {
  it('caps the length by code point without splitting emoji', () => {
    const name = normalizeFileName(`${'F'.repeat(254)}🧪🧪.csv`);
    expect(Array.from(name)).toHaveLength(MAX_FILE_NAME_CHARS);
    expect(name.endsWith('🧪')).toBe(true);
    expect(normalizeFileName('F'.repeat(100_000))).toHaveLength(MAX_FILE_NAME_CHARS);
  });

  it('drops control characters and unpaired surrogates', () => {
    expect(normalizeFileName('plate\u0000map\r\n.csv')).toBe('platemap.csv');
    expect(normalizeFileName('a\uD800b.txt')).toBe('ab.txt');
    expect(normalizeFileName('\u0001\u0002')).toBe('upload');
  });
});

describe('upload content types', () => {
  it('keeps only a well-formed type/subtype, lower-cased', () => {
    expect(normalizeContentType('text/html; charset=utf-7')).toBe('text/html');
    expect(normalizeContentType('TEXT/CSV')).toBe('text/csv');
    expect(normalizeContentType('text/' + 'a'.repeat(5000))).toBe('application/octet-stream');
    expect(normalizeContentType('not a type')).toBe('application/octet-stream');
  });

  it('serves anything a browser would run as opaque bytes', () => {
    for (const type of ['text/html', 'image/svg+xml', 'application/xhtml+xml', 'text/xml', 'application/javascript', 'text/x-javascript', 'text/ecmascript', 'text/jscript', 'text/css', 'text/xsl', 'image/x-unknown']) {
      expect(downloadContentType(type)).toBe('application/octet-stream');
    }
    expect(downloadContentType('image/png')).toBe('image/png');
    expect(downloadContentType('text/csv')).toBe('text/csv');
    expect(downloadContentType('application/pdf')).toBe('application/pdf');
  });
});
