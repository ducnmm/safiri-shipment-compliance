import { describe, expect, it } from 'vitest';
import { parseCsv } from '../src/csv.js';

describe('parseCsv', () => {
  it('parses a simple table into keyed records', () => {
    const rows = parseCsv('a,b\n1,2\n3,4');
    expect(rows).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });

  it('honors quoted fields containing commas', () => {
    const rows = parseCsv('name,note\n"Acme, Inc.",hello');
    expect(rows[0]).toEqual({ name: 'Acme, Inc.', note: 'hello' });
  });

  it('unescapes doubled quotes inside a quoted field', () => {
    const rows = parseCsv('q\n"she said ""hi"""');
    expect(rows[0]?.q).toBe('she said "hi"');
  });

  it('tolerates CRLF line endings and a trailing newline', () => {
    const rows = parseCsv('a,b\r\n1,2\r\n');
    expect(rows).toEqual([{ a: '1', b: '2' }]);
  });

  it('returns empty for header-only or blank input', () => {
    expect(parseCsv('a,b\n')).toEqual([]);
    expect(parseCsv('')).toEqual([]);
  });
});
