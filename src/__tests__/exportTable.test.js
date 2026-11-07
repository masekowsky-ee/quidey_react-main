import { describe, it, expect, vi, beforeEach } from 'vitest';

const toFile = vi.fn(() => Promise.resolve());
const writeExcelFile = vi.fn(() => ({ toFile }));
vi.mock('write-excel-file/browser', () => ({ default: writeExcelFile }));

import { toCsv, downloadXlsx, downloadCsv } from '../features/admin/exportTable';

const sheet = (columns, rows, name = 'S') => ({ name, columns, rows });

describe('toCsv', () => {
  it('starts with a BOM and uses ; and CRLF', () => {
    const csv = toCsv(sheet([{ key: 'a', label: 'A', type: 'string' }, { key: 'b', label: 'B', type: 'string' }], [{ a: 'x', b: 'y' }]), 'de');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toBe('\uFEFFA;B\r\nx;y');
  });
  it('uses decimal comma for de and point for en', () => {
    const s = sheet([{ key: 'n', label: 'N', type: 'number' }], [{ n: 1.5 }]);
    expect(toCsv(s, 'de')).toContain('\r\n1,5');
    expect(toCsv(s, 'en')).toContain('\r\n1.5');
  });
  it('quotes fields with ; " CR LF', () => {
    const s = sheet([{ key: 'a', label: 'A', type: 'string' }], [{ a: 'a;"b"' }, { a: 'l1\nl2' }]);
    const csv = toCsv(s, 'de');
    expect(csv).toContain('"a;""b"""');
    expect(csv).toContain('"l1\nl2"');
  });
  it('formats dates and datetimes', () => {
    const s = sheet([{ key: 'd', label: 'D', type: 'date' }, { key: 't', label: 'T', type: 'datetime' }], [
      { d: '2026-11-07', t: new Date(2026, 10, 7, 9, 5).toISOString() },
    ]);
    expect(toCsv(s, 'de')).toContain('\r\n2026-11-07;2026-11-07 09:05');
  });
  it('formats booleans and nulls', () => {
    const s = sheet([{ key: 'b', label: 'B', type: 'boolean' }, { key: 'x', label: 'X', type: 'string' }], [{ b: true, x: null }, { b: false, x: 'q' }]);
    expect(toCsv(s, 'de')).toContain('\r\nja;\r\nnein;q');
    expect(toCsv(s, 'en')).toContain('\r\nyes;\r\nno;q');
  });
});

describe('downloadXlsx', () => {
  beforeEach(() => { writeExcelFile.mockClear(); toFile.mockClear(); });
  it('writes six sheets in order under the given file name', async () => {
    const names = ['Übersicht', 'Tage', 'Funktionen', 'Bereiche', 'Plattformen', 'Sprachen'];
    const sheets = names.map(n => sheet([{ key: 'a', label: 'A', type: 'string', width: 12 }], [{ a: 'x' }], n));
    await downloadXlsx(sheets, 'nutzung.xlsx');
    expect(writeExcelFile).toHaveBeenCalledTimes(1);
    const arg = writeExcelFile.mock.calls[0][0];
    expect(arg.map(s => s.sheet)).toEqual(names);
    expect(toFile).toHaveBeenCalledWith('nutzung.xlsx');
  });
  it('builds bold header, typed cells and widths', async () => {
    const s = sheet([
      { key: 's', label: 'S', type: 'string', width: 20 },
      { key: 'n', label: 'N', type: 'number' },
      { key: 'd', label: 'D', type: 'date' },
      { key: 'b', label: 'B', type: 'boolean' },
    ], [{ s: 'x', n: 2, d: '2026-11-07', b: true }, { s: null, n: null, d: null, b: null }]);
    await downloadXlsx([s], 'f.xlsx');
    const { data, columns } = writeExcelFile.mock.calls[0][0][0];
    expect(data[0][0]).toMatchObject({ value: 'S', fontWeight: 'bold' });
    expect(data[1][1]).toMatchObject({ value: 2, type: Number });
    expect(data[1][2].type).toBe(Date);
    expect(data[1][2].value).toEqual(new Date(2026, 10, 7));
    expect(data[1][2].format).toBe('dd.mm.yyyy');
    expect(data[1][3]).toMatchObject({ value: true, type: Boolean });
    expect(data[2]).toEqual([null, null, null, null]);
    expect(columns[0].width).toBe(20);
  });
});

describe('downloadCsv', () => {
  it('clicks a temporary download link and revokes the URL', () => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { expect(this.download).toBe('a.csv'); });
    downloadCsv(sheet([{ key: 'a', label: 'A', type: 'string' }], []), 'de', 'a.csv');
    expect(click).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
