// Export helpers for admin tables. Sheet model:
// { name, columns: [{ key, label, type: 'string'|'number'|'date'|'datetime'|'boolean', width? }], rows }

const pad = (n) => String(n).padStart(2, '0');

function toDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function csvCell(value, type, language) {
  if (value == null || value === '') return '';
  if (type === 'boolean') {
    return language === 'en' ? (value ? 'yes' : 'no') : (value ? 'ja' : 'nein');
  }
  if (type === 'number') {
    const s = String(value);
    return language === 'de' ? s.replace('.', ',') : s;
  }
  if (type === 'date' || type === 'datetime') {
    const d = toDate(value);
    if (!d) return '';
    const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return type === 'date' ? day : `${day} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return String(value);
}

function quote(field) {
  return /[;"\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
}

export function toCsv(sheet, language) {
  const lines = [sheet.columns.map((c) => quote(String(c.label))).join(';')];
  for (const row of sheet.rows) {
    lines.push(sheet.columns.map((c) => quote(csvCell(row[c.key], c.type, language))).join(';'));
  }
  return `\uFEFF${lines.join('\r\n')}`;
}

function xlsxCell(value, type) {
  if (value == null || value === '') return null;
  if (type === 'number') return { value: Number(value), type: Number };
  if (type === 'boolean') return { value: Boolean(value), type: Boolean };
  if (type === 'date' || type === 'datetime') {
    const d = toDate(value);
    if (!d) return null;
    return { value: d, type: Date, format: type === 'date' ? 'dd.mm.yyyy' : 'dd.mm.yyyy hh:mm' };
  }
  return { value: String(value), type: String };
}

export async function downloadXlsx(sheets, fileName) {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const payload = sheets.map((sheet) => ({
    sheet: sheet.name,
    data: [
      sheet.columns.map((c) => ({ value: String(c.label), type: String, fontWeight: 'bold' })),
      ...sheet.rows.map((row) => sheet.columns.map((c) => xlsxCell(row[c.key], c.type))),
    ],
    columns: sheet.columns.map((c) => ({ width: c.width ?? 16 })),
  }));
  await writeExcelFile(payload).toFile(fileName);
}

export function downloadCsv(sheet, language, fileName) {
  const blob = new Blob([toCsv(sheet, language)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
