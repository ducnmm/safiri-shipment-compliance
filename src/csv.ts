/**
 * Minimal RFC-4180-style CSV parser: comma-delimited, double-quoted fields with
 * "" escaping, tolerant of both LF and CRLF line endings. Returns the header row
 * and each data row as an object keyed by header. Enough for bulk shipment
 * import without pulling in a dependency.
 */
export function parseCsv(text: string): Array<Record<string, string>> {
  const rows = splitRows(text).filter((cells) => !(cells.length === 1 && cells[0] === ''));
  if (rows.length === 0) return [];

  const headers = (rows[0] ?? []).map((h) => h.trim());
  const records: Array<Record<string, string>> = [];
  for (let r = 1; r < rows.length; r += 1) {
    const cells = rows[r] ?? [];
    const record: Record<string, string> = {};
    headers.forEach((header, i) => {
      record[header] = (cells[i] ?? '').trim();
    });
    records.push(record);
  }
  return records;
}

/** Split raw CSV text into rows of cells, honoring quoted fields. */
function splitRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1; // skip the escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char === '\r') {
      // ignore; the following \n terminates the row
    } else {
      cell += char;
    }
  }

  // Flush the final cell/row if the file doesn't end with a newline.
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
